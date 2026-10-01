import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobPosting } from '../database/entities/job-posting.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { fold } from '../admin/job-risk';

const FREE_MAIL = new Set(['gmail.com', 'yahoo.com', 'yahoo.com.vn', 'hotmail.com', 'outlook.com', 'live.com', 'icloud.com']);
const MID = `(COALESCE(salary_min, salary_max) + salary_max)/2.0`;

// Đợt 78 — thông minh bằng quy tắc: kỹ năng đáng học, bản tin tuần, so sánh hồ sơ, cờ spam, tài khoản bất thường.
@Injectable()
export class Smart5Service {
  constructor(
    @InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>,
    @InjectRepository(CandidateProfile) private readonly profileRepo: Repository<CandidateProfile>,
  ) {}

  private q<T>(sql: string, p: unknown[] = []) {
    return this.jobRepo.manager.query(sql, p) as Promise<T[]>;
  }

  private async profileOf(userId: string) {
    return this.profileRepo.findOne({ where: { userId } });
  }

  // (3) Kỹ năng đáng học: thẻ (tag) tin cùng ngành mà tin có thẻ đó trả cao hơn trung vị.
  async skillPremium(userId: string) {
    const p = await this.profileOf(userId);
    if (!p) return { hasProfile: false };
    const industry = p.desiredIndustries?.[0] ?? null;
    const have = (await this.q<{ s: string }>(`SELECT skill_name AS s FROM candidate_skills WHERE candidate_profile_id = $1`, [p.id])).map((r) => fold(r.s));
    const where = `approval_status='approved' AND salary_max IS NOT NULL AND salary_max > 0 AND salary_max < 150 AND tags IS NOT NULL AND tags <> ''${industry ? ' AND industry = $1' : ''}`;
    const params = industry ? [industry] : [];
    const [base] = await this.q<{ med: number; n: string }>(`SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ${MID}) AS med, COUNT(*) AS n FROM job_postings WHERE ${where}`, params);
    if (!base || Number(base.n) < 20) return { hasProfile: true, items: [], industry };
    const rows = await this.q<{ tag: string; n: string; med: number }>(
      `SELECT tag, COUNT(*) AS n, percentile_cont(0.5) WITHIN GROUP (ORDER BY mid) AS med
         FROM (SELECT lower(trim(unnest(string_to_array(tags, ',')))) AS tag, ${MID} AS mid FROM job_postings WHERE ${where}) t
        WHERE length(tag) BETWEEN 2 AND 30 GROUP BY tag HAVING COUNT(*) >= 5`,
      params,
    );
    const items = rows
      .map((r) => ({ tag: r.tag, jobs: Number(r.n), median: +Number(r.med).toFixed(1), uplift: Math.round(((Number(r.med) - Number(base.med)) / Number(base.med)) * 100) }))
      .filter((r) => r.uplift >= 5 && !have.some((h) => h.includes(fold(r.tag)) || fold(r.tag).includes(h)))
      .sort((a, b) => b.uplift - a.uplift)
      .slice(0, 5);
    return { hasProfile: true, industry, baseMedian: +Number(base.med).toFixed(1), items };
  }

  // (4) Bản tin tuần: tin mới khớp ngành/tỉnh quan tâm, xu hướng so với tuần trước.
  async weeklyDigest(userId: string) {
    const p = await this.profileOf(userId);
    if (!p) return { hasProfile: false };
    const inds = p.desiredIndustries ?? [];
    const locs = p.desiredLocations?.length ? p.desiredLocations : p.province ? [p.province] : [];
    const cond = [`approval_status='approved'`];
    const params: unknown[] = [];
    if (inds.length) { params.push(inds); cond.push(`industry = ANY($${params.length})`); }
    if (locs.length) { params.push(locs); cond.push(`string_to_array(provinces, ',') && $${params.length}::text[]`); }
    const w = cond.join(' AND ');
    const [c] = await this.q<{ cur: string; prev: string; med_cur: number | null; med_prev: number | null }>(
      `SELECT COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS cur,
              COUNT(*) FILTER (WHERE created_at < now() - interval '7 days' AND created_at >= now() - interval '14 days') AS prev,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY ${MID}) FILTER (WHERE created_at >= now() - interval '7 days' AND salary_max > 0 AND salary_max < 150) AS med_cur,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY ${MID}) FILTER (WHERE created_at < now() - interval '7 days' AND created_at >= now() - interval '14 days' AND salary_max > 0 AND salary_max < 150) AS med_prev
         FROM job_postings WHERE ${w}`,
      params,
    );
    const latest = await this.q<{ id: string; title: string; company: string }>(
      `SELECT j.id, j.title, c.name AS company FROM job_postings j JOIN companies c ON c.id = j.company_id
        WHERE ${w.replace(/approval_status/g, 'j.approval_status').replace(/industry/g, 'j.industry').replace(/provinces/g, 'j.provinces')} AND j.created_at >= now() - interval '7 days'
        ORDER BY j.created_at DESC LIMIT 3`,
      params,
    );
    const cur = Number(c?.cur ?? 0);
    const prev = Number(c?.prev ?? 0);
    return {
      hasProfile: true,
      scope: [inds.slice(0, 2).join(', '), locs.slice(0, 2).join(', ')].filter(Boolean).join(' · ') || 'toàn website',
      newJobs: cur,
      prevJobs: prev,
      change: prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null,
      medianSalary: c?.med_cur != null ? +Number(c.med_cur).toFixed(1) : null,
      salaryChange: c?.med_cur != null && c?.med_prev != null && Number(c.med_prev) > 0 ? Math.round(((Number(c.med_cur) - Number(c.med_prev)) / Number(c.med_prev)) * 100) : null,
      latest,
    };
  }

  // (5) So hồ sơ với hồ sơ từng được mời phỏng vấn (ẩn danh, cùng ngành mong muốn).
  async profileBenchmark(userId: string) {
    const p = await this.profileOf(userId);
    if (!p) return { hasProfile: false };
    const industry = p.desiredIndustries?.[0] ?? null;
    const base = `FROM candidate_profiles p WHERE p.id IN (
        SELECT cv.candidate_profile_id FROM applications a JOIN cvs cv ON cv.id = a.cv_id
         WHERE a.status = 'interview' AND a.deleted_at IS NULL AND a.updated_at >= now() - interval '365 days' AND cv.candidate_profile_id IS NOT NULL)`;
    const stat = (extra: string, params: unknown[]) =>
      this.q<{ n: string; avatar: string; objective: string; skills: number; certs: string; exps: number }>(
        `SELECT COUNT(*) AS n,
                COUNT(*) FILTER (WHERE p.avatar_storage_key IS NOT NULL OR p.avatar_data IS NOT NULL) AS avatar,
                COUNT(*) FILTER (WHERE coalesce(p.career_objective,'') <> '') AS objective,
                AVG((SELECT COUNT(*) FROM candidate_skills s WHERE s.candidate_profile_id = p.id)) AS skills,
                COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM candidate_certificates c WHERE c.candidate_profile_id = p.id)) AS certs,
                AVG((SELECT COUNT(*) FROM candidate_experiences e WHERE e.candidate_profile_id = p.id)) AS exps
           ${base} ${extra}`,
        params,
      );
    let [s] = industry ? await stat(`AND $1 = ANY(p.desired_industries)`, [industry]) : [undefined as never];
    let scope = industry ?? 'toàn website';
    if (!s || Number(s.n) < 10) { [s] = await stat('', []); scope = 'toàn website'; }
    const n = Number(s?.n ?? 0);
    if (n < 10) return { hasProfile: true, enough: false };
    const [me] = await this.q<{ avatar: boolean; objective: boolean; skills: string; certs: boolean; exps: string }>(
      `SELECT (p.avatar_storage_key IS NOT NULL OR p.avatar_data IS NOT NULL) AS avatar, coalesce(p.career_objective,'') <> '' AS objective,
              (SELECT COUNT(*) FROM candidate_skills s WHERE s.candidate_profile_id = p.id) AS skills,
              EXISTS (SELECT 1 FROM candidate_certificates c WHERE c.candidate_profile_id = p.id) AS certs,
              (SELECT COUNT(*) FROM candidate_experiences e WHERE e.candidate_profile_id = p.id) AS exps
         FROM candidate_profiles p WHERE p.id = $1`,
      [p.id],
    );
    const pct = (x: string) => Math.round((Number(x) / n) * 100);
    const rows = [
      { key: 'avatar', label: 'Có ảnh đại diện', peers: pct(s.avatar), mine: !!me.avatar },
      { key: 'objective', label: 'Có mục tiêu nghề nghiệp', peers: pct(s.objective), mine: !!me.objective },
      { key: 'certs', label: 'Có chứng chỉ', peers: pct(s.certs), mine: !!me.certs },
    ];
    const skillsAvg = +Number(s.skills).toFixed(1);
    const expAvg = +Number(s.exps).toFixed(1);
    const gaps: string[] = [];
    for (const r of rows) if (!r.mine && r.peers >= 50) gaps.push(`${r.peers}% hồ sơ được mời phỏng vấn ${r.label.toLowerCase()}, hồ sơ bạn chưa có.`);
    if (Number(me.skills) < skillsAvg - 1) gaps.push(`Hồ sơ được mời phỏng vấn trung bình có ${skillsAvg} kỹ năng, bạn có ${me.skills}.`);
    if (Number(me.exps) < expAvg - 1) gaps.push(`Trung bình họ ghi ${expAvg} kinh nghiệm làm việc, bạn có ${me.exps}.`);
    return { hasProfile: true, enough: true, scope, sample: n, rows, skills: { peers: skillsAvg, mine: Number(me.skills) }, experiences: { peers: expAvg, mine: Number(me.exps) }, gaps };
  }

  // (7) Cờ nghi spam cho hồ sơ của một tin (chỉ nhà tuyển dụng sở hữu tin).
  async applicantFlags(userId: string, jobId: string) {
    const [own] = await this.q<{ id: string }>(
      `SELECT j.id FROM job_postings j JOIN company_users cu ON cu.company_id = j.company_id WHERE cu.user_id = $1 AND j.id = $2`,
      [userId, jobId],
    );
    if (!own) throw new NotFoundException('Không tìm thấy tin của công ty bạn');
    const [job] = await this.q<{ qs: { q: string; expect: string }[] | null }>(`SELECT screening_questions AS qs FROM job_postings WHERE id = $1`, [jobId]);
    const rows = await this.q<{ id: string; completion: number | null; burst: string | null; dup: string | null; ans: string[] | null }>(
      `SELECT a.id, p.completion_percent AS completion, a.screening_answers AS ans,
              CASE WHEN cv.candidate_profile_id IS NULL THEN NULL ELSE (SELECT COUNT(*) FROM applications a2 JOIN cvs c2 ON c2.id = a2.cv_id WHERE c2.candidate_profile_id = cv.candidate_profile_id AND a2.applied_at >= now() - interval '24 hours') END AS burst,
              CASE WHEN cv.candidate_profile_id IS NULL THEN NULL ELSE (SELECT COUNT(*) FROM applications a3 JOIN cvs c3 ON c3.id = a3.cv_id WHERE c3.candidate_profile_id = cv.candidate_profile_id AND a.cover_letter IS NOT NULL AND length(a.cover_letter) > 40 AND a3.cover_letter = a.cover_letter) END AS dup
         FROM applications a JOIN cvs cv ON cv.id = a.cv_id LEFT JOIN candidate_profiles p ON p.id = cv.candidate_profile_id
        WHERE a.job_posting_id = $1 AND a.deleted_at IS NULL`,
      [jobId],
    );
    const qs = job?.qs ?? [];
    const flags: Record<string, string[]> = {};
    const screening: Record<string, number> = {};
    for (const r of rows) {
      const f: string[] = [];
      if (Number(r.burst ?? 0) >= 10) f.push(`Nộp ${r.burst} đơn trong 24 giờ`);
      if (Number(r.dup ?? 0) >= 5) f.push('Cùng một thư ứng tuyển gửi nhiều nơi');
      if (r.completion != null && Number(r.completion) < 30) f.push('Hồ sơ gần như trống');
      if (qs.length && r.ans) {
        const failed = qs.filter((x, i) => x.expect !== 'any' && r.ans![i] !== x.expect);
        screening[r.id] = failed.length;
        if (failed.length) f.push(`Không đạt sàng lọc: ${failed.map((x) => `“${x.q}”`).join('; ')}`);
      }
      if (f.length) flags[r.id] = f;
    }
    return { flags, screening, hasScreening: qs.length > 0 };
  }

  // (10) Tài khoản/công ty bất thường cho admin: quy tắc đơn giản, chỉ để Admin xem xét.
  async suspiciousAccounts() {
    const out = new Map<string, { companyId: string; name: string; score: number; reasons: string[] }>();
    const add = (id: string, name: string, pts: number, why: string) => {
      const o = out.get(id) ?? { companyId: id, name, score: 0, reasons: [] };
      o.score += pts;
      o.reasons.push(why);
      out.set(id, o);
    };
    const burst = await this.q<{ id: string; name: string; n: string }>(
      `SELECT c.id, c.name, COUNT(*) AS n FROM job_postings j JOIN companies c ON c.id = j.company_id
        WHERE j.created_at >= now() - interval '24 hours' AND c.is_admin_sourced = false GROUP BY c.id, c.name HAVING COUNT(*) >= 8`,
    );
    burst.forEach((r) => add(r.id, r.name, 35, `Đăng ${r.n} tin trong 24 giờ`));
    const doms = await this.q<{ dom: string; n: string; ids: string[]; names: string[] }>(
      `SELECT split_part(lower(u.email),'@',2) AS dom, COUNT(DISTINCT c.id) AS n, array_agg(DISTINCT c.id::text) AS ids, array_agg(DISTINCT c.name) AS names
         FROM companies c JOIN company_users cu ON cu.company_id = c.id JOIN users u ON u.id = cu.user_id
        WHERE c.created_at >= now() - interval '2 days' AND c.is_admin_sourced = false GROUP BY 1 HAVING COUNT(DISTINCT c.id) >= 3`,
    );
    for (const d of doms) {
      if (FREE_MAIL.has(d.dom) && Number(d.n) < 5) continue;
      d.ids.forEach((id, i) => add(id, d.names[i] ?? '', 25, `${d.n} công ty đăng ký cùng tên miền email @${d.dom} trong 2 ngày`));
    }
    const same = await this.q<{ key: string; n: string; ids: string[]; names: string[] }>(
      `SELECT regexp_replace(lower(name),'[^a-z0-9]','','g') AS key, COUNT(*) AS n, array_agg(id::text) AS ids, array_agg(name) AS names
         FROM companies WHERE created_at >= now() - interval '30 days' AND is_admin_sourced = false GROUP BY 1 HAVING COUNT(*) >= 2 AND length(regexp_replace(lower(name),'[^a-z0-9]','','g')) > 5`,
    );
    for (const d of same) d.ids.forEach((id, i) => add(id, d.names[i] ?? '', 30, `Có ${d.n} công ty tên gần giống nhau`));
    const risky = await this.q<{ id: string; name: string; n: string }>(
      `SELECT c.id, c.name, COUNT(DISTINCT r.id) AS n FROM job_reports r JOIN job_postings j ON j.id = r.job_id JOIN companies c ON c.id = j.company_id
        WHERE r.created_at >= now() - interval '30 days' GROUP BY c.id, c.name HAVING COUNT(DISTINCT r.id) >= 3`,
    ).catch(() => []);
    risky.forEach((r) => add(r.id, r.name, 40, `${r.n} báo cáo vi phạm trong 30 ngày`));
    return { items: [...out.values()].sort((a, b) => b.score - a.score).slice(0, 30) };
  }
}
