import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobPosting } from '../database/entities/job-posting.entity';
import { CvSearchService } from '../cv-search/cv-search.service';
import { assessJobRisk, fold } from '../admin/job-risk';
import { assertPublicHttpUrl } from '../common/public-url.util';

const FREE_MAIL = new Set(['gmail.com', 'yahoo.com', 'yahoo.com.vn', 'hotmail.com', 'outlook.com', 'live.com', 'icloud.com', 'mail.com', 'proton.me', 'protonmail.com', 'yandex.com']);

// Đợt 75 — tính năng thông minh cho nhà tuyển dụng (7–10) và admin (12). Quy tắc thuần, không AI trả phí.
@Injectable()
export class Smart4Service {
  constructor(
    @InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>,
    private readonly cvSearch: CvSearchService,
  ) {}

  private q<T>(sql: string, p: unknown[] = []) {
    return this.jobRepo.manager.query(sql, p) as Promise<T[]>;
  }

  private async companyId(userId: string): Promise<string> {
    const [r] = await this.q<{ company_id: string }>(`SELECT company_id FROM company_users WHERE user_id = $1 LIMIT 1`, [userId]);
    if (!r) throw new NotFoundException('Bạn chưa thuộc công ty nào');
    return r.company_id;
  }

  // (7) Hồ sơ chờ phản hồi quá N ngày — để trả lời nhanh.
  async pendingApplications(userId: string, days = 3) {
    const cid = await this.companyId(userId);
    const d = Math.min(30, Math.max(1, Number(days) || 3));
    const rows = await this.q<{ id: string; name: string; title: string; job_id: string; applied_at: Date }>(
      `SELECT a.id, p.full_name AS name, j.title, j.id AS job_id, a.applied_at
         FROM applications a
         JOIN job_postings j ON j.id = a.job_posting_id
         JOIN cvs cv ON cv.id = a.cv_id
         LEFT JOIN candidate_profiles p ON p.id = cv.candidate_profile_id
        WHERE j.company_id = $1 AND a.status = 'new' AND a.deleted_at IS NULL
          AND a.applied_at < now() - ($2 || ' days')::interval AND a.applied_at > now() - interval '60 days'
        ORDER BY a.applied_at ASC LIMIT 30`,
      [cid, String(d)],
    );
    const [c] = await this.q<{ n: string }>(
      `SELECT COUNT(*) AS n FROM applications a JOIN job_postings j ON j.id = a.job_posting_id
        WHERE j.company_id = $1 AND a.status = 'new' AND a.deleted_at IS NULL AND a.applied_at < now() - ($2 || ' days')::interval AND a.applied_at > now() - interval '60 days'`,
      [cid, String(d)],
    );
    return {
      days: d,
      total: Number(c?.n ?? 0),
      items: rows.map((r) => ({ id: r.id, name: r.name ?? 'Ứng viên', jobId: r.job_id, jobTitle: r.title, waitDays: Math.floor((Date.now() - new Date(r.applied_at).getTime()) / 86400000) })),
    };
  }

  // (8) Hiệu quả từng tin đang hiển thị: lượt xem 14 ngày, số đơn, ngày còn lại + lời khuyên.
  async jobPerformance(userId: string) {
    const cid = await this.companyId(userId);
    const rows = await this.q<{ id: string; title: string; deadline: string | null; views: string; apps: string; age: string }>(
      `SELECT j.id, j.title, j.deadline,
              (SELECT COUNT(*) FROM analytics_pageviews pv WHERE pv.entity_type = 'job' AND pv.entity_id::text = j.id::text AND pv.started_at >= now() - interval '14 days') AS views,
              (SELECT COUNT(*) FROM applications a WHERE a.job_posting_id = j.id AND a.deleted_at IS NULL) AS apps,
              EXTRACT(DAY FROM now() - j.created_at) AS age
         FROM job_postings j
        WHERE j.company_id = $1 AND j.approval_status = 'approved' AND j.is_paused = false
        ORDER BY j.created_at DESC LIMIT 20`,
      [cid],
    );
    const items = rows.map((r) => {
      const views = Number(r.views);
      const apps = Number(r.apps);
      const daysLeft = r.deadline ? Math.ceil((new Date(r.deadline).getTime() - Date.now()) / 86400000) : null;
      const rate = views > 0 ? (apps / views) * 100 : 0;
      let advice = 'Đang ổn định.';
      let level: 'good' | 'warn' | 'bad' = 'good';
      if (daysLeft != null && daysLeft <= 3) { advice = `Tin còn ${Math.max(0, daysLeft)} ngày — gia hạn để không mất lượt hiển thị.`; level = 'warn'; }
      else if (views >= 30 && apps === 0) { advice = 'Nhiều người xem nhưng chưa ai nộp: xem lại mức lương, yêu cầu hoặc tiêu đề.'; level = 'bad'; }
      else if (views < 10 && Number(r.age) >= 5) { advice = 'Ít lượt xem: thử đổi tiêu đề (A/B) hoặc bổ sung lương/địa điểm cụ thể.'; level = 'warn'; }
      else if (views >= 30 && rate < 2) { advice = 'Tỷ lệ nộp thấp (<2%): rút gọn yêu cầu, ghi rõ quyền lợi.'; level = 'warn'; }
      return { id: r.id, title: r.title, views, applications: apps, rate: +rate.toFixed(1), daysLeft, advice, level };
    });
    return { items };
  }

  async extendJob(userId: string, jobId: string, days: number) {
    const cid = await this.companyId(userId);
    const d = Math.min(60, Math.max(1, Number(days) || 15));
    const job = await this.jobRepo.findOne({ where: { id: jobId, companyId: cid } });
    if (!job) throw new NotFoundException('Không tìm thấy tin của công ty bạn');
    const base = job.deadline && new Date(job.deadline) > new Date() ? new Date(job.deadline) : new Date();
    base.setDate(base.getDate() + d);
    const deadline = base.toISOString().slice(0, 10);
    await this.jobRepo.update({ id: jobId }, { deadline });
    return { deadline };
  }

  // (9) A/B tiêu đề — bảng job_title_tests tạo bằng migration 1789967000000.
  async startTitleTest(userId: string, jobId: string, titleB: string) {
    const cid = await this.companyId(userId);
    const job = await this.jobRepo.findOne({ where: { id: jobId, companyId: cid } });
    if (!job) throw new NotFoundException('Không tìm thấy tin của công ty bạn');
    const t = (titleB ?? '').trim().replace(/\s+/g, ' ');
    if (t.length < 8 || t.length > 120) throw new BadRequestException('Tiêu đề thử nghiệm dài 8–120 ký tự');
    if (fold(t) === fold(job.title)) throw new BadRequestException('Tiêu đề B phải khác tiêu đề hiện tại');
    const base = { id: job.id, companyId: cid, description: job.description, requirements: job.requirements, salaryMin: job.salaryMin, salaryMax: job.salaryMax, contactEmail: job.contactEmail, contactPhone: job.contactPhone };
    if (assessJobRisk({ ...base, title: t }, { others: [] }).score > assessJobRisk({ ...base, title: job.title }, { others: [] }).score)
      throw new BadRequestException('Tiêu đề B chứa nội dung bị hệ thống đánh giá rủi ro, vui lòng viết lại');
    const [run] = await this.q<{ id: string }>(`SELECT id FROM job_title_tests WHERE job_id = $1 AND status = 'running'`, [jobId]);
    if (run) throw new BadRequestException('Tin này đang có một thử nghiệm, hãy kết thúc trước');
    await this.q(`INSERT INTO job_title_tests (job_id, company_id, title_a, title_b) VALUES ($1,$2,$3,$4)`, [jobId, cid, job.title, t]);
    return this.getTitleTest(userId, jobId);
  }

  async getTitleTest(userId: string, jobId: string) {
    const cid = await this.companyId(userId);
    const [r] = await this.q<Record<string, unknown>>(
      `SELECT * FROM job_title_tests WHERE job_id = $1 AND company_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [jobId, cid],
    );
    if (!r) return { test: null };
    const n = (k: string) => Number(r[k] ?? 0);
    const ctr = (c: number, v: number) => (v > 0 ? +((c / v) * 100).toFixed(1) : 0);
    const a = { title: r.title_a as string, views: n('views_a'), clicks: n('clicks_a'), ctr: ctr(n('clicks_a'), n('views_a')) };
    const b = { title: r.title_b as string, views: n('views_b'), clicks: n('clicks_b'), ctr: ctr(n('clicks_b'), n('views_b')) };
    const enough = a.views >= 100 && b.views >= 100;
    const leader = a.ctr === b.ctr ? null : a.ctr > b.ctr ? 'a' : 'b';
    return { test: { id: r.id as string, status: r.status as string, winner: (r.winner as string) ?? null, a, b, enough, leader } };
  }

  async finishTitleTest(userId: string, jobId: string, apply: boolean) {
    const cur = await this.getTitleTest(userId, jobId);
    if (!cur.test || cur.test.status !== 'running') throw new BadRequestException('Không có thử nghiệm đang chạy');
    const t = cur.test;
    const winner = t.leader ?? 'a';
    await this.q(`UPDATE job_title_tests SET status = 'done', winner = $2, ended_at = now() WHERE id = $1`, [t.id, winner]);
    if (apply && winner === 'b') await this.jobRepo.update({ id: jobId }, { title: t.b.title });
    return this.getTitleTest(userId, jobId);
  }

  // Công khai: các tin đang thử nghiệm trong danh sách hiện tại.
  async publicTests(ids: string[]) {
    const list = ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 60);
    if (!list.length) return { items: [] };
    const rows = await this.q<{ id: string; job_id: string; title_a: string; title_b: string }>(
      `SELECT id, job_id, title_a, title_b FROM job_title_tests WHERE status = 'running' AND job_id = ANY($1::uuid[])`,
      [list],
    );
    return { items: rows.map((r) => ({ testId: r.id, jobId: r.job_id, a: r.title_a, b: r.title_b })) };
  }

  async recordTestEvent(testId: string, variant: string, type: string) {
    if (!/^[0-9a-f-]{36}$/i.test(testId) || !['a', 'b'].includes(variant) || !['view', 'click'].includes(type)) return { ok: false };
    const col = `${type === 'view' ? 'views' : 'clicks'}_${variant}`;
    await this.q(`UPDATE job_title_tests SET ${col} = ${col} + 1 WHERE id = $1 AND status = 'running'`, [testId]);
    return { ok: true };
  }

  // (10) Mời hàng loạt các hồ sơ gợi ý hàng đầu kèm lời nhắn cá nhân hoá.
  async bulkInvite(userId: string, jobId: string, profileIds: string[]) {
    const ids = [...new Set(profileIds ?? [])].slice(0, 10);
    if (!ids.length) throw new BadRequestException('Chưa chọn hồ sơ nào');
    const { items } = await this.cvSearch.suggestForJob(userId, jobId, 10);
    const byId = new Map(items.map((i) => [i.id as string, i as unknown as { id: string; fullName: string; match: { reasons: string[] } }]));
    let sent = 0;
    for (const id of ids) {
      const it = byId.get(id);
      if (!it) continue;
      const first = (it.fullName ?? '').trim().split(/\s+/).slice(-1)[0] || 'bạn';
      const why = it.match.reasons.slice(0, 2).join(', ');
      await this.cvSearch.inviteToApply(userId, id, jobId, `Chào ${first}, hồ sơ của bạn khớp với vị trí này${why ? ` (${why})` : ''}. Mong bạn xem và ứng tuyển.`);
      sent++;
    }
    return { sent, skipped: ids.length - sent };
  }

  // (12) Trợ lý kiểm tra nhanh công ty chờ duyệt — chỉ là gợi ý, Admin vẫn quyết định.
  async companyVerifyCheck(companyId: string) {
    const [c] = await this.q<{ id: string; name: string; tax_code: string | null; website: string | null; description: string | null; address: string | null; legal_doc: string | null }>(
      `SELECT id, name, tax_code, website, description, address, COALESCE(legal_doc_storage_key, legal_doc_external_link, legal_doc_url, CASE WHEN legal_doc_data IS NOT NULL THEN 'data' END) AS legal_doc FROM companies WHERE id = $1`,
      [companyId],
    );
    if (!c) throw new NotFoundException('Không tìm thấy công ty');
    const checks: { key: string; ok: boolean | null; label: string; points: number }[] = [];
    const tax = (c.tax_code ?? '').replace(/[\s.-]/g, '');
    checks.push({ key: 'tax', ok: /^\d{10}(\d{3})?$/.test(tax), label: /^\d{10}(\d{3})?$/.test(tax) ? 'Mã số thuế đúng định dạng 10/13 số (chưa tra cứu cơ quan thuế)' : 'Mã số thuế không đúng định dạng 10 hoặc 13 số', points: 25 });
    checks.push({ key: 'doc', ok: !!c.legal_doc, label: c.legal_doc ? 'Có tài liệu pháp lý đính kèm' : 'Chưa có tài liệu pháp lý', points: 20 });
    checks.push({ key: 'desc', ok: (c.description ?? '').replace(/<[^>]*>/g, '').trim().length >= 80 && !!c.address, label: (c.description ?? '').length >= 80 && c.address ? 'Có mô tả và địa chỉ đầy đủ' : 'Thiếu mô tả hoặc địa chỉ', points: 10 });

    // Website truy cập được?
    let webOk: boolean | null = null;
    if (c.website) {
      try {
        const u = await assertPublicHttpUrl(/^https?:\/\//i.test(c.website) ? c.website : `https://${c.website}`);
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(u, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VerifyBot)' } }).finally(() => clearTimeout(t));
        webOk = res.status < 400;
      } catch {
        webOk = false;
      }
    }
    checks.push({ key: 'web', ok: webOk, label: webOk === null ? 'Không khai báo website' : webOk ? 'Website truy cập được' : 'Website không truy cập được', points: 15 });

    // Email: tên miền riêng hay miễn phí, có khớp website?
    const emails = await this.q<{ email: string }>(`SELECT u.email FROM company_users cu JOIN users u ON u.id = cu.user_id WHERE cu.company_id = $1`, [companyId]);
    const domains = emails.map((e) => e.email.split('@')[1]?.toLowerCase()).filter(Boolean) as string[];
    const corp = domains.some((d) => !FREE_MAIL.has(d));
    const webHost = c.website ? c.website.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase() : null;
    const match = !!webHost && domains.some((d) => d === webHost || webHost.endsWith(`.${d}`));
    checks.push({ key: 'mail', ok: corp, label: corp ? (match ? 'Email công ty khớp tên miền website' : 'Dùng email tên miền riêng') : 'Chỉ dùng email miễn phí (Gmail, Yahoo…)', points: 15 });

    // Trùng lặp
    const dup = await this.q<{ id: string; name: string; why: string }>(
      `SELECT id, name, CASE WHEN regexp_replace(tax_code,'\\D','','g') = $2 AND $2 <> '' THEN 'Trùng mã số thuế' ELSE 'Trùng/na ná tên công ty' END AS why
         FROM companies WHERE id <> $1 AND (
           (regexp_replace(tax_code,'\\D','','g') = $2 AND $2 <> '') OR lower(regexp_replace(name,'[^[:alnum:]]','','g')) = $3
         ) LIMIT 5`,
      [companyId, tax, fold(c.name).replace(/ /g, '')],
    ).catch(() => []);
    checks.push({ key: 'dup', ok: dup.length === 0, label: dup.length ? `Có ${dup.length} công ty trùng thông tin` : 'Không trùng công ty khác', points: 15 });

    // Rủi ro tin đã đăng
    const [risk] = await this.q<{ n: string }>(`SELECT COUNT(*) AS n FROM job_reports r JOIN job_postings j ON j.id = r.job_id WHERE j.company_id = $1`, [companyId]).catch(() => [{ n: '0' }]);
    const reports = Number(risk?.n ?? 0);
    checks.push({ key: 'reports', ok: reports === 0, label: reports ? `Tin của công ty đã bị báo cáo ${reports} lần` : 'Chưa có báo cáo vi phạm', points: 0 });

    const score = Math.min(100, checks.reduce((s, x) => s + (x.ok ? x.points : 0), 0) + (match ? 5 : 0) - (reports ? 15 : 0));
    const level = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
    return { score: Math.max(0, score), level, checks, duplicates: dup.map((d) => ({ id: d.id, name: d.name, why: d.why })) };
  }
}
