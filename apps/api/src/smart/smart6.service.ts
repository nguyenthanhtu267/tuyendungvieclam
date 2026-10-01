import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobPosting } from '../database/entities/job-posting.entity';
import { assessJobRisk } from '../admin/job-risk';

// Đợt 87 — phễu tuyển dụng, ngân sách gói, điểm "đáng ứng tuyển", tiến trình báo cáo, sức khoẻ web. Quy tắc thuần.
@Injectable()
export class Smart6Service {
  constructor(@InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>) {}

  private q<T>(sql: string, p: unknown[] = []) {
    return this.jobRepo.manager.query(sql, p) as Promise<T[]>;
  }
  private async companyId(userId: string): Promise<string> {
    const [r] = await this.q<{ company_id: string }>(`SELECT company_id FROM company_users WHERE user_id = $1 LIMIT 1`, [userId]);
    if (!r) throw new NotFoundException('Bạn chưa thuộc công ty nào');
    return r.company_id;
  }

  // (8) Phễu: xem → nộp → NTD đã xem → phù hợp → phỏng vấn, cho từng tin đang hiển thị (30 ngày).
  async funnel(userId: string) {
    const cid = await this.companyId(userId);
    const rows = await this.q<{ id: string; title: string; views: string; apps: string; seen: string; suitable: string; interview: string }>(
      `SELECT j.id, j.title,
              (SELECT COUNT(*) FROM analytics_pageviews pv WHERE pv.entity_type = 'job' AND pv.entity_id::text = j.id::text AND pv.started_at >= now() - interval '30 days') AS views,
              COUNT(a.id) AS apps,
              COUNT(a.id) FILTER (WHERE a.viewed_at IS NOT NULL OR a.status <> 'new') AS seen,
              COUNT(a.id) FILTER (WHERE a.status IN ('suitable','interview')) AS suitable,
              COUNT(a.id) FILTER (WHERE a.status = 'interview' OR a.interview_at IS NOT NULL) AS interview
         FROM job_postings j LEFT JOIN applications a ON a.job_posting_id = j.id AND a.deleted_at IS NULL
        WHERE j.company_id = $1 AND j.approval_status = 'approved' AND j.is_paused = false
        GROUP BY j.id, j.title, j.created_at ORDER BY j.created_at DESC LIMIT 15`,
      [cid],
    ).catch(() => []);
    const items = rows.map((r) => {
      const steps = [
        { key: 'views', label: 'Lượt xem', n: Number(r.views) },
        { key: 'apps', label: 'Nộp hồ sơ', n: Number(r.apps) },
        { key: 'seen', label: 'Bạn đã xem', n: Number(r.seen) },
        { key: 'suitable', label: 'Phù hợp', n: Number(r.suitable) },
        { key: 'interview', label: 'Phỏng vấn', n: Number(r.interview) },
      ];
      // bước rớt nhiều nhất (chỉ xét khi bước trước đủ lớn để có ý nghĩa)
      let worst: { from: string; to: string; lost: number } | null = null;
      for (let i = 1; i < steps.length; i++) {
        const prev = steps[i - 1].n;
        if (prev < 5) continue;
        const lost = 1 - steps[i].n / prev;
        if (!worst || lost > worst.lost) worst = { from: steps[i - 1].label, to: steps[i].label, lost };
      }
      const advice: Record<string, string> = {
        'Lượt xem>Nộp hồ sơ': 'Nhiều người xem nhưng ít nộp: xem lại mức lương, yêu cầu, mô tả; ghi rõ quyền lợi.',
        'Nộp hồ sơ>Bạn đã xem': 'Nhiều hồ sơ chưa được xem: vào mục ứng viên xử lý — phản hồi nhanh giúp giữ ứng viên tốt.',
        'Bạn đã xem>Phù hợp': 'Hồ sơ nộp chưa sát yêu cầu: ghi rõ yêu cầu bắt buộc ngay đầu tin để lọc đúng người.',
        'Phù hợp>Phỏng vấn': 'Có người phù hợp nhưng chưa hẹn phỏng vấn: dùng “Mời phỏng vấn hàng loạt”.',
      };
      return {
        id: r.id,
        title: r.title,
        steps,
        worst: worst && worst.lost >= 0.5 ? { ...worst, lostPct: Math.round(worst.lost * 100), advice: advice[`${worst.from}>${worst.to}`] ?? '' } : null,
      };
    });
    return { items };
  }

  // (10) Ngân sách: gói đang dùng, lượt còn lại, ngày hết hạn + ước tính hồ sơ nhận được từ lượt còn lại.
  async budget(userId: string) {
    const cid = await this.companyId(userId);
    const orders = await this.q<{ id: string; name: string; type: string; quantity: number; remaining: number; expires_at: Date | null }>(
      `SELECT o.id, p.name, p.type, o.quantity, o.remaining, o.expires_at
         FROM orders o JOIN service_packages p ON p.id = o.service_package_id
        WHERE o.company_id = $1 AND o.status = 'active' ORDER BY o.expires_at ASC NULLS LAST`,
      [cid],
    ).catch(() => []);
    const [avg] = await this.q<{ jobs: string; apps: string }>(
      `SELECT COUNT(DISTINCT j.id) AS jobs, COUNT(a.id) AS apps FROM job_postings j LEFT JOIN applications a ON a.job_posting_id = j.id AND a.deleted_at IS NULL
        WHERE j.company_id = $1 AND j.created_at >= now() - interval '90 days'`,
      [cid],
    ).catch(() => [{ jobs: '0', apps: '0' }]);
    const jobs = Number(avg?.jobs ?? 0);
    const perJob = jobs >= 2 ? Math.round((Number(avg.apps) / jobs) * 10) / 10 : null;
    const items = orders.map((o) => {
      const days = o.expires_at ? Math.ceil((new Date(o.expires_at).getTime() - Date.now()) / 86400000) : null;
      const warns: string[] = [];
      if (days != null && days <= 7) warns.push(days <= 0 ? 'Gói đã hết hạn' : `Gói còn ${days} ngày — dùng hết lượt trước khi hết hạn`);
      if (o.remaining <= 1 && o.quantity > 1) warns.push(o.remaining <= 0 ? 'Đã hết lượt' : 'Chỉ còn 1 lượt');
      return { id: o.id, name: o.name, type: o.type, quantity: o.quantity, remaining: o.remaining, daysLeft: days, warns, estApplications: perJob != null && o.type !== 'cv_search' ? Math.round(perJob * o.remaining) : null };
    });
    return { items, avgApplicationsPerJob: perJob };
  }

  // (2)+(14) Điểm "tin đáng ứng tuyển": gộp độ tin cậy nội dung, công ty, lương, độ mới, báo cáo.
  async worthScore(jobId: string) {
    const j = await this.jobRepo.findOne({ where: { id: jobId }, relations: { company: true } });
    if (!j) throw new NotFoundException('Không tìm thấy tin');
    const risk = assessJobRisk(j as never, { others: [] });
    const parts: { key: string; label: string; score: number; weight: number; note: string }[] = [];
    parts.push({ key: 'content', label: 'Nội dung tin', weight: 30, score: Math.max(0, 100 - risk.score * 2), note: risk.reasons[0] ?? 'Không thấy dấu hiệu bất thường' });

    const [co] = await this.q<{ total: string; responded: string; approved: string; reports: string }>(
      `SELECT (SELECT COUNT(*) FROM applications a JOIN job_postings x ON x.id = a.job_posting_id WHERE x.company_id = $1 AND a.deleted_at IS NULL AND a.applied_at >= now() - interval '180 days') AS total,
              (SELECT COUNT(*) FROM applications a JOIN job_postings x ON x.id = a.job_posting_id WHERE x.company_id = $1 AND a.deleted_at IS NULL AND a.applied_at >= now() - interval '180 days' AND (a.viewed_at IS NOT NULL OR a.status <> 'new')) AS responded,
              (SELECT COUNT(*) FROM job_postings x WHERE x.company_id = $1 AND x.approval_status = 'approved') AS approved,
              (SELECT COUNT(DISTINCT COALESCE(r.reporter_user_id::text, r.id::text)) FROM job_reports r JOIN job_postings x ON x.id = r.job_posting_id
                WHERE x.company_id = $1 AND r.created_at >= now() - interval '90 days' AND r.reason IN ('scam','wrong_info','discrimination')) AS reports`,
      [j.companyId],
    ).catch(() => [{ total: '0', responded: '0', approved: '0', reports: '0' }]);
    const total = Number(co.total), responded = Number(co.responded), approved = Number(co.approved), reports = Number(co.reports);
    const rate = total >= 5 ? Math.round((responded / total) * 100) : null;
    const hist = Math.min(100, 40 + approved * 6);
    parts.push({ key: 'company', label: 'Công ty & phản hồi', weight: 30, score: rate != null ? Math.round(rate * 0.6 + hist * 0.4) : hist, note: rate != null ? `Phản hồi ${rate}% hồ sơ · ${approved} tin đã đăng` : `${approved} tin đã đăng, chưa đủ dữ liệu phản hồi` });

    const mid = j.salaryMin || j.salaryMax ? ((j.salaryMin ?? j.salaryMax!) + (j.salaryMax ?? j.salaryMin!)) / 2 : null;
    let salScore = 35, salNote = 'Không ghi lương — nên hỏi rõ trước khi ứng tuyển';
    if (mid && j.industry) {
      const [m] = await this.q<{ med: string | null; n: string }>(
        `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (COALESCE(salary_min, salary_max) + COALESCE(salary_max, salary_min)) / 2.0) AS med, COUNT(*) AS n
           FROM job_postings WHERE industry = $1 AND approval_status = 'approved' AND (salary_min IS NOT NULL OR salary_max IS NOT NULL)`,
        [j.industry],
      ).catch(() => [{ med: null, n: '0' }]);
      if (m.med && Number(m.n) >= 5) {
        const ratio = mid / Number(m.med);
        salScore = Math.max(20, Math.min(100, Math.round(60 + (ratio - 1) * 80)));
        salNote = ratio >= 1.05 ? `Cao hơn ~${Math.round((ratio - 1) * 100)}% so với tin cùng ngành` : ratio >= 0.95 ? 'Ngang mặt bằng cùng ngành' : `Thấp hơn ~${Math.round((1 - ratio) * 100)}% so với tin cùng ngành`;
      } else { salScore = 65; salNote = 'Có ghi lương (chưa đủ tin cùng ngành để so sánh)'; }
    } else if (mid) { salScore = 65; salNote = 'Có ghi lương'; }
    parts.push({ key: 'salary', label: 'Mức lương', weight: 20, score: salScore, note: salNote });

    const age = Math.floor((Date.now() - new Date(j.createdAt).getTime()) / 86400000);
    const left = j.deadline ? Math.ceil((new Date(j.deadline).getTime() - Date.now()) / 86400000) : null;
    let fresh = age <= 7 ? 100 : age <= 21 ? 80 : age <= 45 ? 55 : 30;
    if (left != null && left <= 2) fresh = Math.min(fresh, 60);
    parts.push({ key: 'fresh', label: 'Độ mới', weight: 20, score: fresh, note: `Đăng ${age} ngày trước${left != null ? ` · còn ${Math.max(0, left)} ngày nộp` : ''}` });

    let score = Math.round(parts.reduce((s, p) => s + (p.score * p.weight) / 100, 0));
    if (reports > 0) {
      const pen = Math.min(25, reports * 8);
      score = Math.max(0, score - pen);
      parts.push({ key: 'reports', label: 'Báo cáo của người dùng', weight: 0, score: Math.max(0, 100 - pen * 4), note: `${reports} báo cáo (lừa đảo/sai thông tin) về công ty trong 90 ngày — điểm bị trừ ${pen}` });
    }
    const label = score >= 80 ? 'Rất đáng ứng tuyển' : score >= 65 ? 'Đáng ứng tuyển' : score >= 45 ? 'Cân nhắc kỹ' : 'Thận trọng';
    return { score, label, level: score >= 65 ? 'good' : score >= 45 ? 'fair' : 'poor', parts };
  }

  // (14) Báo cáo của tôi + tiến trình xử lý.
  async myReports(userId: string) {
    const rows = await this.q<{ id: string; reason: string; status: string; created_at: Date; title: string | null; approval_status: string | null; is_paused: boolean | null; job_id: string }>(
      `SELECT r.id, r.reason, r.status, r.created_at, j.title, j.approval_status, j.is_paused, r.job_posting_id AS job_id
         FROM job_reports r LEFT JOIN job_postings j ON j.id = r.job_posting_id
        WHERE r.reporter_user_id = $1 ORDER BY r.created_at DESC LIMIT 30`,
      [userId],
    ).catch(() => []);
    return {
      items: rows.map((r) => {
        const removed = !r.title || r.approval_status === 'rejected' || r.is_paused;
        return {
          id: r.id, jobId: r.job_id, title: r.title ?? 'Tin đã gỡ', reason: r.reason, createdAt: r.created_at,
          stage: r.status === 'open' ? 'Đã nhận — đang chờ quản trị viên kiểm tra' : removed ? 'Đã xử lý — tin đã bị gỡ/tạm ẩn' : 'Đã xử lý — tin được giữ nguyên sau khi kiểm tra',
          done: r.status !== 'open',
        };
      }),
    };
  }

  // (13) Sức khoẻ web (admin): các thứ cần dọn dẹp.
  async health() {
    const one = async (sql: string) => Number((await this.q<{ n: string }>(sql).catch(() => [{ n: '0' }]))[0]?.n ?? 0);
    const [expired, dupTitles, stalePending, staleWorkers, unseen, openReports, dormantCompanies] = await Promise.all([
      one(`SELECT COUNT(*) AS n FROM job_postings WHERE approval_status = 'approved' AND is_paused = false AND deadline IS NOT NULL AND deadline < CURRENT_DATE`),
      one(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM job_postings WHERE approval_status = 'approved' AND created_at >= now() - interval '30 days' GROUP BY company_id, lower(title) HAVING COUNT(*) > 1) t`),
      one(`SELECT COUNT(*) AS n FROM job_postings WHERE approval_status = 'pending' AND updated_at < now() - interval '24 hours'`),
      one(`SELECT COUNT(*) AS n FROM worker_profiles WHERE is_hidden = false AND is_seeking = true AND refreshed_at < now() - interval '45 days'`),
      one(`SELECT COUNT(*) AS n FROM applications WHERE deleted_at IS NULL AND status = 'new' AND viewed_at IS NULL AND applied_at < now() - interval '7 days' AND applied_at > now() - interval '60 days'`),
      one(`SELECT COUNT(*) AS n FROM job_reports WHERE status = 'open'`),
      one(`SELECT COUNT(*) AS n FROM (SELECT j.company_id FROM job_postings j JOIN applications a ON a.job_posting_id = j.id AND a.deleted_at IS NULL
              WHERE j.approval_status = 'approved' AND a.applied_at > now() - interval '60 days' GROUP BY j.company_id
              HAVING COUNT(*) >= 5 AND COUNT(*) FILTER (WHERE a.viewed_at IS NOT NULL OR a.status <> 'new') = 0) t`),
    ]);
    const items = [
      { key: 'expired', label: 'Tin đã duyệt đã quá hạn nộp (chưa gia hạn hoặc gỡ)', n: expired, hint: 'Ẩn hoặc nhắc nhà tuyển dụng gia hạn', level: expired > 20 ? 'warn' : 'ok' },
      { key: 'dup', label: 'Nhóm tin trùng tiêu đề trong cùng công ty (30 ngày)', n: dupTitles, hint: 'Gộp hoặc gỡ tin trùng', level: dupTitles > 5 ? 'warn' : 'ok' },
      { key: 'pending', label: 'Tin chờ duyệt quá 24 giờ', n: stalePending, hint: 'Vào Duyệt tin — tin rủi ro và công ty mới đã được xếp lên đầu', level: stalePending > 0 ? 'warn' : 'ok' },
      { key: 'reports', label: 'Báo cáo đang chờ xử lý', n: openReports, hint: 'Người báo cáo đang xem tiến trình', level: openReports > 0 ? 'warn' : 'ok' },
      { key: 'unseen', label: 'Hồ sơ nộp quá 7 ngày chưa được nhà tuyển dụng mở', n: unseen, hint: 'Ứng viên đang chờ — cân nhắc nhắc nhà tuyển dụng', level: unseen > 30 ? 'warn' : 'ok' },
      { key: 'dormant', label: 'Công ty có ≥5 hồ sơ nhưng chưa xem hồ sơ nào', n: dormantCompanies, hint: 'Tin có thể bị bỏ quên — liên hệ hoặc ẩn bớt', level: dormantCompanies > 0 ? 'warn' : 'ok' },
      { key: 'workers', label: 'Hồ sơ lao động phổ thông quá 45 ngày chưa làm mới', n: staleWorkers, hint: 'Đã tự xếp cuối danh sách của nhà tuyển dụng', level: 'ok' },
    ];
    return { items, warnCount: items.filter((i) => i.level === 'warn').length };
  }
}
