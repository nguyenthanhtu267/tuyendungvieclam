import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { In, Repository } from 'typeorm';
import { JobApprovalStatus, JobPosting } from '../database/entities/job-posting.entity';
import { CandidateProfile } from '../database/entities/candidate-profile.entity';
import { CandidateSkill, CandidateExperience, CandidateEducation, CandidateCertificate } from '../database/entities/candidate-sections.entity';
import { Application } from '../database/entities/application.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { JobReport } from '../database/entities/job-report.entity';
import { scoreMatch } from '../jobs/job-match';
import { fold } from '../admin/job-risk';

const CERTS: { name: string; re: string }[] = [
  { name: 'IELTS', re: 'ielts' },
  { name: 'TOEIC', re: 'toeic' },
  { name: 'HSK (tiếng Trung)', re: 'hsk' },
  { name: 'JLPT (tiếng Nhật)', re: 'jlpt|n[1-3] ' },
  { name: 'MOS / Tin học văn phòng', re: '\\mmos\\M|tin hoc van phong|tin học văn phòng' },
  { name: 'ACCA', re: '\\macca\\M' },
  { name: 'CPA / Chứng chỉ kế toán', re: '\\mcpa\\M|chứng chỉ kế toán|chung chi ke toan' },
  { name: 'PMP / Quản lý dự án', re: '\\mpmp\\M|prince2' },
  { name: 'Scrum / Agile', re: 'scrum|agile' },
  { name: 'AWS / Cloud', re: '\\maws\\M|azure|google cloud' },
  { name: 'CCNA / Mạng', re: 'ccna|ccnp' },
  { name: 'Google Ads / Analytics', re: 'google ads|google analytics' },
  { name: 'Chứng chỉ hành nghề', re: 'chứng chỉ hành nghề|chung chi hanh nghe' },
  { name: 'Bằng lái xe', re: 'bằng lái|bang lai|gplx' },
];

const REASONS: Record<string, string> = { scam: 'scam', duplicate: 'duplicate', expired: 'expired', wrong_info: 'wrong_info', discrimination: 'discrimination', other: 'other' };

// Đợt 65 — nhóm tính năng thông minh thứ 3.
@Injectable()
export class Smart2Service {
  constructor(
    @InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>,
    @InjectRepository(CandidateProfile) private readonly profileRepo: Repository<CandidateProfile>,
    @InjectRepository(CandidateSkill) private readonly skillRepo: Repository<CandidateSkill>,
    @InjectRepository(CandidateCertificate) private readonly certRepo: Repository<CandidateCertificate>,
    @InjectRepository(CandidateExperience) private readonly expRepo: Repository<CandidateExperience>,
    @InjectRepository(CandidateEducation) private readonly eduRepo: Repository<CandidateEducation>,
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
    @InjectRepository(CompanyUser) private readonly companyUserRepo: Repository<CompanyUser>,
    @InjectRepository(JobReport) private readonly reportRepo: Repository<JobReport>,
    private readonly jwt: JwtService,
  ) {}

  private q<T>(sql: string, p: unknown[] = []) {
    return this.jobRepo.manager.query(sql, p) as Promise<T[]>;
  }

  // (2) Chứng chỉ/khoá học nên có: tần suất xuất hiện trong tin cùng ngành mà ứng viên chưa có.
  async certificateDemand(userId: string, jobId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    const profile = await this.profileRepo.findOne({ where: { userId } });
    const have = profile ? (await this.certRepo.find({ where: { candidateProfileId: profile.id } })).map((c) => fold(c.name)) : [];
    const cols = CERTS.map((c, i) => `COUNT(*) FILTER (WHERE txt ~* '${c.re.replace(/'/g, "''")}') AS c${i}`).join(', ');
    const rows = await this.q<Record<string, string>>(
      `SELECT COUNT(*) AS total, ${cols} FROM (
         SELECT lower(coalesce(description,'') || ' ' || coalesce(requirements,'')) AS txt
           FROM job_postings WHERE approval_status='approved' ${job.industry ? 'AND industry = $1' : ''}
       ) t`,
      job.industry ? [job.industry] : [],
    );
    const r = rows[0];
    const total = Number(r?.total ?? 0);
    if (total < 10) return { items: [], total };
    const items = CERTS.map((c, i) => ({ name: c.name, jobs: Number(r[`c${i}`] ?? 0), key: fold(c.name.split(' ')[0]) }))
      .filter((c) => c.jobs >= 2 && !have.some((h) => h.includes(c.key)))
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, 4)
      .map(({ name, jobs }) => ({ name, jobs, percent: Math.round((jobs / total) * 100) }));
    return { items, total, industry: job.industry ?? null };
  }

  // (5) Ước tính thời gian có phỏng vấn từ lịch sử đơn thật trên web.
  async applicationEta(userId: string) {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) return { enough: false };
    const [g] = await this.q<{ n: string; interviews: string; med_days: string | null }>(
      `SELECT COUNT(*) AS n,
              COUNT(*) FILTER (WHERE a.status = 'interview') AS interviews,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (h.created_at - a.applied_at))/86400.0) FILTER (WHERE h.created_at IS NOT NULL) AS med_days
         FROM applications a
         LEFT JOIN LATERAL (SELECT created_at FROM application_status_histories x WHERE x.application_id = a.id AND x.status = 'interview' ORDER BY created_at LIMIT 1) h ON true
        WHERE a.deleted_at IS NULL AND a.applied_at >= now() - interval '180 days' AND a.applied_at < now() - interval '3 days'`,
    );
    const n = Number(g?.n ?? 0);
    if (n < 20) return { enough: false };
    const rate = Number(g.interviews) / n;
    const pending = await this.q<{ c: string }>(
      `SELECT COUNT(*) AS c FROM applications a JOIN cvs cv ON cv.id = a.cv_id
        WHERE cv.candidate_profile_id = $1 AND a.status IN ('new','reviewing') AND a.deleted_at IS NULL`,
      [profile.id],
    );
    const pend = Number(pending[0]?.c ?? 0);
    const expected = +(pend * rate).toFixed(1);
    const needed = rate > 0 ? Math.ceil(1 / rate) : null;
    return {
      enough: true,
      sample: n,
      interviewRate: Math.round(rate * 100),
      medianDays: g.med_days == null ? null : Math.max(1, Math.round(Number(g.med_days))),
      pending: pend,
      expectedInterviews: expected,
      applicationsForOne: needed,
    };
  }

  // (6) Link chia sẻ hồ sơ tóm tắt: token ký, hết hạn sau 14 ngày, KHÔNG chứa thông tin liên hệ.
  async createShareLink(userId: string) {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) throw new BadRequestException('Bạn chưa có hồ sơ để chia sẻ');
    const token = await this.jwt.signAsync({ purpose: 'profile-share', pid: profile.id }, { expiresIn: '14d' });
    return { token, days: 14 };
  }

  async sharedProfile(token: string) {
    let payload: { purpose?: string; pid?: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new NotFoundException('Liên kết đã hết hạn hoặc không hợp lệ');
    }
    if (payload.purpose !== 'profile-share' || !payload.pid) throw new NotFoundException('Liên kết không hợp lệ');
    const p = await this.profileRepo.findOne({ where: { id: payload.pid } });
    if (!p) throw new NotFoundException('Không tìm thấy hồ sơ');
    const [skills, exps, edus] = await Promise.all([
      this.skillRepo.find({ where: { candidateProfileId: p.id } }),
      this.expRepo.find({ where: { candidateProfileId: p.id }, order: { startDate: 'DESC' }, take: 4 }),
      this.eduRepo.find({ where: { candidateProfileId: p.id }, order: { startDate: 'DESC' }, take: 2 }),
    ]);
    return {
      fullName: p.fullName,
      title: p.profileTitle ?? p.desiredPosition ?? null,
      province: p.province ?? null,
      yearsOfExperience: p.yearsOfExperience ?? null,
      desiredLevel: p.desiredLevel ?? null,
      skills: skills.map((s) => s.skillName).slice(0, 15),
      experiences: exps.map((e) => ({ position: e.position, company: e.companyName ?? null, from: e.startDate ?? null, to: e.isCurrent ? 'Hiện tại' : e.endDate ?? null })),
      educations: edus.map((e) => ({ school: e.schoolName ?? null, major: e.major ?? null, degree: e.degree ?? null })),
    };
  }

  // (11) Ứng viên cũ của công ty (tin khác) phù hợp tin này, chưa nộp vào tin này.
  async reinvite(userId: string, jobId: string) {
    const link = await this.companyUserRepo.findOne({ where: { userId } });
    if (!link) return { items: [] };
    const job = await this.jobRepo.findOne({ where: { id: jobId, companyId: link.companyId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin của công ty bạn');
    const rows = await this.q<{ pid: string; app_id: string; old_title: string; status: string; rating: number | null }>(
      `SELECT DISTINCT ON (cv.candidate_profile_id) cv.candidate_profile_id AS pid, a.id AS app_id, j.title AS old_title, a.status, a.rating
         FROM applications a
         JOIN job_postings j ON j.id = a.job_posting_id
         JOIN cvs cv ON cv.id = a.cv_id
        WHERE j.company_id = $1 AND j.id <> $2 AND a.deleted_at IS NULL AND cv.candidate_profile_id IS NOT NULL
          AND (a.status IN ('suitable','interview','reviewing') OR COALESCE(a.rating,0) >= 4)
          AND NOT EXISTS (SELECT 1 FROM applications b JOIN cvs c2 ON c2.id = b.cv_id WHERE b.job_posting_id = $2 AND c2.candidate_profile_id = cv.candidate_profile_id)
        ORDER BY cv.candidate_profile_id, a.applied_at DESC LIMIT 60`,
      [link.companyId, jobId],
    );
    if (!rows.length) return { items: [] };
    const profiles = await this.profileRepo.find({ where: { id: In(rows.map((r) => r.pid)) }, relations: { skills: true } });
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const out = rows
      .map((r) => {
        const p = byId.get(r.pid);
        if (!p) return null;
        const m = scoreMatch({ ...p, skillNames: (p.skills ?? []).map((s) => s.skillName) }, job);
        return { profileId: p.id, name: p.fullName, title: p.profileTitle ?? p.desiredPosition ?? null, score: m.score, reasons: m.reasons, oldJob: r.old_title, oldStatus: r.status };
      })
      .filter((x): x is NonNullable<typeof x> => !!x && x.score >= 60)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    return { items: out };
  }

  // (8)+(12) Khung giờ/ngày tốt để đăng + so sánh tin đối thủ cùng ngành.
  async postingInsights(q: { industry?: string; level?: string; province?: string }) {
    let bestTime: { hours: number[]; days: string[]; sample: number; scope: string } | null = null;
    if (q.industry) {
      const run = async (byIndustry: boolean) =>
        this.q<{ h: string; d: string; c: string }>(
          `SELECT EXTRACT(HOUR FROM pv.started_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS h,
                  EXTRACT(DOW FROM pv.started_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS d, COUNT(*) AS c
             FROM analytics_pageviews pv ${byIndustry ? `JOIN job_postings j ON j.id::text = pv.entity_id::text AND j.industry = $1` : ''}
            WHERE pv.entity_type = 'job' AND pv.started_at >= now() - interval '30 days'
            GROUP BY 1, 2`,
          byIndustry ? [q.industry] : [],
        );
      type Row = { h: string; d: string; c: string };
      let rows: Row[] = await run(true).catch(() => [] as Row[]);
      let scope = q.industry!;
      let sample = rows.reduce((s: number, r: Row) => s + Number(r.c), 0);
      if (sample < 60) { rows = await run(false).catch(() => [] as Row[]); scope = 'toàn website'; sample = rows.reduce((s: number, r: Row) => s + Number(r.c), 0); }
      if (sample >= 60) {
        const byH = new Map<number, number>();
        const byD = new Map<number, number>();
        rows.forEach((r) => { byH.set(Number(r.h), (byH.get(Number(r.h)) ?? 0) + Number(r.c)); byD.set(Number(r.d), (byD.get(Number(r.d)) ?? 0) + Number(r.c)); });
        const DAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        bestTime = {
          hours: [...byH.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]).sort((a, b) => a - b),
          days: [...byD.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => DAYS[x[0]]),
          sample,
          scope,
        };
      }
    }
    let competitors: { title: string; company: string; salaryMin: number | null; salaryMax: number | null; benefitCount: number; deadline: string | null }[] = [];
    if (q.industry) {
      const rows = await this.q<{ title: string; company: string; salary_min: number | null; salary_max: number | null; benefits: string | null; deadline: string | null }>(
        `SELECT j.title, c.name AS company, j.salary_min, j.salary_max, j.benefits, j.deadline::text AS deadline
           FROM job_postings j JOIN companies c ON c.id = j.company_id
          WHERE j.approval_status = 'approved' AND j.is_paused = false AND j.industry = $1
            ${q.level ? 'AND j.level = $2' : ''} ${q.province ? `AND $${q.level ? 3 : 2} = ANY(string_to_array(j.provinces, ','))` : ''}
            AND (j.deadline IS NULL OR j.deadline >= current_date)
          ORDER BY (j.salary_max IS NOT NULL) DESC, j.created_at DESC LIMIT 3`,
        [q.industry, ...(q.level ? [q.level] : []), ...(q.province ? [q.province] : [])],
      ).catch(() => []);
      competitors = rows.map((r) => ({
        title: r.title,
        company: r.company,
        salaryMin: r.salary_min,
        salaryMax: r.salary_max,
        benefitCount: (r.benefits ?? '').replace(/<\/?(ul|ol)[^>]*>/g, '').split(/<\/li>|\n/).filter((x) => x.replace(/<[^>]*>/g, '').trim().length > 3).length,
        deadline: r.deadline,
      }));
    }
    return { bestTime, competitors };
  }

  // (14) Báo cáo tin: phân loại tự động theo lý do + từ khoá trong ghi chú
  async createReport(userId: string | null, jobId: string, reason: string, note?: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin');
    const r = REASONS[reason] ?? 'other';
    const text = fold(note ?? '');
    let category = r;
    if (r === 'other' || r === 'wrong_info') {
      if (/dat coc|nop phi|lua dao|chuyen khoan|thu tien|da cap/.test(text)) category = 'scam';
      else if (/trung|copy|giong tin/.test(text)) category = 'duplicate';
      else if (/het han|da tuyen|dong tin|khong con tuyen/.test(text)) category = 'expired';
      else if (/gioi tinh|tuoi|ngoai hinh|phan biet/.test(text)) category = 'discrimination';
    }
    if (userId) {
      const dup = await this.reportRepo.exists({ where: { jobPostingId: jobId, reporterUserId: userId, status: 'open' } });
      if (dup) throw new BadRequestException('Bạn đã báo cáo tin này, chúng tôi đang xử lý');
    }
    const open = await this.reportRepo.count({ where: { jobPostingId: jobId, status: 'open' } });
    const priority = category === 'scam' || open >= 2 ? 'high' : 'normal';
    await this.reportRepo.save(this.reportRepo.create({ jobPostingId: jobId, reporterUserId: userId, reason: r, note: note?.slice(0, 1000) ?? null, category, priority }));
    return { ok: true };
  }

  async listReports() {
    const rows = await this.q<{ job_id: string; title: string; company: string | null; n: string; cats: string[]; high: boolean; last_at: string; notes: string[] }>(
      `SELECT r.job_posting_id AS job_id, j.title, c.name AS company, COUNT(*) AS n,
              array_agg(DISTINCT r.category) AS cats, bool_or(r.priority = 'high') AS high, MAX(r.created_at) AS last_at,
              (array_agg(r.note ORDER BY r.created_at DESC) FILTER (WHERE r.note IS NOT NULL))[1:3] AS notes
         FROM job_reports r JOIN job_postings j ON j.id = r.job_posting_id LEFT JOIN companies c ON c.id = j.company_id
        WHERE r.status = 'open' GROUP BY r.job_posting_id, j.title, c.name
        ORDER BY bool_or(r.priority = 'high') DESC, COUNT(*) DESC, MAX(r.created_at) DESC LIMIT 100`,
    );
    return { items: rows.map((r) => ({ jobId: r.job_id, title: r.title, company: r.company ?? '', count: Number(r.n), categories: r.cats, priority: r.high || Number(r.n) >= 3 ? 'high' : 'normal', lastAt: r.last_at, notes: r.notes ?? [] })) };
  }

  async resolveReports(jobId: string) {
    await this.reportRepo.update({ jobPostingId: jobId, status: 'open' }, { status: 'resolved' });
    return { ok: true };
  }

  // (13) Báo cáo tuần: tuần này so với tuần trước
  async weeklyReport() {
    const one = async (sql: string) => {
      const r = await this.q<{ cur: string; prev: string }>(sql).catch(() => [{ cur: '0', prev: '0' }]);
      return { cur: Number(r[0]?.cur ?? 0), prev: Number(r[0]?.prev ?? 0) };
    };
    const rng = (col: string, tbl: string, where = '') =>
      `SELECT COUNT(*) FILTER (WHERE ${col} >= now() - interval '7 days') AS cur, COUNT(*) FILTER (WHERE ${col} < now() - interval '7 days' AND ${col} >= now() - interval '14 days') AS prev FROM ${tbl} ${where ? 'WHERE ' + where : ''}`;
    const metrics = [
      { key: 'candidates', label: 'Ứng viên đăng ký mới', ...(await one(rng('created_at', 'users', `role = 'candidate'`))) },
      { key: 'employers', label: 'Nhà tuyển dụng đăng ký mới', ...(await one(rng('created_at', 'users', `role IN ('employer_main','employer_sub')`))) },
      { key: 'jobs', label: 'Tin tuyển dụng mới', ...(await one(rng('created_at', 'job_postings'))) },
      { key: 'apps', label: 'Đơn ứng tuyển', ...(await one(rng('applied_at', 'applications'))) },
      { key: 'views', label: 'Lượt xem tin', ...(await one(rng('started_at', 'analytics_pageviews', `entity_type = 'job'`))) },
      {
        key: 'adclicks',
        label: 'Lượt bấm banner',
        ...(await one(`SELECT COALESCE(SUM(clicks) FILTER (WHERE day >= current_date - 6), 0) AS cur, COALESCE(SUM(clicks) FILTER (WHERE day < current_date - 6 AND day >= current_date - 13), 0) AS prev FROM ad_campaign_stats`)),
      },
    ];
    const withDelta = metrics.map((m) => ({ ...m, changePct: m.prev > 0 ? Math.round(((m.cur - m.prev) / m.prev) * 100) : m.cur > 0 ? 100 : 0 }));
    const notes = withDelta.filter((m) => Math.abs(m.changePct) >= 40 && Math.max(m.cur, m.prev) >= 10).map((m) => `${m.label} ${m.changePct > 0 ? 'tăng' : 'giảm'} ${Math.abs(m.changePct)}% so với tuần trước (${m.prev} → ${m.cur}).`);
    return { metrics: withDelta, notes };
  }

  // (15) Gợi ý khu vực đặt banner theo lưu lượng thật 14 ngày
  async adTargeting() {
    const rows = await this.q<{ route: string; role: string; c: string }>(
      `SELECT route, role, COUNT(*) AS c FROM analytics_pageviews WHERE started_at >= now() - interval '14 days' GROUP BY route, role`,
    ).catch(() => []);
    const SLOT: [RegExp, string, string][] = [
      [/^\/$/, 'home-top', 'Trang chủ'],
      [/^\/viec-lam$/, 'jobs-inline / jobs-side-mini', 'Danh sách việc làm'],
      [/^\/viec-lam\/\[id\]$/, 'job-sidebar', 'Chi tiết tin'],
      [/^\/cong-ty/, 'company-sidebar', 'Trang công ty'],
      [/^\/ho-so/, 'candidate-top / candidate-bottom', 'Hồ sơ ứng viên'],
      [/^\/nha-tuyen-dung/, 'employer-top / employer-manage', 'Khu nhà tuyển dụng'],
    ];
    const map = new Map<string, { area: string; slot: string; total: number; candidate: number; employer: number; guest: number }>();
    for (const r of rows) {
      const hit = SLOT.find(([re]) => re.test(r.route));
      if (!hit) continue;
      const e = map.get(hit[1]) ?? { area: hit[2], slot: hit[1], total: 0, candidate: 0, employer: 0, guest: 0 };
      const c = Number(r.c);
      e.total += c;
      if (r.role === 'candidate') e.candidate += c;
      else if (r.role.startsWith('employer')) e.employer += c;
      else e.guest += c;
      map.set(hit[1], e);
    }
    const items = [...map.values()].sort((a, b) => b.total - a.total).map((e) => {
      const top = Math.max(e.candidate, e.employer, e.guest);
      const audience = top === e.employer ? 'nhà tuyển dụng' : top === e.candidate ? 'ứng viên đã đăng nhập' : 'khách chưa đăng nhập';
      return { ...e, audience, suggestion: `Phù hợp banner nhắm ${audience}: ${e.slot}` };
    });
    return { items, since: 14 };
  }
}
