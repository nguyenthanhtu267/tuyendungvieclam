import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobPosting } from '../database/entities/job-posting.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CandidateSkill, CandidateExperience } from '../database/entities/candidate-sections.entity';
import { fold } from '../admin/job-risk';

const STOP = new Set(
  ('va cac cho cua nhung mot co khong duoc trong voi den tu nam nguoi can yeu cau kinh nghiem ky nang lam viec cong ty ' +
    'tren duoi hoac hon it nhat tot than cong viec vi tri nhan vien ung vien the tai lieu ve theo khi nhu la se da ' +
    'the and for with the you our are have has will from that this')
    .split(' '),
);

function keywordsOf(job: JobPosting): string[] {
  const tags = (job.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const text = `${job.title} ${job.requirements ?? ''}`;
  const freq = new Map<string, { raw: string; n: number }>();
  for (const w of text.split(/[^\p{L}\p{N}+#.]+/u)) {
    const raw = w.replace(/^[.]+|[.]+$/g, '');
    const k = fold(raw);
    if (k.length < 3 || STOP.has(k) || /^\d+$/.test(k)) continue;
    const cur = freq.get(k) ?? { raw, n: 0 };
    cur.n++;
    freq.set(k, cur);
  }
  const extra = [...freq.values()].sort((a, b) => b.n - a.n).map((x) => x.raw);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of [...tags, ...extra]) {
    const k = fold(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= 14) break;
  }
  return out;
}

const mondayVN = (d: Date) => {
  const vn = new Date(d.getTime() + 7 * 3600_000);
  const day = (vn.getUTCDay() + 6) % 7;
  vn.setUTCHours(0, 0, 0, 0);
  return new Date(vn.getTime() - day * 86400_000 - 7 * 3600_000);
};

// Đợt 75 — tính năng thông minh (quy tắc, không dùng AI trả phí) cho ứng viên / nhà tuyển dụng / admin.
@Injectable()
export class Smart3Service {
  constructor(
    @InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>,
    @InjectRepository(CandidateProfile) private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(CandidateSkill) private readonly skillRepo: Repository<CandidateSkill>,
    @InjectRepository(CandidateExperience) private readonly expRepo: Repository<CandidateExperience>,
  ) {}

  q<T>(sql: string, p: unknown[] = []) {
    return this.jobRepo.manager.query(sql, p) as Promise<T[]>;
  }

  // (1) Gợi ý chỉnh hồ sơ theo tin: độ phủ từ khoá giống bộ lọc ATS.
  async cvTailor(userId: string, jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) return { hasProfile: false };
    const [skills, exps] = await Promise.all([
      this.skillRepo.find({ where: { candidateProfileId: profile.id } }),
      this.expRepo.find({ where: { candidateProfileId: profile.id } }),
    ]);
    const skillText = fold(skills.map((s) => s.skillName).join(' | '));
    const otherText = fold(
      [profile.profileTitle, profile.desiredPosition, profile.careerObjective, ...exps.map((e) => `${e.position} ${e.description ?? ''}`)].filter(Boolean).join(' | '),
    );
    const kws = keywordsOf(job);
    const matched: string[] = [];
    const inText: string[] = [];
    const missing: string[] = [];
    for (const k of kws) {
      const f = fold(k);
      if (skillText.includes(f)) matched.push(k);
      else if (otherText.includes(f)) inText.push(k);
      else missing.push(k);
    }
    const total = kws.length || 1;
    const score = Math.round(((matched.length + inText.length * 0.7) / total) * 100);
    const tips: string[] = [];
    if (inText.length) tips.push(`Bạn đã nhắc tới ${inText.slice(0, 3).map((x) => `“${x}”`).join(', ')} trong kinh nghiệm — hãy thêm vào mục Kỹ năng để hệ thống lọc dễ nhận ra.`);
    if (missing.length) tips.push(`Nếu bạn thật sự có kinh nghiệm với ${missing.slice(0, 4).map((x) => `“${x}”`).join(', ')}, hãy ghi rõ trong Kỹ năng hoặc mô tả công việc (kèm kết quả cụ thể).`);
    if (!profile.careerObjective) tips.push(`Viết mục tiêu nghề nghiệp 1–2 câu nhắm vào vị trí “${job.title}”.`);
    if (!tips.length) tips.push('Hồ sơ của bạn đã phủ tốt từ khoá của tin này. Hãy nộp sớm để được xem trước.');
    return { hasProfile: true, score, keywords: kws, matched, inText, missing, tips };
  }

  // (3) Hồ sơ lâu chưa cập nhật (dùng cho banner trong trang hồ sơ).
  async profileFreshness(userId: string) {
    const p = await this.profileRepo.findOne({ where: { userId } });
    if (!p) return { hasProfile: false };
    const days = Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / 86400_000);
    return { hasProfile: true, days, stale: days >= 30 };
  }

  // (4) Vị trí mức lương mong muốn so với mặt bằng tin cùng ngành/cấp bậc/tỉnh.
  async salaryPosition(userId: string) {
    const p = await this.profileRepo.findOne({ where: { userId } });
    if (!p) return { hasProfile: false };
    const expected = p.desiredSalaryMin ?? p.desiredSalaryMax ?? null;
    if (!expected) return { hasProfile: true, expected: null };
    const industry = p.desiredIndustries?.[0] ?? null;
    const province = p.desiredLocations?.[0] ?? p.province ?? null;
    const mid = `(COALESCE(salary_min, salary_max) + salary_max)/2.0`;
    const scopes: { label: string; where: string[]; params: unknown[] }[] = [];
    const base = [`approval_status='approved'`, 'salary_max IS NOT NULL', 'salary_max > 0', 'salary_max < 150'];
    if (industry && p.desiredLevel && province)
      scopes.push({ label: `${industry} · ${p.desiredLevel} · ${province}`, where: [...base, 'industry = $1', 'level = $2', "$3 = ANY(string_to_array(provinces, ','))"], params: [industry, p.desiredLevel, province] });
    if (industry && p.desiredLevel) scopes.push({ label: `${industry} · ${p.desiredLevel}`, where: [...base, 'industry = $1', 'level = $2'], params: [industry, p.desiredLevel] });
    if (industry) scopes.push({ label: industry, where: [...base, 'industry = $1'], params: [industry] });
    scopes.push({ label: 'toàn website', where: base, params: [] });
    for (const s of scopes) {
      const [r] = await this.q<{ n: string; p25: number; med: number; p75: number; below: string }>(
        `SELECT COUNT(*) AS n,
                percentile_cont(0.25) WITHIN GROUP (ORDER BY ${mid}) AS p25,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY ${mid}) AS med,
                percentile_cont(0.75) WITHIN GROUP (ORDER BY ${mid}) AS p75,
                COUNT(*) FILTER (WHERE ${mid} <= $${s.params.length + 1}) AS below
           FROM job_postings WHERE ${s.where.join(' AND ')}`,
        [...s.params, expected],
      ).catch(() => [] as never[]);
      const n = Number(r?.n ?? 0);
      if (n < 8) continue;
      const percent = Math.round((Number(r.below) / n) * 100);
      const advice =
        percent >= 85 ? 'Mong muốn của bạn thuộc nhóm cao nhất — số tin phù hợp sẽ ít hơn; cân nhắc nhấn mạnh kinh nghiệm/thành tích.'
        : percent >= 60 ? 'Mong muốn hơi cao hơn mặt bằng nhưng vẫn hợp lý nếu bạn có kinh nghiệm nổi bật.'
        : percent >= 25 ? 'Mong muốn nằm trong vùng phổ biến — dễ tìm được tin phù hợp.'
        : 'Mong muốn thấp hơn đa số tin; bạn có thể kỳ vọng cao hơn khi thương lượng.';
      return { hasProfile: true, expected, scope: s.label, sample: n, p25: +Number(r.p25).toFixed(1), median: +Number(r.med).toFixed(1), p75: +Number(r.p75).toFixed(1), percent, advice };
    }
    return { hasProfile: true, expected, sample: 0 };
  }

  // (5) Mục tiêu nộp đơn theo tuần + chuỗi tuần liên tiếp.
  async jobGoal(userId: string) {
    const p = await this.profileRepo.findOne({ where: { userId } });
    if (!p) return { hasProfile: false };
    const start = mondayVN(new Date());
    const from = new Date(start.getTime() - 7 * 7 * 86400_000);
    const rows = await this.q<{ applied_at: Date }>(
      `SELECT a.applied_at FROM applications a JOIN cvs cv ON cv.id = a.cv_id
        WHERE cv.candidate_profile_id = $1 AND a.deleted_at IS NULL AND a.applied_at >= $2`,
      [p.id, from],
    );
    const weeks: number[] = Array(8).fill(0);
    for (const r of rows) {
      const i = Math.floor((mondayVN(new Date(r.applied_at)).getTime() - from.getTime()) / (7 * 86400_000));
      if (i >= 0 && i < 8) weeks[i]++;
    }
    const thisWeek = weeks[7];
    let streak = 0;
    for (let i = thisWeek > 0 ? 7 : 6; i >= 0 && weeks[i] > 0; i--) streak++;
    return { hasProfile: true, thisWeek, weeks, streak };
  }

  // (6) Cảnh báo nộp trùng: đã nộp tin gần giống cùng công ty trong 30 ngày.
  async applyCheck(userId: string, jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    const p = await this.profileRepo.findOne({ where: { userId } });
    if (!p) return { similar: [] };
    const rows = await this.q<{ id: string; title: string; applied_at: Date; status: string }>(
      `SELECT j.id, j.title, a.applied_at, a.status FROM applications a
         JOIN cvs cv ON cv.id = a.cv_id JOIN job_postings j ON j.id = a.job_posting_id
        WHERE cv.candidate_profile_id = $1 AND j.company_id = $2 AND j.id <> $3 AND a.deleted_at IS NULL
          AND a.applied_at >= now() - interval '30 days'`,
      [p.id, job.companyId, jobId],
    );
    const tok = (s: string) => new Set(fold(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w)));
    const a = tok(job.title);
    const similar = rows
      .map((r) => {
        const b = tok(r.title);
        const inter = [...a].filter((x) => b.has(x)).length;
        const overlap = inter / Math.max(1, Math.min(a.size, b.size));
        return { jobId: r.id, title: r.title, appliedAt: r.applied_at, status: r.status, overlap };
      })
      .filter((x) => x.overlap >= 0.6)
      .slice(0, 3);
    return { similar };
  }
}
