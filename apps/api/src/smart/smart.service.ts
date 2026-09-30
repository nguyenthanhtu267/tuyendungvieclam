import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JobApprovalStatus, JobPosting } from '../database/entities/job-posting.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CandidateSkill } from '../database/entities/candidate-sections.entity';
import { Application } from '../database/entities/application.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { LEVEL_ORDER, scoreMatch, type MatchProfile } from '../jobs/job-match';
import { assessJobRisk, fold } from '../admin/job-risk';

const strip = (h?: string | null) => (h ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// Đợt 63 — 11 tính năng thông minh (thuần quy tắc + số liệu thật từ CSDL, không gọi dịch vụ AI trả phí).
@Injectable()
export class SmartService {
  constructor(
    @InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>,
    @InjectRepository(CandidateProfile) private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(CandidateSkill) private readonly skillRepo: Repository<CandidateSkill>,
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(CompanyUser) private readonly companyUserRepo: Repository<CompanyUser>,
  ) {}

  private async companyIdOf(userId: string): Promise<string> {
    const link = await this.companyUserRepo.findOne({ where: { userId } });
    if (!link) throw new ForbiddenException('Tài khoản chưa liên kết với công ty nào');
    return link.companyId;
  }

  private async matchProfileOf(userId: string) {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) return null;
    const skills = await this.skillRepo.find({ where: { candidateProfileId: profile.id } });
    return { profile, mp: { ...profile, skillNames: skills.map((s) => s.skillName) } as MatchProfile };
  }

  // ───────────── ỨNG VIÊN: gộp 5 tính năng vào 1 lần gọi cho trang chi tiết tin ─────────────
  // (1) chấm CV ↔ tin, (2) dự báo cơ hội, (4) gợi ý lương thương lượng, (5) lộ trình nghề nghiệp
  async jobInsights(userId: string, jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    const loaded = await this.matchProfileOf(userId);
    if (!loaded) return { hasProfile: false };
    const { profile, mp } = loaded;
    const match = scoreMatch(mp, job);

    // (1) Kỹ năng còn thiếu: từ khoá (tags) của tin mà hồ sơ chưa có + từ khoá xuất hiện trong yêu cầu.
    const have = new Set(mp.skillNames.map((s) => fold(s)));
    const wanted = new Map<string, string>();
    for (const t of job.tags ?? []) if (t && t.length <= 40) wanted.set(fold(t), t);
    const matchedSkills = [...wanted.entries()].filter(([k]) => have.has(k) || [...have].some((h) => h && (k.includes(h) || h.includes(k)))).map(([, v]) => v);
    const missingSkills = [...wanted.entries()].filter(([k]) => !have.has(k) && ![...have].some((h) => h && (k.includes(h) || h.includes(k)))).map(([, v]) => v).slice(0, 6);
    const tips: string[] = [];
    if (missingSkills.length) tips.push(`Nếu bạn thực sự biết ${missingSkills.slice(0, 3).join(', ')}, hãy bổ sung vào mục Kỹ năng trong hồ sơ để tăng độ phù hợp.`);
    if (!profile.yearsOfExperience && profile.yearsOfExperience !== 0) tips.push('Hồ sơ chưa ghi số năm kinh nghiệm — nhà tuyển dụng thường lọc theo mục này.');
    if (!mp.skillNames.length) tips.push('Hồ sơ chưa có kỹ năng nào — thêm 5–8 kỹ năng chính.');
    if (match.gaps.length) tips.push(...match.gaps.map((g) => `${g}.`));

    // (2) Dự báo cơ hội: điểm phù hợp + mức cạnh tranh (số hồ sơ đã nộp) + thời gian tin đã đăng.
    const applicantCount = await this.appRepo.count({ where: { jobPostingId: jobId } });
    const days = Math.max(0, Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 86400000));
    const slots = Math.max(1, job.headcount ?? 1);
    const perSlot = applicantCount / slots;
    let chance = match.score;
    const chanceReasons: string[] = [`Độ phù hợp hồ sơ: ${match.score}%`];
    if (perSlot >= 30) { chance -= 18; chanceReasons.push(`Cạnh tranh cao: ${applicantCount} hồ sơ cho ${slots} vị trí`); }
    else if (perSlot >= 10) { chance -= 8; chanceReasons.push(`Cạnh tranh vừa: ${applicantCount} hồ sơ cho ${slots} vị trí`); }
    else { chance += 5; chanceReasons.push(applicantCount ? `Ít cạnh tranh: mới ${applicantCount} hồ sơ` : 'Chưa có ai nộp — bạn có thể là người đầu tiên'); }
    if (days <= 3) { chance += 4; chanceReasons.push('Tin mới đăng, nộp sớm được xem trước'); }
    chance = Math.max(5, Math.min(95, Math.round(chance)));
    const chanceLevel = chance >= 70 ? 'high' : chance >= 45 ? 'medium' : 'low';

    // (4) Lương thị trường cùng ngành/cấp bậc (triệu VND) từ chính các tin đang tuyển trên web.
    const salary = await this.salaryBenchmark(job, mp.desiredSalaryMin ?? null).catch(() => null);

    // (5) Lộ trình nghề nghiệp: cấp bậc kế tiếp + kỹ năng hay gặp ở tin cấp đó cùng ngành mà bạn chưa có.
    const career = await this.careerPath(job, have).catch(() => null);

    return {
      hasProfile: true,
      score: match.score,
      matchedSkills,
      missingSkills,
      tips: tips.slice(0, 5),
      chance: { percent: chance, level: chanceLevel, applicants: applicantCount, reasons: chanceReasons },
      salary,
      career,
    };
  }

  private async salaryBenchmark(job: JobPosting, expected: number | null) {
    const where: string[] = [`approval_status = 'approved'`, `salary_max IS NOT NULL`, `salary_max > 0`, `salary_max < 150`];
    const params: unknown[] = [];
    let scope = 'toàn thị trường';
    const tryScope = async (extra: string[], ps: unknown[], label: string) => {
      const rows: { n: string; p25: string; med: string; p75: string }[] = await this.jobRepo.manager.query(
        `SELECT COUNT(*) AS n,
                percentile_cont(0.25) WITHIN GROUP (ORDER BY (COALESCE(salary_min, salary_max) + salary_max)/2.0) AS p25,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY (COALESCE(salary_min, salary_max) + salary_max)/2.0) AS med,
                percentile_cont(0.75) WITHIN GROUP (ORDER BY (COALESCE(salary_min, salary_max) + salary_max)/2.0) AS p75
           FROM job_postings WHERE ${[...where, ...extra].join(' AND ')}`,
        ps,
      );
      const r = rows[0];
      if (r && Number(r.n) >= 8) return { n: Number(r.n), p25: +Number(r.p25).toFixed(1), median: +Number(r.med).toFixed(1), p75: +Number(r.p75).toFixed(1), scope: label };
      return null;
    };
    void params; void scope;
    let bench = null as null | { n: number; p25: number; median: number; p75: number; scope: string };
    if (job.industry && job.level) bench = await tryScope([`industry = $1`, `level = $2`], [job.industry, job.level], `${job.industry} · ${job.level}`);
    if (!bench && job.industry) bench = await tryScope([`industry = $1`], [job.industry], job.industry);
    if (!bench) bench = await tryScope([], [], 'toàn thị trường');
    if (!bench) return null;
    const offer = job.salaryMax ? (((job.salaryMin ?? job.salaryMax) + job.salaryMax) / 2) : null;
    let advice = `Mức thị trường (${bench.scope}) phổ biến ${bench.p25}–${bench.p75} triệu, trung vị ${bench.median} triệu.`;
    if (offer != null) {
      if (offer < bench.p25) advice += ` Tin này trả thấp hơn mặt bằng (khoảng ${offer.toFixed(1)} triệu) — có thể thương lượng lên gần ${bench.median} triệu nếu bạn đủ kinh nghiệm.`;
      else if (offer > bench.p75) advice += ` Tin này trả cao hơn mặt bằng (khoảng ${offer.toFixed(1)} triệu) — cạnh tranh nhiều, chuẩn bị kỹ.`;
      else advice += ` Mức của tin (~${offer.toFixed(1)} triệu) nằm trong khoảng phổ biến.`;
    } else advice += ' Tin ghi "Thoả thuận": bạn nên đề xuất quanh mức trung vị và nêu rõ kinh nghiệm để có cơ sở.';
    if (expected != null) advice += ` Mức bạn mong muốn: ${expected} triệu${expected > bench.p75 ? ' (cao hơn phần lớn thị trường)' : expected < bench.p25 ? ' (thấp hơn mặt bằng — có thể đòi cao hơn)' : ' (hợp lý)'}.`;
    return { ...bench, offer, expected, advice };
  }

  private async careerPath(job: JobPosting, have: Set<string>) {
    const idx = LEVEL_ORDER.indexOf(job.level ?? '');
    const next = idx >= 0 && idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1] : null;
    if (!next || !job.industry) return null;
    const rows: { tag: string; c: string }[] = await this.jobRepo.manager.query(
      `SELECT t AS tag, COUNT(*) AS c
         FROM job_postings j, unnest(string_to_array(j.tags, ',')) AS t
        WHERE j.approval_status = 'approved' AND j.industry = $1 AND j.level = $2
        GROUP BY t ORDER BY c DESC LIMIT 30`,
      [job.industry, next],
    );
    const sal: { med: string | null; n: string }[] = await this.jobRepo.manager.query(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (COALESCE(salary_min, salary_max) + salary_max)/2.0) AS med, COUNT(*) AS n
         FROM job_postings WHERE approval_status='approved' AND industry=$1 AND level=$2 AND salary_max IS NOT NULL AND salary_max < 150`,
      [job.industry, next],
    );
    const skillsToLearn = rows.filter((r) => r.tag && !have.has(fold(r.tag))).slice(0, 5).map((r) => r.tag);
    const openings = Number(sal[0]?.n ?? 0);
    return {
      current: job.level ?? null,
      next,
      industry: job.industry,
      skillsToLearn,
      nextMedianSalary: sal[0]?.med ? +Number(sal[0].med).toFixed(1) : null,
      openings,
      searchQuery: `industries=${encodeURIComponent(job.industry)}&level=${encodeURIComponent(next)}`,
    };
  }

  // ───────────── NHÀ TUYỂN DỤNG ─────────────
  // (7) Xếp hạng hồ sơ ứng tuyển của 1 tin theo độ phù hợp. Đơn khách (không có hồ sơ online) → không có điểm.
  async applicantScores(userId: string, jobId: string) {
    const companyId = await this.companyIdOf(userId);
    const job = await this.jobRepo.findOne({ where: { id: jobId, companyId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng của công ty bạn');
    const apps = await this.appRepo.find({ where: { jobPostingId: jobId }, relations: { cv: true }, take: 500 });
    const profileIds = [...new Set(apps.map((a) => a.cv?.candidateProfileId).filter(Boolean) as string[])];
    const out: Record<string, { score: number; reasons: string[]; gaps: string[] }> = {};
    if (!profileIds.length) return { scores: out };
    const profiles = await this.profileRepo.find({ where: { id: In(profileIds) }, relations: { skills: true } });
    const byId = new Map(profiles.map((p) => [p.id, p]));
    for (const a of apps) {
      const p = a.cv?.candidateProfileId ? byId.get(a.cv.candidateProfileId) : null;
      if (!p) continue;
      const m = scoreMatch({ ...p, skillNames: (p.skills ?? []).map((s) => s.skillName) }, job);
      const toEmployer = (t: string) =>
        t.replace(/bạn quan tâm/g, 'ứng viên quan tâm').replace(/bạn muốn làm việc/g, 'ứng viên muốn làm việc').replace(/bạn mong muốn/g, 'ứng viên mong muốn').replace(/bạn chọn/g, 'ứng viên chọn').replace(/mức mong muốn/g, 'mức ứng viên mong muốn').replace(/hơn mong muốn/g, 'hơn ứng viên mong muốn').replace(/\bbạn\b/g, 'ứng viên');
      out[a.id] = { score: m.score, reasons: m.reasons.map(toEmployer), gaps: m.gaps.map(toEmployer) };
    }
    return { scores: out };
  }

  // (9) Sức khoẻ tin đăng: phát hiện tin nhiều xem ít nộp, không ai xem, sắp hết hạn chưa có hồ sơ…
  async jobHealth(userId: string) {
    const companyId = await this.companyIdOf(userId);
    const jobs = await this.jobRepo.find({ where: { companyId, approvalStatus: JobApprovalStatus.APPROVED, isPaused: false } });
    if (!jobs.length) return { items: [] };
    const ids = jobs.map((j) => j.id);
    const views = new Map<string, number>();
    try {
      const rows: { id: string; v: string }[] = await this.jobRepo.manager.query(
        `SELECT entity_id::text AS id, COUNT(*) AS v FROM analytics_pageviews
          WHERE entity_type='job' AND entity_id::text = ANY($1::text[]) AND started_at >= now() - interval '14 days' GROUP BY entity_id`,
        [ids],
      );
      rows.forEach((r) => views.set(r.id, Number(r.v)));
    } catch { /* chưa có bảng analytics */ }
    const apps = new Map<string, number>();
    const cnt: { id: string; c: string }[] = await this.appRepo
      .createQueryBuilder('a').select('a.job_posting_id', 'id').addSelect('COUNT(*)', 'c')
      .where('a.job_posting_id IN (:...ids)', { ids }).groupBy('a.job_posting_id').getRawMany();
    cnt.forEach((r) => apps.set(r.id, Number(r.c)));
    const items: { jobId: string; title: string; views: number; applications: number; severity: 'warn' | 'info'; problem: string; advice: string; fix: string }[] = [];
    const today = new Date().toISOString().slice(0, 10);
    for (const j of jobs) {
      const v = views.get(j.id) ?? 0;
      const a = apps.get(j.id) ?? 0;
      const ageDays = Math.floor((Date.now() - new Date(j.createdAt).getTime()) / 86400000);
      const base = { jobId: j.id, title: j.title, views: v, applications: a };
      const fixes: string[] = [];
      if (!j.salaryMin && !j.salaryMax) fixes.push('ghi rõ mức lương');
      if (strip(j.description).length < 200) fixes.push('mô tả chi tiết hơn');
      if ((j.tags?.length ?? 0) < 3) fixes.push('thêm từ khoá (Job tags)');
      const fix = fixes.length ? `Nên: ${fixes.join(', ')}.` : 'Thử làm mới tiêu đề (ghi đúng chức danh ứng viên hay tìm).';
      if (v >= 40 && a / v < 0.02) {
        items.push({ ...base, severity: 'warn', problem: `${v} lượt xem nhưng chỉ ${a} hồ sơ (${((a / v) * 100).toFixed(1)}%)`, advice: 'Tin thu hút xem nhưng ít người nộp — thường do lương, yêu cầu hoặc mô tả chưa hấp dẫn.', fix });
      } else if (ageDays >= 5 && v < 5 && a < 3) {
        items.push({ ...base, severity: 'warn', problem: `Chỉ ${v} lượt xem sau ${ageDays} ngày`, advice: 'Tin ít xuất hiện khi ứng viên tìm kiếm.', fix: 'Nên: thêm từ khoá, chọn đúng ngành/địa điểm, ghi tiêu đề rõ chức danh.' });
      } else if (j.deadline && String(j.deadline) <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) && String(j.deadline) >= today && a === 0) {
        items.push({ ...base, severity: 'info', problem: 'Sắp hết hạn nộp mà chưa có hồ sơ nào', advice: 'Cân nhắc gia hạn và cải thiện nội dung tin.', fix });
      }
    }
    items.sort((x, y) => (x.severity === y.severity ? y.views - x.views : x.severity === 'warn' ? -1 : 1));
    return { items: items.slice(0, 10) };
  }

  // ───────────── ADMIN: (10) tin trùng / đáng ngờ, (11) chấm chất lượng tin cào ─────────────
  async qualityOverview() {
    const jobs = await this.jobRepo.find({
      where: { approvalStatus: JobApprovalStatus.APPROVED },
      relations: { company: true },
      order: { createdAt: 'DESC' },
      take: 1500,
    });
    // Trùng: cùng tiêu đề (đã bỏ dấu/ký tự lạ) + cùng tỉnh đầu tiên, khác công ty hoặc cùng công ty.
    const groups = new Map<string, JobPosting[]>();
    for (const j of jobs) {
      const key = `${fold(j.title)}|${fold((j.provinces?.[0] ?? j.location ?? ''))}|${fold(j.company?.name ?? '')}`;
      if (fold(j.title).length < 6) continue;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(j);
    }
    const duplicates = [...groups.values()]
      .filter((g) => g.length >= 2)
      .slice(0, 30)
      .map((g) => ({
        title: g[0].title,
        company: g[0].company?.name ?? '',
        jobs: g.map((j) => ({ id: j.id, createdAt: j.createdAt, source: j.company?.isAdminSourced ? 'Tổng hợp' : 'NTD đăng' })),
      }));
    // Đáng ngờ: dùng lại bộ chấm rủi ro (assessJobRisk) cho tin ĐÃ duyệt.
    const others = jobs.map((j) => ({ id: j.id, companyId: j.companyId, title: j.title, description: j.description, requirements: j.requirements }));
    const suspicious = jobs
      .map((j) => ({ j, r: assessJobRisk(j, { others }) }))
      .filter((x) => x.r.score >= 40)
      .sort((a, b) => b.r.score - a.r.score)
      .slice(0, 30)
      .map(({ j, r }) => ({ id: j.id, title: j.title, company: j.company?.name ?? '', score: r.score, reasons: r.reasons }));
    // Chất lượng tin cào (công ty do Admin tổng hợp, chưa được nhận lại): chấm 100 điểm.
    const low = jobs
      .filter((j) => j.company?.isAdminSourced && !j.company?.claimedAt)
      .map((j) => {
        const checks: [boolean, number, string][] = [
          [!!(j.salaryMin || j.salaryMax), 20, 'thiếu lương'],
          [strip(j.description).length >= 200, 25, 'mô tả quá ngắn'],
          [strip(j.requirements).length >= 60, 15, 'thiếu yêu cầu'],
          [!!(j.provinces?.length || j.location), 15, 'thiếu địa điểm'],
          [!!j.industry, 10, 'thiếu ngành'],
          [!!(j.contactEmail || j.contactPhone), 10, 'thiếu liên hệ'],
          [(j.tags?.length ?? 0) >= 2, 5, 'thiếu từ khoá'],
        ];
        const score = checks.reduce((s, [ok, w]) => s + (ok ? w : 0), 0);
        return { id: j.id, title: j.title, company: j.company?.name ?? '', score, missing: checks.filter(([ok]) => !ok).map(([, , m]) => m) };
      })
      .filter((x) => x.score < 60)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40);
    return { scanned: jobs.length, duplicates, suspicious, lowQuality: low };
  }

  // ───────────── Đợt 64 ─────────────
  // (4) "Hồ sơ phản hồi" của công ty: tỷ lệ NTD có xem/xử lý đơn và thời gian phản hồi trung vị (180 ngày gần nhất).
  async companyResponseStats(companyId: string) {
    const rows: { total: string; responded: string; interviews: string; med_hours: string | null }[] = await this.jobRepo.manager.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE a.viewed_at IS NOT NULL OR a.status <> 'new') AS responded,
              COUNT(*) FILTER (WHERE a.status = 'interview') AS interviews,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (a.viewed_at - a.applied_at))/3600.0)
                FILTER (WHERE a.viewed_at IS NOT NULL) AS med_hours
         FROM applications a JOIN job_postings j ON j.id = a.job_posting_id
        WHERE j.company_id = $1 AND a.deleted_at IS NULL AND a.applied_at >= now() - interval '180 days'`,
      [companyId],
    );
    const r = rows[0];
    const total = Number(r?.total ?? 0);
    if (total < 5) return { enough: false, total };
    const responded = Number(r.responded);
    const rate = Math.round((responded / total) * 100);
    const hours = r.med_hours == null ? null : Math.round(Number(r.med_hours));
    return {
      enough: true,
      total,
      responseRate: rate,
      interviewRate: Math.round((Number(r.interviews) / total) * 100),
      medianHours: hours,
      medianLabel: hours == null ? null : hours < 24 ? `${Math.max(1, hours)} giờ` : `${Math.round(hours / 24)} ngày`,
      level: rate >= 70 ? 'good' : rate >= 35 ? 'fair' : 'poor',
    };
  }

  // (7)+(8) Dự báo trước khi đăng: bao nhiêu hồ sơ / bao lâu đủ 10 hồ sơ + lương so với mặt bằng, từ tin cùng ngành đã đăng.
  async jobForecast(q: { industry?: string; level?: string; salaryMin?: number; salaryMax?: number }) {
    if (!q.industry) return { enough: false };
    const run = async (withLevel: boolean) => {
      const params: unknown[] = [q.industry];
      let lv = '';
      if (withLevel && q.level) { params.push(q.level); lv = 'AND j.level = $2'; }
      const rows: { n: string; med_apps: string | null; p10: string | null; d10: string | null; hi: string | null; lo: string | null }[] = await this.jobRepo.manager.query(
        `WITH per AS (
           SELECT j.id, j.salary_max,
                  (SELECT COUNT(*) FROM applications a WHERE a.job_posting_id = j.id AND a.applied_at <= j.created_at + interval '21 days') AS apps,
                  (SELECT EXTRACT(EPOCH FROM (a.applied_at - j.created_at))/86400.0 FROM applications a WHERE a.job_posting_id = j.id ORDER BY a.applied_at OFFSET 9 LIMIT 1) AS d10
             FROM job_postings j
            WHERE j.approval_status = 'approved' AND j.industry = $1 ${lv} AND j.created_at < now() - interval '21 days'
         ), med AS (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY salary_max) AS m FROM per WHERE salary_max IS NOT NULL)
         SELECT COUNT(*) AS n,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY apps) AS med_apps,
                COUNT(*) FILTER (WHERE d10 IS NOT NULL)::float / NULLIF(COUNT(*), 0) AS p10,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY d10) FILTER (WHERE d10 IS NOT NULL) AS d10,
                AVG(apps) FILTER (WHERE salary_max >= (SELECT m FROM med)) AS hi,
                AVG(apps) FILTER (WHERE salary_max < (SELECT m FROM med)) AS lo
           FROM per`,
        params,
      );
      return rows[0];
    };
    let r = await run(true);
    let scope = `${q.industry}${q.level ? ' · ' + q.level : ''}`;
    if (!r || Number(r.n) < 5) { r = await run(false); scope = q.industry; }
    if (!r || Number(r.n) < 5) return { enough: false };
    const medApps = Math.round(Number(r.med_apps ?? 0));
    const days10 = r.d10 == null ? null : Math.max(1, Math.round(Number(r.d10)));
    const share10 = Math.round(Number(r.p10 ?? 0) * 100);
    const salary = await this.salaryBenchmark({ industry: q.industry, level: q.level, salaryMin: q.salaryMin, salaryMax: q.salaryMax } as JobPosting, null).catch(() => null);
    const advice: string[] = [];
    const offer = q.salaryMax ? ((q.salaryMin ?? q.salaryMax) + q.salaryMax) / 2 : null;
    const ratio = r.hi && r.lo && Number(r.lo) > 0 ? Number(r.hi) / Number(r.lo) : null;
    if (salary) {
      if (offer == null) advice.push(`Tin ghi "Thoả thuận" thường ít hồ sơ hơn. Mức phổ biến ${salary.p25}–${salary.p75} triệu — nên ghi rõ.`);
      else if (offer < salary.p25) advice.push(`Lương ~${offer.toFixed(1)} triệu thấp hơn mặt bằng (${salary.p25}–${salary.p75} triệu).${ratio && ratio > 1.15 ? ` Tin trả từ mức trung vị trở lên nhận nhiều hồ sơ gấp ~${ratio.toFixed(1)} lần.` : ''} Cân nhắc nâng gần ${salary.median} triệu.`);
      else if (offer > salary.p75) advice.push(`Lương ~${offer.toFixed(1)} triệu cao hơn mặt bằng — dự kiến nhiều hồ sơ, có thể giảm nhẹ nếu cần tiết kiệm.`);
      else advice.push(`Lương ~${offer.toFixed(1)} triệu nằm trong khoảng phổ biến (${salary.p25}–${salary.p75} triệu).`);
    }
    return { enough: true, scope, sample: Number(r.n), medianApplications21d: medApps, shareReaching10: share10, daysTo10: days10, salary, advice };
  }

  // (12)+(13) Admin: sức khoẻ hệ thống + phát hiện spam ứng tuyển.
  async systemHealth() {
    const q = async <T,>(sql: string, p: unknown[] = []) => (await this.jobRepo.manager.query(sql, p)) as T[];
    const [c] = await q<Record<string, string>>(
      `SELECT
         (SELECT COUNT(*) FROM job_postings WHERE approval_status = 'pending') AS pending_jobs,
         (SELECT COALESCE(EXTRACT(EPOCH FROM (now() - MIN(created_at)))/3600.0, 0) FROM job_postings WHERE approval_status = 'pending') AS oldest_pending_h,
         (SELECT COUNT(*) FROM companies WHERE approval_status = 'pending') AS pending_companies,
         (SELECT COUNT(*) FROM users WHERE created_at >= now() - interval '24 hours') AS users_24h,
         (SELECT COUNT(*) FROM users WHERE created_at >= now() - interval '8 days' AND created_at < now() - interval '1 day') / 7.0 AS users_avg,
         (SELECT COUNT(*) FROM job_postings WHERE created_at >= now() - interval '24 hours') AS jobs_24h,
         (SELECT COUNT(*) FROM applications WHERE applied_at >= now() - interval '24 hours') AS apps_24h,
         (SELECT COUNT(*) FROM job_postings WHERE approval_status = 'rejected' AND updated_at >= now() - interval '7 days') AS rejected_7d,
         (SELECT COUNT(*) FROM job_postings WHERE auto_approved = true AND admin_reviewed = false AND approval_status = 'approved') AS unreviewed_auto`,
    );
    const n = (k: string) => Number(c?.[k] ?? 0);
    const alerts: { level: 'warn' | 'info'; text: string }[] = [];
    if (n('pending_jobs') >= 20 || n('oldest_pending_h') >= 48) alerts.push({ level: 'warn', text: `Hàng chờ duyệt tin: ${n('pending_jobs')} tin, tin cũ nhất chờ ${Math.round(n('oldest_pending_h'))} giờ.` });
    if (n('pending_companies') >= 5) alerts.push({ level: 'warn', text: `${n('pending_companies')} công ty đang chờ xác thực.` });
    if (n('users_24h') >= 20 && n('users_24h') > 3 * Math.max(1, n('users_avg'))) alerts.push({ level: 'warn', text: `Đăng ký tăng đột biến: ${n('users_24h')} tài khoản/24h (trung bình ${n('users_avg').toFixed(1)}/ngày). Kiểm tra tài khoản rác.` });
    if (n('unreviewed_auto') >= 30) alerts.push({ level: 'info', text: `${n('unreviewed_auto')} tin tự động duyệt chưa được kiểm tra.` });
    if (n('jobs_24h') === 0) alerts.push({ level: 'info', text: 'Chưa có tin mới nào trong 24 giờ qua.' });
    if (!alerts.length) alerts.push({ level: 'info', text: 'Hệ thống bình thường, không có cảnh báo.' });

    const burst = await q<{ email: string | null; guest: string | null; n: string }>(
      `SELECT u.email, cv.guest_email AS guest, COUNT(*) AS n
         FROM applications a JOIN cvs cv ON cv.id = a.cv_id
         LEFT JOIN candidate_profiles p ON p.id = cv.candidate_profile_id
         LEFT JOIN users u ON u.id = p.user_id
        WHERE a.applied_at >= now() - interval '24 hours'
        GROUP BY u.email, cv.guest_email HAVING COUNT(*) >= 15 ORDER BY n DESC LIMIT 15`,
    );
    const same = await q<{ email: string | null; guest: string | null; n: string; sample: string }>(
      `SELECT u.email, cv.guest_email AS guest, COUNT(*) AS n, LEFT(a.cover_letter, 80) AS sample
         FROM applications a JOIN cvs cv ON cv.id = a.cv_id
         LEFT JOIN candidate_profiles p ON p.id = cv.candidate_profile_id
         LEFT JOIN users u ON u.id = p.user_id
        WHERE a.applied_at >= now() - interval '7 days' AND a.cover_letter IS NOT NULL AND LENGTH(a.cover_letter) > 30
        GROUP BY u.email, cv.guest_email, a.cover_letter HAVING COUNT(*) >= 6 ORDER BY n DESC LIMIT 15`,
    );
    return {
      metrics: { pendingJobs: n('pending_jobs'), pendingCompanies: n('pending_companies'), users24h: n('users_24h'), jobs24h: n('jobs_24h'), apps24h: n('apps_24h'), rejected7d: n('rejected_7d') },
      alerts,
      spam: {
        burst: burst.map((b) => ({ who: b.email ?? b.guest ?? 'Khách', count: Number(b.n) })),
        sameLetter: same.map((b) => ({ who: b.email ?? b.guest ?? 'Khách', count: Number(b.n), sample: b.sample })),
      },
    };
  }
}
