import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WorkerApplication, WorkerContact, WorkerNote, WorkerProfile, WorkerKind } from '../database/entities/worker-profile.entity';
import { JobApprovalStatus, JobPosting } from '../database/entities/job-posting.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { Company } from '../database/entities/company.entity';
import { LABOR_GROUPS, PERKS, RADII, SHIFTS, SHIFTS_BY_KIND, SLOTS, effBirth, estimateIncome, jobShiftTags, minorUnsafeReason, slotsFor, ageOf, LaborKind } from './labor-groups';
import { cleanProfileExtra, fitOf, hourlyInfo, profileSanity, ProfileExtra } from './labor-extra';
import { JobReport } from '../database/entities/job-report.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { unaccentSql } from '../common/sql-unaccent.util';
import { assessJobRisk, fold, RiskJob } from '../admin/job-risk';
import { minWageOf, wageWarning } from './min-wage';
import { maskPhone } from './worker-sourcing.service';
import { districtLabel, guessProvince, haversineKm, Loc, nearestProvince, provinceCentroid, proximity, resolvePlace } from './vn-geo';

const CALL_STATUSES = ['no_answer', 'callback', 'interview', 'hired', 'rejected', 'no_show'];

const KINDS: WorkerKind[] = ['worker', 'student', 'intern'];
const GENDERS = ['male', 'female', 'other'];

export interface WorkerInput {
  kind?: string;
  fullName?: string;
  phone?: string;
  relativePhone?: string;
  gender?: string;
  birthDate?: string;
  province?: string;
  addressMode?: string;
  oldDistrict?: string;
  oldWard?: string;
  newWardCode?: string;
  addressDetail?: string;
  lat?: number | null;
  lon?: number | null;
  radiusKm?: number | null;
  desiredJobs?: string[];
  shifts?: string[];
  availability?: string[];
  school?: string;
  major?: string;
  needsHousing?: boolean;
  needsShuttle?: boolean;
  extra?: Record<string, unknown> | null;
  isSeeking?: boolean;
  consent?: boolean;
  /** Ngày sinh đã lưu — bắt buộc khi sửa hồ sơ đã có (khách không đăng nhập) */
  verifyBirthDate?: string;
}

export interface EmployerSearch {
  kind?: string;
  province?: string;
  group?: string;
  q?: string;
  sort?: string; // near | recent
  includeNotSeeking?: string;
  originProvince?: string;
  originMode?: string;
  originDistrict?: string;
  originWard?: string;
  originNewWard?: string;
  originLat?: string;
  originLon?: string;
  page?: string;
  callStatus?: string;
  needs?: string;
  jobId?: string;
  today?: string;
  exp?: string;
  bike?: string;
  health?: string;
  hours?: string;
  months?: string;
  year?: string;
  major?: string;
  ready?: string;
}

export function normalizePhone(v?: string | null): string | null {
  if (!v) return null;
  let d = String(v).replace(/\D/g, '');
  if (d.startsWith('84') && d.length === 11) d = '0' + d.slice(2);
  return /^0\d{9}$/.test(d) ? d : null;
}
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '') || null;

// Đợt 79 — lao động phổ thông (công nhân / sinh viên / thực tập sinh).
@Injectable()
export class WorkersService {
  // Chống dò ngày sinh: sai 5 lần / SĐT ⇒ khoá 15 phút (bộ nhớ trong — đủ cho 1 instance Render).
  private fails = new Map<string, { n: number; until: number }>();

  constructor(
    @InjectRepository(WorkerProfile) private readonly repo: Repository<WorkerProfile>,
    @InjectRepository(WorkerNote) private readonly notes: Repository<WorkerNote>,
    @InjectRepository(WorkerApplication) private readonly apps: Repository<WorkerApplication>,
    @InjectRepository(JobPosting) private readonly jobs: Repository<JobPosting>,
    @InjectRepository(CompanyUser) private readonly companyUsers: Repository<CompanyUser>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(WorkerContact) private readonly contacts: Repository<WorkerContact>,
    @InjectRepository(JobReport) private readonly reports: Repository<JobReport>,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------- xác minh ----------
  private checkLock(phone: string) {
    const f = this.fails.get(phone);
    if (f && f.until > Date.now()) throw new ForbiddenException('Bạn đã nhập sai nhiều lần. Vui lòng thử lại sau 15 phút.');
  }
  private failed(phone: string) {
    const f = this.fails.get(phone) ?? { n: 0, until: 0 };
    f.n += 1;
    if (f.n >= 5) {
      f.until = Date.now() + 15 * 60 * 1000;
      f.n = 0;
    }
    this.fails.set(phone, f);
  }
  private async verified(phoneRaw: string, birthDate?: string) {
    const phone = normalizePhone(phoneRaw);
    if (!phone) throw new BadRequestException('Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0).');
    this.checkLock(phone);
    const p = await this.repo.findOne({ where: { phone } });
    if (!p) throw new NotFoundException('Chưa có thông tin với số điện thoại này.');
    if (p.isSourced && !p.claimedAt) throw new ForbiddenException('Hồ sơ này do hệ thống tổng hợp. Hãy điền thông tin mới để nhận lại hồ sơ.');
    if (!p.birthDate || !birthDate || String(birthDate).slice(0, 10) !== String(p.birthDate).slice(0, 10)) {
      this.failed(phone);
      throw new ForbiddenException('Ngày sinh không khớp với thông tin đã đăng ký.');
    }
    this.fails.delete(phone);
    return p;
  }

  async check(phoneRaw: string) {
    const phone = normalizePhone(phoneRaw);
    if (!phone) return { valid: false, exists: false };
    const p = await this.repo.findOne({ where: { phone }, select: { id: true, refreshedAt: true, isSourced: true, claimedAt: true } });
    // Chỉ báo "đã có" — không lộ bất kỳ thông tin cá nhân nào khi chưa xác minh ngày sinh.
    // Hồ sơ nguồn tổng hợp chưa được nhận: người dùng điền lại là nhận hồ sơ (không cần ngày sinh) → coi như chưa có.
    const unclaimed = !!p && p.isSourced && !p.claimedAt;
    return { valid: true, exists: !!p && !unclaimed, sourced: unclaimed, refreshedAt: p && !unclaimed ? p.refreshedAt : null };
  }

  async verify(phone: string, birthDate: string) {
    return this.view(await this.verified(phone, birthDate));
  }

  async refresh(phone: string, birthDate: string) {
    const p = await this.verified(phone, birthDate);
    p.refreshedAt = new Date();
    p.isSeeking = true;
    await this.repo.save(p);
    return this.view(p);
  }

  // ---------- lưu hồ sơ ----------
  private apply(p: WorkerProfile, b: WorkerInput) {
    const kind = KINDS.includes(b.kind as WorkerKind) ? (b.kind as WorkerKind) : 'worker';
    const fullName = clip(b.fullName, 120);
    if (!fullName || fullName.length < 2) throw new BadRequestException('Vui lòng nhập họ và tên.');
    const rel = b.relativePhone ? normalizePhone(b.relativePhone) : null;
    if (!rel) throw new BadRequestException(b.relativePhone ? 'Số điện thoại người thân không hợp lệ.' : 'Vui lòng nhập số điện thoại người thân.');
    if (rel && rel === p.phone) throw new BadRequestException('Số người thân phải khác số cá nhân.');
    if (!GENDERS.includes(String(b.gender))) throw new BadRequestException('Vui lòng chọn giới tính.');
    const bd = String(b.birthDate ?? '').slice(0, 10);
    const age = (Date.now() - new Date(bd).getTime()) / (365.25 * 864e5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bd) || !(age >= 15 && age <= 70)) throw new BadRequestException('Ngày sinh không hợp lệ (từ 15 đến 70 tuổi).');
    const place = resolvePlace({ province: String(b.province ?? ''), mode: b.addressMode, oldDistrict: b.oldDistrict, oldWard: b.oldWard, newWardCode: b.newWardCode });
    if (!place) throw new BadRequestException('Địa chỉ không hợp lệ — vui lòng chọn lại tỉnh, quận/huyện, phường/xã.');
    if (!place.newWardCode) throw new BadRequestException('Vui lòng chọn phường/xã.');
    const groups = LABOR_GROUPS[kind];
    const desired = (b.desiredJobs ?? []).filter((g) => groups.includes(g)).slice(0, 3);
    if (!desired.length) throw new BadRequestException('Vui lòng chọn ít nhất 1 công việc mong muốn.');

    p.kind = kind;
    p.fullName = fullName;
    p.relativePhone = rel;
    p.gender = String(b.gender);
    p.birthDate = bd;
    p.province = place.province;
    p.addressMode = b.addressMode === 'new' ? 'new' : 'old';
    p.oldDistrict = place.oldDistrict;
    p.oldWard = place.oldWard;
    p.newWardCode = place.newWardCode;
    p.newWard = place.newWard;
    p.addressDetail = clip(b.addressDetail, 200);
    const okCoord = (v: unknown, lo: number, hi: number) => typeof v === 'number' && v >= lo && v <= hi;
    p.lat = okCoord(b.lat, 8, 24) ? b.lat : null;
    p.lon = okCoord(b.lon, 102, 110) ? b.lon : null;
    p.radiusKm = RADII.includes(Number(b.radiusKm)) ? Number(b.radiusKm) : null;
    p.desiredJobs = desired;
    p.shifts = (b.shifts ?? []).filter((s) => SHIFTS_BY_KIND[kind].includes(s));
    p.availability = kind === 'worker' ? null : (b.availability ?? []).filter((s) => slotsFor(kind).includes(s));
    p.extra = cleanProfileExtra(kind, b.extra);
    p.school = kind === 'worker' ? null : clip(b.school, 150);
    p.major = kind === 'worker' ? null : clip(b.major, 150);
    p.needsHousing = !!b.needsHousing;
    p.needsShuttle = !!b.needsShuttle;
    p.isSeeking = b.isSeeking !== false;
    p.refreshedAt = new Date();
  }

  async saveGuest(b: WorkerInput) {
    const phone = normalizePhone(b.phone);
    if (!phone) throw new BadRequestException('Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0).');
    const existing = await this.repo.findOne({ where: { phone } });
    if (existing && existing.isSourced && !existing.claimedAt) {
      // Người thật điền hồ sơ trùng SĐT với hồ sơ nguồn tổng hợp → hồ sơ trở thành của họ (không tạo bản sao).
      if (!b.consent) throw new BadRequestException('Vui lòng đồng ý cho nhà tuyển dụng xem thông tin để liên hệ.');
      this.claimSourced(existing);
      this.apply(existing, b);
      await this.repo.save(existing);
      return { updated: false, profile: this.view(existing) };
    }
    if (existing) {
      const p = await this.verified(phone, b.verifyBirthDate);
      this.apply(p, b);
      await this.repo.save(p);
      return { updated: true, profile: this.view(p) };
    }
    if (!b.consent) throw new BadRequestException('Vui lòng đồng ý cho nhà tuyển dụng xem thông tin để liên hệ.');
    const p = this.repo.create({ phone });
    this.apply(p, b);
    await this.repo.save(p);
    return { updated: false, profile: this.view(p) };
  }

  /** Hồ sơ nguồn tổng hợp được chính chủ nhận lại: bỏ nhãn, xoá nguồn/chủ sở hữu, công khai bình thường. */
  private claimSourced(p: WorkerProfile) {
    p.isSourced = false;
    p.claimedAt = new Date();
    p.ownerCompanyId = null;
    p.shareStatus = null;
    p.sourceLabel = p.sourceLabel ? `${p.sourceLabel} → đã nhận lại` : 'Đã nhận lại';
  }

  // Ứng viên đã đăng nhập: hồ sơ gắn tài khoản, không cần nhập lại ngày sinh để sửa.
  async getMine(userId: string) {
    const p = await this.repo.findOne({ where: { userId } });
    return p ? this.view(p) : null;
  }
  async saveMine(userId: string, b: WorkerInput) {
    let p = await this.repo.findOne({ where: { userId } });
    const phone = normalizePhone(b.phone);
    if (!phone) throw new BadRequestException('Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0).');
    if (!p) {
      const byPhone = await this.repo.findOne({ where: { phone } });
      if (byPhone && byPhone.isSourced && !byPhone.claimedAt) {
        if (!b.consent) throw new BadRequestException('Vui lòng đồng ý cho nhà tuyển dụng xem thông tin để liên hệ.');
        p = byPhone;
        this.claimSourced(p);
        p.userId = userId;
      } else if (byPhone) {
        // SĐT đã đăng ký khi chưa có tài khoản ⇒ cần đúng ngày sinh mới được nhận về tài khoản này.
        if (byPhone.userId && byPhone.userId !== userId) throw new ForbiddenException('Số điện thoại này đã gắn với tài khoản khác.');
        p = await this.verified(phone, b.verifyBirthDate);
        p.userId = userId;
      } else {
        if (!b.consent) throw new BadRequestException('Vui lòng đồng ý cho nhà tuyển dụng xem thông tin để liên hệ.');
        p = this.repo.create({ phone, userId });
      }
    } else if (phone !== p.phone) {
      if (await this.repo.findOne({ where: { phone } })) throw new BadRequestException('Số điện thoại mới đã được đăng ký.');
      p.phone = phone;
    }
    this.apply(p, b);
    await this.repo.save(p);
    return { updated: true, profile: this.view(p) };
  }
  async refreshMine(userId: string) {
    const p = await this.repo.findOne({ where: { userId } });
    if (!p) throw new NotFoundException('Chưa có hồ sơ.');
    p.refreshedAt = new Date();
    p.isSeeking = true;
    await this.repo.save(p);
    return this.view(p);
  }

  view(p: WorkerProfile) {
    return {
      id: p.id, kind: p.kind, fullName: p.fullName, phone: p.phone, relativePhone: p.relativePhone ?? null, gender: p.gender,
      birthDate: p.birthDate ? String(p.birthDate).slice(0, 10) : null, birthYear: p.birthYear ?? (p.birthDate ? +String(p.birthDate).slice(0, 4) : null),
      isSourced: p.isSourced, province: p.province, addressMode: p.addressMode, oldDistrict: p.oldDistrict ?? null,
      oldWard: p.oldWard ?? null, newWardCode: p.newWardCode ?? null, newWard: p.newWard ?? null, addressDetail: p.addressDetail ?? null,
      lat: p.lat ?? null, lon: p.lon ?? null, radiusKm: p.radiusKm ?? null, desiredJobs: p.desiredJobs ?? [], shifts: p.shifts ?? [],
      availability: p.availability ?? [], school: p.school ?? null, major: p.major ?? null, needsHousing: p.needsHousing, needsShuttle: p.needsShuttle,
      isSeeking: p.isSeeking, refreshedAt: p.refreshedAt, createdAt: p.createdAt,
      examUntil: p.examUntil ? String(p.examUntil).slice(0, 10) : null, examMode: p.examMode ?? null,
      extra: (p.extra ?? null) as ProfileExtra | null,
      warnings: profileSanity(p.kind as LaborKind, String(effBirth(p)).slice(0, 10), p.extra ?? null, p.availability ?? null, p.shifts ?? null),
    };
  }

  // ---------- việc làm kênh phổ thông ----------
  /** Đợt 80 — số người đã nhận việc theo từng tin (ứng tuyển nhanh + sổ gọi điện có gắn tin). */
  private async hiredCounts(jobIds: string[]): Promise<Map<string, number>> {
    const m = new Map<string, number>();
    if (!jobIds.length) return m;
    const rows: { job: string; n: number }[] = await this.repo.manager.query(
      `SELECT job, COUNT(DISTINCT pid)::int AS n FROM (
         SELECT job_posting_id AS job, profile_id AS pid FROM worker_applications WHERE status = 'hired' AND job_posting_id = ANY($1)
         UNION SELECT job_posting_id AS job, profile_id AS pid FROM worker_contacts WHERE status = 'hired' AND job_posting_id = ANY($1)
       ) t GROUP BY job`,
      [jobIds],
    );
    for (const r of rows) m.set(r.job, r.n);
    return m;
  }
  private async recomputeFill(jobId?: string | null) {
    if (!jobId) return;
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.channel === 'office') return;
    const n = (await this.hiredCounts([jobId])).get(jobId) ?? 0;
    const full = (job.headcount ?? 0) > 0 && n >= job.headcount;
    if (full && !job.filledAt) await this.jobs.update({ id: jobId }, { filledAt: new Date() });
    if (!full && job.filledAt) await this.jobs.update({ id: jobId }, { filledAt: null });
  }

  private jobCard(j: JobPosting, extra: { distance?: ReturnType<typeof proximity> | null; hired?: number; scheduleFit?: boolean | null; score?: number; trust?: ReturnType<WorkersService['trustOf']>; minor?: boolean; fit?: ReturnType<typeof fitOf> | null } = {}) {
    const wp = j.workPlace;
    return {
      id: j.id, title: j.title, laborGroup: j.laborGroup ?? null, channel: j.channel, provinces: j.provinces ?? [],
      salaryMin: j.salaryMin ?? null, salaryMax: j.salaryMax ?? null, isUrgent: j.isUrgent, deadline: j.deadline ?? null, createdAt: j.createdAt,
      company: j.company ? { id: j.company.id, name: j.company.name, logoUrl: j.company.logoUrl ?? null } : null,
      workPlaceText: wp ? [wp.mode === 'new' ? wp.newWard : wp.oldWard, wp.mode === 'old' ? wp.oldDistrict : null, wp.province].filter(Boolean).join(', ') : null,
      perks: j.laborPerks ?? [],
      income: estimateIncome(j.payInfo),
      schedule: j.laborSchedule ?? [],
      shiftTags: jobShiftTags(j),
      headcount: j.headcount ?? 1,
      hired: extra.hired ?? 0,
      filled: !!j.filledAt,
      distance: extra.distance ?? null,
      scheduleFit: extra.scheduleFit ?? null,
      matched: (extra.score ?? 0) >= 3,
      warnings: this.warningsOf(j),
      trust: extra.trust ?? null,
      ageDays: Math.floor((Date.now() - +new Date(j.createdAt)) / 864e5),
      laborExtra: j.laborExtra ?? null,
      hourly: j.channel === 'student' ? hourlyInfo(j.workPlace?.province ?? j.provinces?.[0], j.laborExtra?.hourlyPay, j.laborExtra?.hours) : null,
      minorUnsafe: minorUnsafeReason(j),
      minorBlocked: !!extra.minor,
      fit: extra.fit ?? null,
    };
  }

  /** Đợt 83 — điểm uy tín nhà tuyển dụng: tỷ lệ gọi lại, tốc độ phản hồi, số báo cáo. Cần ≥3 đơn ứng tuyển mới chấm. */
  async trustMap(companyIds: string[]) {
    const m = new Map<string, ReturnType<WorkersService['trustOf']>>();
    const ids = Array.from(new Set(companyIds.filter(Boolean)));
    if (!ids.length) return m;
    const rows: { cid: string; n: number; called: number; hrs: number | null }[] = await this.repo.manager.query(
      `SELECT j.company_id AS cid, COUNT(*)::int AS n, SUM((a.status <> 'new')::int)::int AS called,
              AVG(EXTRACT(EPOCH FROM (a.seen_at - a.created_at)) / 3600) FILTER (WHERE a.seen_at IS NOT NULL)::float AS hrs
       FROM worker_applications a JOIN job_postings j ON j.id = a.job_posting_id
       WHERE j.company_id = ANY($1) GROUP BY j.company_id`,
      [ids],
    );
    const reps: { cid: string; n: number }[] = await this.repo.manager.query(
      `SELECT j.company_id AS cid, COUNT(*)::int AS n FROM job_reports r JOIN job_postings j ON j.id = r.job_posting_id
       WHERE j.company_id = ANY($1) AND (r.status = 'open' OR r.category = 'scam') GROUP BY j.company_id`,
      [ids],
    );
    const repBy = new Map(reps.map((r) => [r.cid, r.n]));
    for (const id of ids) {
      const r = rows.find((x) => x.cid === id);
      m.set(id, this.trustOf(r?.n ?? 0, r?.called ?? 0, r?.hrs ?? null, repBy.get(id) ?? 0));
    }
    return m;
  }
  trustOf(n: number, called: number, hrs: number | null, reports: number) {
    if (n < 3) return { score: null as number | null, label: 'Nhà tuyển dụng mới', callRate: null as number | null, avgHours: null as number | null, reports, applications: n };
    const callRate = called / n;
    const speed = hrs == null ? 0 : hrs <= 24 ? 1 : hrs <= 72 ? 0.5 : 0;
    const score = Math.max(0, Math.round(callRate * 50 + speed * 30 + 20 - Math.min(20, reports * 10)));
    return {
      score, callRate: Math.round(callRate * 100), avgHours: hrs == null ? null : Math.round(hrs * 10) / 10, reports, applications: n,
      label: score >= 75 ? 'Phản hồi tốt' : score >= 50 ? 'Phản hồi trung bình' : 'Phản hồi chậm',
    };
  }

  /** Đợt 81 — cảnh báo ngay trên thẻ tin: dấu hiệu thu phí / giữ giấy tờ / lương cao bất thường (quy tắc, không AI). */
  private warningsOf(j: JobPosting): string[] {
    try {
      const r = assessJobRisk(j as unknown as RiskJob, { others: [] });
      const rs = r.reasons.filter((x) => !/thông tin liên hệ|quá ngắn/i.test(x));
      const out = r.score >= 25 ? rs.slice(0, 3) : [];
      // Đợt 83 — lương công nhân thấp hơn lương tối thiểu vùng (tính theo tỉnh nơi làm việc)
      if (j.channel === 'worker') {
        const w = wageWarning(j.workPlace?.province ?? j.provinces?.[0], j.payInfo?.base ?? j.salaryMin ?? null);
        if (w) out.push(w);
      }
      if (j.channel === 'student' && j.laborExtra?.hourlyPay) {
        const h = hourlyInfo(j.workPlace?.province ?? j.provinces?.[0], j.laborExtra.hourlyPay, j.laborExtra.hours);
        if (h?.belowMin) out.push(`Lương ${h.hourly.toLocaleString('vi-VN')} đ/giờ thấp hơn mức tối thiểu giờ vùng ${h.region} (${h.min.toLocaleString('vi-VN')} đ/giờ, từ 01/2026)`);
      }
      return out;
    } catch {
      return [];
    }
  }

  /** Đợt 81 — thẻ tin theo danh sách mã (tin đã lưu), kể cả tin đã đóng để người dùng biết. */
  async cards(idsRaw: string) {
    const ids = (idsRaw ?? '').split(',').map((x) => x.trim()).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 30);
    if (!ids.length) return { items: [] };
    const rows = await this.jobs.find({ where: { id: In(ids) }, relations: { company: true } });
    const hired = await this.hiredCounts(rows.map((r) => r.id));
    const trust = await this.trustMap(rows.map((r) => r.companyId));
    return {
      items: rows.map((j) => ({
        ...this.jobCard(j, { hired: hired.get(j.id) ?? 0, trust: trust.get(j.companyId) }),
        closed: j.approvalStatus !== JobApprovalStatus.APPROVED || j.isPaused || (!!j.deadline && j.deadline < new Date().toISOString().slice(0, 10)),
      })),
    };
  }

  /** Đợt 80 — duyệt tin kênh phổ thông: lọc + "gần tôi" + ưu tiên KTX/xe đưa đón + hợp lịch học. */
  async browse(q: Record<string, string | undefined>) {
    const kind = KINDS.includes(q.kind as WorkerKind) ? q.kind! : 'worker';
    const qb = this.jobs
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .where('job.approvalStatus = :s', { s: JobApprovalStatus.APPROVED })
      .andWhere('job.isPaused = false')
      .andWhere('job.channel = :kind', { kind })
      .andWhere('(job.deadline IS NULL OR job.deadline >= CURRENT_DATE)');
    // Đợt 166 — chọn tối đa 3 tỉnh / 3 nhóm việc: các giá trị cách nhau bằng "|" (giá trị đơn vẫn chạy như cũ).
    const pvs = (q.province ?? '').split('|').map((x) => x.trim()).filter(Boolean).slice(0, 5);
    if (pvs.length) {
      const ors = pvs.map((_, i) => `(job.provinces ILIKE :pv${i} OR job.work_place ->> 'province' = :pw${i})`).join(' OR ');
      const prm: Record<string, string> = {};
      pvs.forEach((v, i) => { prm[`pv${i}`] = `%${v}%`; prm[`pw${i}`] = v; });
      qb.andWhere(`(${ors})`, prm);
    }
    const grs = (q.group ?? '').split('|').map((x) => x.trim()).filter(Boolean).slice(0, 5);
    if (grs.length) qb.andWhere('job.laborGroup IN (:...grs)', { grs });
    if (q.q?.trim()) qb.andWhere('(job.title ILIKE :t OR company.name ILIKE :t)', { t: `%${q.q.trim()}%` });
    for (const perk of (q.perks ?? '').split(',').filter((x) => PERKS.includes(x))) qb.andWhere(`(',' || job.labor_perks || ',') LIKE :pk_${perk}`, { [`pk_${perk}`]: `%,${perk},%` });
    if (q.hideFilled === '1') qb.andWhere('job.filledAt IS NULL');
    const rows0 = await qb.orderBy('job.createdAt', 'DESC').take(800).getMany();
    // Đợt 81 — sinh viên: chỉ tin có ca ngoài giờ học (buổi tối hoặc T7/CN)
    const rows1 = q.flex === '1' ? rows0.filter((j) => (j.laborSchedule ?? []).length > 0 && (j.laborSchedule ?? []).every((x) => x.endsWith('-toi') || x.startsWith('t7') || x.startsWith('cn'))) : rows0;
    // Đợt 84 — người chưa đủ 18 tuổi: ẩn tin ca đêm/nặng nhọc; sinh viên: lọc theo số giờ/tuần
    const isMinor = q.minor === '1';
    const maxH = Number(q.hours) || 0;
    // Đợt 134 — lọc "Ca làm" (chọn nhiều = tin có ít nhất 1 ca đã chọn)
    const wantShifts = (q.shifts ?? '').split(',').map((x) => x.trim()).filter((x) => SHIFTS.includes(x));
    const rows = rows1.filter((j) => (!isMinor || !minorUnsafeReason(j)) && (!maxH || !j.laborExtra?.hours || j.laborExtra.hours <= maxH) && (!wantShifts.length || jobShiftTags(j).some((t) => wantShifts.includes(t))));

    // Vị trí người tìm việc (từ hồ sơ của họ trên trình duyệt) để tính gần/xa
    let origin: Loc | null = null;
    // Đợt 134 — chỉ có vị trí máy (chưa có hồ sơ): suy ra tỉnh gần nhất để vẫn xếp "Gần tôi" được.
    if (!q.oProvince && q.oLat && q.oLon && Number.isFinite(Number(q.oLat)) && Number.isFinite(Number(q.oLon))) {
      q = { ...q, oProvince: nearestProvince(Number(q.oLat), Number(q.oLon)) ?? undefined };
    }
    if (q.oProvince) {
      origin = { province: q.oProvince, oldDistrict: q.oDistrict || null, newWardCode: q.oWard || null };
      const lat = Number(q.oLat);
      const lon = Number(q.oLon);
      if (q.oLat && q.oLon && Number.isFinite(lat) && Number.isFinite(lon)) Object.assign(origin, { lat, lon });
    }
    const groups = (q.groups ?? '').split('|').filter(Boolean);
    const avail = new Set((q.avail ?? '').split(',').filter((x) => SLOTS.includes(x)));
    const needs = (q.needs ?? '').split(',');
    const myFit = q.fit === '1' ? { kind, birthDate: q.bd || '2000-01-01', extra: this.parseExtra(q.ex, kind), availability: [...avail], major: q.major ?? null } : null;
    const hired = await this.hiredCounts(rows.map((r) => r.id));
    const scored = rows.map((j) => {
      const wp = j.workPlace;
      const dest: Loc | null = wp ? { province: wp.province, oldDistrict: wp.oldDistrict, newWardCode: wp.newWardCode, lat: wp.lat, lon: wp.lon } : j.provinces?.[0] ? { province: j.provinces[0] } : null;
      const distance = origin && dest ? proximity(origin, dest) : null;
      const sched = j.laborSchedule ?? [];
      const scheduleFit = avail.size && sched.length ? sched.every((s) => avail.has(s)) : null;
      const perks = j.laborPerks ?? [];
      let score = 0;
      if (j.laborGroup && groups.includes(j.laborGroup)) score += 3;
      if (needs.includes('housing') && perks.includes('housing')) score += 2;
      if (needs.includes('shuttle') && perks.includes('shuttle')) score += 2;
      if (scheduleFit) score += 2;
      if (j.isUrgent) score += 0.5;
      if (j.filledAt) score -= 10;
      const fit = myFit ? fitOf(j, myFit) : null;
      if (fit && fit.missing.length === 0 && fit.ok.length) score += 1;
      return { j, distance, scheduleFit, score, fit };
    });
    // Đợt 134 — bán kính (km) khi đã biết vị trí người tìm việc
    const radius = Number(q.radius) || 0;
    if (radius > 0 && origin) {
      const keep = scored.filter((x) => x.distance && x.distance.km <= radius);
      scored.length = 0;
      scored.push(...keep);
    }
    const sort = q.sort ?? (origin ? 'near' : 'new');
    if (sort === 'near' && origin) scored.sort((a, b) => (!!a.j.filledAt === !!b.j.filledAt ? 0 : a.j.filledAt ? 1 : -1) || (a.distance!.km - b.distance!.km) || (b.score - a.score));
    else if (sort === 'match') scored.sort((a, b) => b.score - a.score || (a.distance?.km ?? 999) - (b.distance?.km ?? 999));
    else scored.sort((a, b) => (!!a.j.filledAt === !!b.j.filledAt ? 0 : a.j.filledAt ? 1 : -1) || +b.j.createdAt - +a.j.createdAt);
    const size = Math.min(40, Math.max(1, Number(q.pageSize) || 20));
    const page = Math.max(1, Number(q.page) || 1);
    const pageRows = scored.slice((page - 1) * size, page * size);
    const trust = await this.trustMap(pageRows.map((x) => x.j.companyId));
    const items = pageRows.map((x) => this.jobCard(x.j, { distance: x.distance, hired: hired.get(x.j.id) ?? 0, scheduleFit: x.scheduleFit, score: x.score, trust: trust.get(x.j.companyId), fit: x.fit }));
    return { items, total: scored.length, page, totalPages: Math.max(1, Math.ceil(scored.length / size)) };
  }

  private parseExtra(raw: string | undefined, kind: string): ProfileExtra | null {
    if (!raw) return null;
    try {
      return cleanProfileExtra(kind as LaborKind, JSON.parse(raw));
    } catch {
      return null;
    }
  }

  /** Đợt 84 — đối chiếu yêu cầu của tin với hồ sơ (khách: SĐT + ngày sinh; đã đăng nhập: hồ sơ gắn tài khoản). */
  async fitCheck(jobId: string, p: WorkerProfile) {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.channel === 'office') throw new NotFoundException('Không tìm thấy tin');
    return { ...fitOf(job, p), minorUnsafe: ageOf(effBirth(p)) < 18 ? minorUnsafeReason(job) : null };
  }
  async fitCheckGuest(jobId: string, phone: string, birthDate: string) {
    return this.fitCheck(jobId, await this.verified(phone, birthDate));
  }
  async fitCheckMine(jobId: string, userId: string) {
    const p = await this.repo.findOne({ where: { userId } });
    if (!p) throw new BadRequestException('Bạn chưa có hồ sơ.');
    return this.fitCheck(jobId, p);
  }

  async jobProgress(jobId: string) {
    const j = await this.jobs.findOne({ where: { id: jobId } });
    if (!j) throw new NotFoundException();
    const hired = (await this.hiredCounts([jobId])).get(jobId) ?? 0;
    return { headcount: j.headcount ?? 1, hired, filled: !!j.filledAt, income: estimateIncome(j.payInfo) };
  }

  /** Thu nhập + lương gợi ý cho NTD: phân vị lương tin cùng kênh / nhóm việc / tỉnh. */
  async salaryStats(q: { kind?: string; group?: string; province?: string }) {
    const kind = KINDS.includes(q.kind as WorkerKind) ? q.kind : 'worker';
    const rows = await this.jobs
      .createQueryBuilder('job')
      .select(['job.id', 'job.salaryMin', 'job.salaryMax', 'job.laborGroup', 'job.provinces', 'job.payInfo'])
      .where('job.approvalStatus = :s', { s: JobApprovalStatus.APPROVED })
      .andWhere('job.channel = :kind', { kind })
      .andWhere("job.createdAt > now() - interval '180 days'")
      .take(3000)
      .getMany();
    const toM = (v?: number | null) => (v == null ? null : v > 1000 ? v / 1e6 : v);
    const mid = (j: JobPosting) => {
      const a = toM(j.salaryMin) ?? toM(j.salaryMax) ?? j.payInfo?.base ?? null;
      const b = toM(j.salaryMax) ?? toM(j.salaryMin) ?? j.payInfo?.base ?? null;
      return a != null && b != null ? (a + b) / 2 : null;
    };
    const pick = (list: JobPosting[]) => list.map(mid).filter((v): v is number => v != null && v > 0).sort((x, y) => x - y);
    const pct = (arr: number[], p: number) => Math.round(arr[Math.min(arr.length - 1, Math.floor((arr.length - 1) * p))] * 10) / 10;
    const tries: [string, JobPosting[]][] = [
      ['cùng nhóm việc, cùng tỉnh', rows.filter((j) => j.laborGroup === q.group && (j.provinces ?? []).includes(q.province ?? ''))],
      ['cùng nhóm việc, toàn quốc', rows.filter((j) => j.laborGroup === q.group)],
      ['cùng tỉnh', rows.filter((j) => (j.provinces ?? []).includes(q.province ?? ''))],
      ['toàn kênh', rows],
    ];
    for (const [scope, list] of tries) {
      const v = pick(list);
      if (v.length >= 3) return { scope, count: v.length, p25: pct(v, 0.25), median: pct(v, 0.5), p75: pct(v, 0.75) };
    }
    return { scope: null, count: 0, p25: null, median: null, p75: null };
  }

  // Ứng tuyển nhanh: khách cần SĐT + ngày sinh; ứng viên đăng nhập dùng hồ sơ gắn tài khoản.
  async quickApply(jobId: string, phone: string, birthDate: string, group?: string) {
    return this.applyTo(jobId, await this.verified(phone, birthDate), group);
  }
  async quickApplyMine(userId: string, jobId: string, group?: string) {
    const p = await this.repo.findOne({ where: { userId } });
    if (!p) throw new BadRequestException('Bạn chưa có hồ sơ lao động phổ thông — vui lòng điền hồ sơ trước.');
    return this.applyTo(jobId, p, group);
  }
  private async applyTo(jobId: string, p: WorkerProfile, group?: string) {
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job || job.approvalStatus !== JobApprovalStatus.APPROVED || job.isPaused) throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    if (job.channel === 'office') throw new BadRequestException('Tin này nhận hồ sơ qua CV — vui lòng dùng nút Ứng tuyển thông thường.');
    const exist = await this.apps.findOne({ where: { profileId: p.id, jobPostingId: jobId } });
    if (exist) return { ok: true, already: true, groupCode: exist.groupCode ?? null, groupSize: await this.groupSize(jobId, exist.groupCode) };
    if (job.filledAt) throw new BadRequestException('Tin này đã tuyển đủ người — bạn xem các tin khác nhé.');
    if (ageOf(effBirth(p)) < 18) {
      const why = minorUnsafeReason(job);
      if (why) throw new BadRequestException(`${why}.`);
    }
    // Rủ bạn: mã nhóm phải đã có trong tin này (của người rủ), nhóm tối đa 5 người
    let code: string | null = null;
    const g = (group ?? '').trim().toUpperCase();
    if (g && /^[A-Z0-9]{6}$/.test(g)) {
      const size = await this.groupSize(jobId, g);
      if (size > 0 && size < 5) code = g;
    }
    if (!code) code = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, 'X');
    await this.apps.save(this.apps.create({ profileId: p.id, jobPostingId: jobId, createdAt: new Date(), groupCode: code }));
    p.refreshedAt = new Date();
    p.isSeeking = true;
    await this.repo.save(p);
    const fit = fitOf(job, p);
    return { ok: true, already: false, missing: fit.missing, groupCode: code, groupSize: await this.groupSize(jobId, code), joinedGroup: !!g && code === g };
  }
  private async groupSize(jobId: string, code?: string | null) {
    if (!code) return 0;
    return this.apps.count({ where: { jobPostingId: jobId, groupCode: code } });
  }
  /** Thông tin nhóm khi bạn bè mở link rủ (chỉ tên rút gọn người rủ, không lộ SĐT). */
  async groupInfo(jobId: string, code: string) {
    const rows = await this.apps.find({ where: { jobPostingId: jobId, groupCode: (code ?? '').toUpperCase() }, order: { createdAt: 'ASC' } });
    if (!rows.length) return { valid: false, size: 0, leader: null };
    const leader = await this.repo.findOne({ where: { id: rows[0].profileId } });
    const short = leader ? leader.fullName.trim().split(/\s+/).slice(-1)[0] : null;
    return { valid: rows.length < 5, size: rows.length, leader: short };
  }

  // ---------- nhà tuyển dụng ----------
  private async companyOf(userId: string) {
    const link = await this.companyUsers.findOne({ where: { userId } });
    return link?.companyId ?? null;
  }

  /** Vị trí mặc định của công ty (đoán tỉnh từ địa chỉ, nếu không có thì từ tin đăng gần nhất). */
  async employerOrigin(userId: string) {
    const companyId = await this.companyOf(userId);
    if (!companyId) return { province: null, address: null };
    const c = await this.companies.findOne({ where: { id: companyId } });
    let province = guessProvince(c?.address);
    if (!province) {
      const j = await this.jobs.findOne({ where: { companyId }, order: { createdAt: 'DESC' } });
      province = j?.workPlace?.province ?? j?.provinces?.[0] ?? null;
    }
    return { province, address: c?.address ?? null };
  }

  private originFrom(q: EmployerSearch): Loc | null {
    if (!q.originProvince) return null;
    const r = resolvePlace({ province: q.originProvince, mode: q.originMode, oldDistrict: q.originDistrict, oldWard: q.originWard, newWardCode: q.originNewWard });
    if (!r) return null;
    const o: Loc = { province: r.province, oldDistrict: r.oldDistrict, newWardCode: r.newWardCode };
    const lat = Number(q.originLat);
    const lon = Number(q.originLon);
    if (q.originLat && q.originLon && Number.isFinite(lat) && Number.isFinite(lon)) Object.assign(o, { lat, lon });
    return o;
  }

  async search(userId: string, q: EmployerSearch) {
    const companyId = await this.companyOf(userId);
    const kind = KINDS.includes(q.kind as WorkerKind) ? q.kind : undefined;
    const qb = this.repo.createQueryBuilder('w').where('w.isHidden = false');
    // Đợt 136 — hồ sơ NTD tự nhập chỉ công ty đó thấy cho tới khi Admin chia sẻ
    qb.andWhere(companyId ? "(w.owner_company_id IS NULL OR w.owner_company_id = :myCo OR w.share_status = 'shared')" : "(w.owner_company_id IS NULL OR w.share_status = 'shared')", companyId ? { myCo: companyId } : {});
    if (kind) qb.andWhere('w.kind = :kind', { kind });
    if (q.province) qb.andWhere('w.province = :p', { p: q.province });
    if (q.group) qb.andWhere("(',' || w.desired_jobs || ',') LIKE :g", { g: `%,${q.group},%` });
    if (q.includeNotSeeking !== '1') {
      qb.andWhere('w.isSeeking = true');
      // Đợt 83 — mùa thi: ẩn khỏi tìm kiếm đến hết ngày đã chọn
      qb.andWhere("(w.exam_mode IS DISTINCT FROM 'pause' OR w.exam_until IS NULL OR w.exam_until < CURRENT_DATE)");
    }
    if (q.q?.trim()) {
      const digits = q.q.replace(/\D/g, '');
      qb.andWhere(digits.length >= 3 ? '(w.fullName ILIKE :t OR w.phone LIKE :t2)' : 'w.fullName ILIKE :t', { t: `%${q.q.trim()}%`, t2: `%${digits}%` });
    }
    // Đợt 84 — bộ lọc riêng từng nhóm (đọc từ profile_extra)
    if (q.exp === 'has') qb.andWhere("w.profile_extra ->> 'experience' IN ('lt1','gte1')");
    if (q.exp === 'gte1') qb.andWhere("w.profile_extra ->> 'experience' = 'gte1'");
    if (q.bike === '1') qb.andWhere("w.profile_extra ->> 'hasBike' = 'true'");
    if (q.health === '1') qb.andWhere("w.profile_extra ->> 'hasHealth' = 'true'");
    if (['lt15', '15-25', 'gt25'].includes(String(q.hours))) qb.andWhere("w.profile_extra ->> 'hours' = :hrs", { hrs: q.hours });
    if (Number(q.months) > 0) qb.andWhere("COALESCE((w.profile_extra ->> 'months')::int, 0) >= :mo", { mo: Number(q.months) });
    if (Number(q.year) > 0) qb.andWhere("COALESCE((w.profile_extra ->> 'year')::int, 0) >= :yr", { yr: Number(q.year) });
    if (q.major?.trim()) qb.andWhere('w.major ILIKE :mj', { mj: `%${q.major.trim()}%` });
    if (q.ready === '1') qb.andWhere("(w.profile_extra ->> 'ready' = 'now' OR w.profile_extra ->> 'ready' <= to_char(CURRENT_DATE, 'YYYY-MM-DD'))");
    if (q.needs === 'housing') qb.andWhere('w.needsHousing = true');
    if (q.needs === 'shuttle') qb.andWhere('w.needsShuttle = true');
    // Sổ gọi điện: lọc theo trạng thái của chính công ty mình
    if (companyId && q.callStatus) {
      if (q.callStatus === 'none') qb.andWhere('NOT EXISTS (SELECT 1 FROM worker_contacts c WHERE c.profile_id = w.id AND c.company_id = :cid)', { cid: companyId });
      else qb.andWhere('EXISTS (SELECT 1 FROM worker_contacts c WHERE c.profile_id = w.id AND c.company_id = :cid AND c.status = :cs)', { cid: companyId, cs: q.callStatus });
    }
    // Đợt 81 — "Hôm nay nên gọi": hồ sơ mới làm mới, chưa xử lý xong; hẹn gọi lại/không nghe máy thì sau 1 ngày mới nhắc lại
    if (companyId && q.today === '1') {
      qb.andWhere("w.refreshed_at > now() - interval '14 days'");
      qb.andWhere(
        `NOT EXISTS (SELECT 1 FROM worker_contacts c WHERE c.profile_id = w.id AND c.company_id = :cid2 AND (c.status IN ('interview','hired','rejected','no_show') OR (c.status IN ('no_answer','callback') AND c.updated_at > now() - interval '1 day')))`,
        { cid2: companyId },
      );
    }
    // Đợt 81 — xếp hạng ứng viên theo từng tin: lấy vị trí/ca/nhóm việc của tin làm chuẩn
    let job: JobPosting | null = null;
    if (companyId && q.jobId && /^[0-9a-f-]{36}$/i.test(q.jobId)) {
      job = await this.jobs.findOne({ where: { id: q.jobId, companyId } });
      if (job && job.channel !== 'office' && !kind) qb.andWhere('w.kind = :jk', { jk: job.channel });
    }
    const rows = await qb.orderBy('w.refreshedAt', 'DESC').take(3000).getMany();

    let origin = this.originFrom(q);
    if (!origin && job?.workPlace) {
      const wp = job.workPlace;
      origin = { province: wp.province, oldDistrict: wp.oldDistrict, newWardCode: wp.newWardCode, lat: wp.lat, lon: wp.lon };
    }
    if (!origin) {
      const o = await this.employerOrigin(userId);
      if (o.province) origin = { province: o.province };
    }
    const STALE = 45 * 864e5;
    const isStale = (w: WorkerProfile) => Date.now() - +new Date(w.refreshedAt) > STALE;
    const withDist = rows.map((w) => ({ w, stale: isStale(w), prox: origin ? proximity(origin, { province: w.province, oldDistrict: w.oldDistrict, newWardCode: w.newWardCode, lat: w.lat, lon: w.lon }) : null }));
    // Hồ sơ quá 45 ngày không làm mới luôn xuống cuối (tránh gọi nhầm người đã có việc)
    const matchOf = (w: WorkerProfile, prox: ReturnType<typeof proximity> | null, stale: boolean) => {
      if (!job) return null;
      let sc = 0;
      const why: string[] = [];
      if (job.laborGroup && (w.desiredJobs ?? []).includes(job.laborGroup)) { sc += 35; why.push('Đúng nhóm việc mong muốn'); }
      if (prox) {
        if (prox.km <= 5) { sc += 25; why.push(`Rất gần (~${Math.round(prox.km)} km)`); }
        else if (prox.km <= 10) { sc += 18; why.push(`Gần (~${Math.round(prox.km)} km)`); }
        else if (prox.km <= 20) { sc += 10; why.push(`~${Math.round(prox.km)} km`); }
        if (w.radiusKm && prox.km > w.radiusKm) { sc -= 10; why.push(`Xa hơn ${w.radiusKm} km họ muốn đi`); }
      }
      const sched = job.laborSchedule ?? [];
      if (sched.length && (w.availability ?? []).length && sched.every((x) => (w.availability ?? []).includes(x))) { sc += 15; why.push('Rảnh đúng ca cần người'); }
      const perks = job.laborPerks ?? [];
      if (w.needsHousing && perks.includes('housing')) { sc += 10; why.push('Cần chỗ ở — tin có KTX'); }
      if (w.needsShuttle && perks.includes('shuttle')) { sc += 10; why.push('Cần xe đưa đón — tin có xe'); }
      const fit = fitOf(job, w, true);
      sc += Math.min(20, fit.ok.length * 5);
      for (const m of fit.missing) { sc -= 8; why.push(`Thiếu: ${m.replace(/^Cần /, '').replace(/^Tin ưu tiên /, 'Tin ưu tiên — ')}`); }
      for (const o of fit.ok.slice(0, 2)) why.push(o);
      if (ageOf(effBirth(w)) < 18 && minorUnsafeReason(job)) { sc -= 60; why.push('Chưa đủ 18 tuổi — tin có ca đêm/việc nặng nhọc, không được nhận'); }
      if (job.isUrgent && this.readyNow(w)) { sc += 10; why.push('Đi làm được ngay — tin đang ưu tiên'); }
      const days = (Date.now() - +new Date(w.refreshedAt)) / 864e5;
      if (days <= 7) { sc += 10; why.push('Mới làm mới hồ sơ'); }
      if (stale) sc -= 20;
      return { score: Math.max(0, Math.min(100, sc)), reasons: why };
    };
    const matchMap = new Map<string, { score: number; reasons: string[] }>();
    if (job) for (const x of withDist) matchMap.set(x.w.id, matchOf(x.w, x.prox, x.stale)!);
    if (job && (q.sort ?? 'match') === 'match') withDist.sort((a, b) => matchMap.get(b.w.id)!.score - matchMap.get(a.w.id)!.score || +b.w.refreshedAt - +a.w.refreshedAt);
    else if ((q.sort ?? 'near') === 'near' && origin) withDist.sort((a, b) => Number(a.stale) - Number(b.stale) || a.prox!.km - b.prox!.km || +b.w.refreshedAt - +a.w.refreshedAt);
    else withDist.sort((a, b) => Number(a.stale) - Number(b.stale) || +b.w.refreshedAt - +a.w.refreshedAt);
    const page = Math.max(1, Number(q.page) || 1);
    const size = 20;
    const slice = withDist.slice((page - 1) * size, page * size);
    const ids = slice.map((x) => x.w.id);
    const noteRows = ids.length ? await this.notes.find({ where: { profileId: In(ids) }, order: { createdAt: 'DESC' } }) : [];
    const contactRows = ids.length ? await this.contacts.find({ where: { profileId: In(ids) } }) : [];
    // Mức cạnh tranh: số công ty KHÁC đã liên hệ / ghi chú trong 7 ngày (ẩn danh)
    const since = Date.now() - 7 * 864e5;
    // Đợt 136 — hồ sơ nguồn tổng hợp: che số; công ty đã bấm "Xem số" trong 24 giờ thì hiện số
    const revealed = new Set<string>();
    const maskIds = slice.filter((x) => x.w.isSourced && x.w.ownerCompanyId !== companyId).map((x) => x.w.id);
    if (companyId && maskIds.length) {
      const vr: { pid: string }[] = await this.repo.manager.query(`SELECT DISTINCT profile_id AS pid FROM worker_phone_views WHERE company_id = $1 AND profile_id = ANY($2) AND viewed_at > now() - interval '24 hours'`, [companyId, maskIds]);
      for (const x of vr) revealed.add(x.pid);
    }
    const items = slice.map(({ w, prox, stale }) => {
      const ns = noteRows.filter((n) => n.profileId === w.id);
      const lastHired = ns.find((n) => n.kind === 'hired');
      const cs = contactRows.filter((c) => c.profileId === w.id);
      const mine = companyId ? cs.find((c) => c.companyId === companyId) : undefined;
      const others = new Set([
        ...cs.filter((c) => c.companyId !== companyId && +new Date(c.updatedAt) > since).map((c) => c.companyId),
        ...ns.filter((n) => n.companyId && n.companyId !== companyId && +new Date(n.createdAt) > since).map((n) => n.companyId as string),
      ]);
      const masked = w.isSourced && w.ownerCompanyId !== companyId && !revealed.has(w.id);
      const v = this.view(w);
      return {
        ...v,
        phone: masked ? maskPhone(w.phone) : v.phone,
        phoneMasked: masked,
        mine: !!companyId && w.ownerCompanyId === companyId,
        sourceLabel: w.isSourced ? 'Nguồn tổng hợp' : null,
        age: ageOf(effBirth(w)),
        minor: ageOf(effBirth(w)) < 18,
        readyNow: this.readyNow(w),
        distance: prox,
        outOfRadius: !!(prox && w.radiusKm && prox.km > w.radiusKm),
        stale,
        notes: ns.slice(0, 5).map((n) => ({ id: n.id, kind: n.kind, text: n.text, createdAt: n.createdAt, mine: n.authorUserId === userId || (!!companyId && n.companyId === companyId) })),
        refreshedAfterHired: !!(lastHired && +w.refreshedAt > +lastHired.createdAt),
        myStatus: mine ? { status: mine.status, jobId: mine.jobPostingId ?? null, updatedAt: mine.updatedAt } : null,
        competition: others.size,
        match: matchMap.get(w.id) ?? null,
      };
    });
    return { items, total: withDist.length, page, totalPages: Math.max(1, Math.ceil(withDist.length / size)), origin, jobId: job?.id ?? null };
  }

  private readyNow(w: WorkerProfile) {
    const r = w.extra?.ready;
    return !!r && (r === 'now' || r <= new Date().toISOString().slice(0, 10));
  }

  /** Sổ gọi điện: cập nhật trạng thái liên hệ của công ty với một ứng viên. */
  async setContact(userId: string, profileId: string, body: { status?: string; jobId?: string | null }) {
    const companyId = await this.companyOf(userId);
    if (!companyId) throw new ForbiddenException('Tài khoản chưa liên kết công ty.');
    if (!(await this.repo.count({ where: { id: profileId } }))) throw new NotFoundException('Không tìm thấy ứng viên');
    let c = await this.contacts.findOne({ where: { companyId, profileId } });
    const prevJob = c?.jobPostingId ?? null;
    if (!body.status || body.status === 'none') {
      if (c) await this.contacts.delete({ id: c.id });
      await this.recomputeFill(prevJob);
      return { status: null };
    }
    if (!CALL_STATUSES.includes(body.status)) throw new BadRequestException('Trạng thái không hợp lệ');
    let jobId: string | null = null;
    if (body.jobId) {
      const j = await this.jobs.findOne({ where: { id: body.jobId } });
      if (j && j.companyId === companyId) jobId = j.id;
    }
    const now = new Date();
    if (!c) c = this.contacts.create({ companyId, profileId, authorUserId: userId, createdAt: now });
    Object.assign(c, { status: body.status, jobPostingId: jobId ?? (body.status === 'hired' ? null : c.jobPostingId ?? null), updatedAt: now, authorUserId: userId });
    await this.contacts.save(c);
    await this.recomputeFill(prevJob);
    if (c.jobPostingId !== prevJob) await this.recomputeFill(c.jobPostingId);
    return { status: c.status, jobId: c.jobPostingId ?? null, updatedAt: c.updatedAt };
  }

  async addNote(userId: string, profileId: string, body: { kind?: string; text?: string }) {
    const p = await this.repo.findOne({ where: { id: profileId } });
    if (!p) throw new NotFoundException('Không tìm thấy ứng viên');
    const kind = body.kind === 'hired' ? 'hired' : 'note';
    const text = clip(body.text, 200) ?? (kind === 'hired' ? 'Đã có việc làm' : null);
    if (!text) throw new BadRequestException('Vui lòng nhập ghi chú.');
    const n = await this.notes.save(this.notes.create({ profileId, kind, text, authorUserId: userId, companyId: await this.companyOf(userId), createdAt: new Date() }));
    return { id: n.id, kind: n.kind, text: n.text, createdAt: n.createdAt, mine: true };
  }
  async deleteNote(userId: string, noteId: string) {
    const n = await this.notes.findOne({ where: { id: noteId } });
    if (!n || n.authorUserId !== userId) throw new ForbiddenException('Chỉ xoá được ghi chú của bạn.');
    await this.notes.delete({ id: noteId });
    return { ok: true };
  }

  /** Ứng viên phổ thông đã ứng tuyển vào các tin của công ty (kèm nhóm "rủ bạn" và trạng thái). */
  async employerApplications(userId: string) {
    const companyId = await this.companyOf(userId);
    if (!companyId) return { items: [], jobs: [] };
    const rows = await this.apps
      .createQueryBuilder('a')
      .innerJoin(JobPosting, 'j', 'j.id = a.job_posting_id')
      .innerJoin(WorkerProfile, 'w', 'w.id = a.profile_id')
      .where('j.company_id = :companyId', { companyId })
      .select(['a.id AS id', 'a.created_at AS "createdAt"', 'a.seen_at AS "seenAt"', 'a.status AS status', 'a.group_code AS "groupCode"', 'a.interview_at AS "interviewAt"', 'a.interview_place AS "interviewPlace"', 'a.started_at AS "startedAt"', 'a.cert_requested_at AS "certRequestedAt"', 'j.id AS "jobId"', 'j.title AS "jobTitle"', 'w.id AS "profileId"', 'w.full_name AS "fullName"', 'w.phone AS phone', 'w.province AS province', 'w.new_ward AS "newWard"', 'w.old_district AS "oldDistrict"', 'w.kind AS kind', 'w.desired_jobs AS "desiredJobs"', 'w.birth_date AS "birthDate"', 'w.profile_extra AS extra'])
      .orderBy('a.created_at', 'DESC')
      .limit(500)
      .getRawMany<{ groupCode: string | null; jobId: string }>();
    const sizes = new Map<string, number>();
    for (const r of rows) if (r.groupCode) sizes.set(`${r.jobId}|${r.groupCode}`, (sizes.get(`${r.jobId}|${r.groupCode}`) ?? 0) + 1);
    const items = rows.map((r) => ({ ...r, groupSize: r.groupCode ? sizes.get(`${r.jobId}|${r.groupCode}`) ?? 1 : 1 }));
    // Tiến độ tuyển đủ số lượng cho từng tin phổ thông của công ty
    const jobs = await this.jobs.find({ where: { companyId }, order: { createdAt: 'DESC' }, take: 200 });
    const labor = jobs.filter((j) => j.channel !== 'office');
    const hired = await this.hiredCounts(labor.map((j) => j.id));
    const fc = await this.forecastTable();
    const trust = (await this.trustMap([companyId])).get(companyId) ?? null;
    return {
      trust,
      items,
      jobs: labor.map((j) => {
        const ageDays = Math.floor((Date.now() - +new Date(j.createdAt)) / 864e5);
        const filled = !!j.filledAt;
        return { id: j.id, title: j.title, headcount: j.headcount ?? 1, hired: hired.get(j.id) ?? 0, filled, channel: j.channel, ageDays, deadline: j.deadline ?? null, needExtend: !filled && ageDays >= 30, forecast: filled ? null : fc.get(j.laborGroup ?? '') ?? fc.get(`#${j.channel}`) ?? null };
      }),
    };
  }
  async markSeen(userId: string, appId: string) {
    const a = await this.ownedApp(userId, appId);
    a.seenAt = new Date();
    await this.apps.save(a);
    return { ok: true };
  }
  private async ownedApp(userId: string, appId: string) {
    const companyId = await this.companyOf(userId);
    const a = await this.apps.findOne({ where: { id: appId } });
    const j = a ? await this.jobs.findOne({ where: { id: a.jobPostingId } }) : null;
    if (!a || !j || j.companyId !== companyId) throw new NotFoundException();
    return a;
  }
  async setAppStatus(userId: string, appId: string, status: string) {
    if (!['new', ...CALL_STATUSES].includes(status)) throw new BadRequestException('Trạng thái không hợp lệ');
    const a = await this.ownedApp(userId, appId);
    a.status = status;
    a.seenAt = a.seenAt ?? new Date();
    await this.apps.save(a);
    await this.recomputeFill(a.jobPostingId);
    return { ok: true, status };
  }
  /** NTD tự mở lại / đóng tin khi đã đủ người. */
  async setFilled(userId: string, jobId: string, filled: boolean) {
    const companyId = await this.companyOf(userId);
    const j = await this.jobs.findOne({ where: { id: jobId } });
    if (!j || j.companyId !== companyId) throw new NotFoundException();
    await this.jobs.update({ id: jobId }, { filledAt: filled ? new Date() : null });
    return { ok: true, filled };
  }

  /** Đợt 81 — gia hạn thêm 30 ngày cho tin phổ thông chưa tuyển đủ. */
  async extendJob(userId: string, jobId: string) {
    const companyId = await this.companyOf(userId);
    const j = await this.jobs.findOne({ where: { id: jobId } });
    if (!j || j.companyId !== companyId) throw new NotFoundException();
    const today = new Date().toISOString().slice(0, 10);
    const base = j.deadline && j.deadline > today ? new Date(j.deadline) : new Date(today);
    base.setUTCDate(base.getUTCDate() + 30);
    const deadline = base.toISOString().slice(0, 10);
    await this.jobs.update({ id: jobId }, { deadline });
    return { ok: true, deadline };
  }

  /** Đợt 80 — nguồn lao động quanh công ty: số người đang tìm việc theo quận/huyện (tỉnh công ty) và các tỉnh lân cận. */
  async supply(userId: string, q: EmployerSearch) {
    let origin = this.originFrom(q);
    if (!origin) {
      const o = await this.employerOrigin(userId);
      if (o.province) origin = { province: o.province };
    }
    const kind = KINDS.includes(q.kind as WorkerKind) ? q.kind : undefined;
    const qb = this.repo
      .createQueryBuilder('w')
      .where('w.isHidden = false')
      .andWhere('w.isSeeking = true')
      .andWhere("w.refreshed_at > now() - interval '45 days'");
    const myCo = await this.companyOf(userId);
    qb.andWhere(myCo ? "(w.owner_company_id IS NULL OR w.owner_company_id = :myCo OR w.share_status = 'shared')" : "(w.owner_company_id IS NULL OR w.share_status = 'shared')", myCo ? { myCo } : {});
    if (kind) qb.andWhere('w.kind = :kind', { kind });
    if (q.group) qb.andWhere("(',' || w.desired_jobs || ',') LIKE :g", { g: `%,${q.group},%` });
    const rows = await qb.select(['w.id', 'w.province', 'w.oldDistrict', 'w.newWardCode', 'w.kind', 'w.needsHousing', 'w.needsShuttle', 'w.refreshedAt']).getMany();
    // Đợt 81 — giờ vàng: giờ (giờ VN) ứng viên hay làm mới hồ sơ → đăng tin/gọi điện đúng lúc họ online
    const hours = new Array(24).fill(0) as number[];
    for (const w of rows) hours[new Date(+new Date(w.refreshedAt) + 7 * 3600e3).getUTCHours()]++;
    const bestHours = hours.map((n, h) => ({ h, n })).sort((a, b) => b.n - a.n).slice(0, 3).filter((x) => x.n > 0).sort((a, b) => a.h - b.h);
    const dropout = await this.dropout(kind);
    if (!origin) return { origin: null, districts: [], provinces: [], hours, bestHours, dropout };
    const inProv = rows.filter((w) => w.province === origin!.province);
    const byD = new Map<string, { district: string; total: number; worker: number; student: number; intern: number; housing: number; shuttle: number }>();
    for (const w of inProv) {
      const d = districtLabel(w);
      const e = byD.get(d) ?? { district: d, total: 0, worker: 0, student: 0, intern: 0, housing: 0, shuttle: 0 };
      e.total++;
      e[w.kind]++;
      if (w.needsHousing) e.housing++;
      if (w.needsShuttle) e.shuttle++;
      byD.set(d, e);
    }
    const c0 = provinceCentroid(origin.province);
    const byP = new Map<string, number>();
    for (const w of rows) if (w.province !== origin.province) byP.set(w.province, (byP.get(w.province) ?? 0) + 1);
    const provinces = Array.from(byP.entries())
      .map(([province, total]) => {
        const c = provinceCentroid(province);
        return { province, total, km: c0 && c ? Math.round(haversineKm(c0, c)) : 999 };
      })
      .filter((p) => p.km <= 150)
      .sort((a, b) => a.km - b.km)
      .slice(0, 8);
    return { origin, totalInProvince: inProv.length, districts: Array.from(byD.values()).sort((a, b) => b.total - a.total), provinces, hours, bestHours, dropout };
  }

  /** Đợt 81 — tỷ lệ "nhận việc rồi không đi làm" theo nhóm việc (ẩn danh, từ sổ gọi & đơn ứng tuyển của mọi công ty). */
  async dropout(kind?: string) {
    const rows: { grp: string; hired: number; no_show: number }[] = await this.repo.manager.query(
      `SELECT COALESCE(j.labor_group, 'Khác') AS grp, SUM((t.st = 'hired')::int)::int AS hired, SUM((t.st = 'no_show')::int)::int AS no_show
       FROM (
         SELECT job_posting_id AS job, profile_id AS pid, status AS st FROM worker_applications WHERE status IN ('hired','no_show')
         UNION SELECT job_posting_id, profile_id, status FROM worker_contacts WHERE status IN ('hired','no_show') AND job_posting_id IS NOT NULL
       ) t JOIN job_postings j ON j.id = t.job
       WHERE ($1::text IS NULL OR j.channel = $1)
       GROUP BY 1`,
      [kind ?? null],
    );
    return rows
      .filter((r) => r.hired + r.no_show >= 3)
      .map((r) => {
        const rate = Math.round((r.no_show / (r.hired + r.no_show)) * 100);
        return { group: r.grp, hired: r.hired, noShow: r.no_show, rate, extraPct: Math.min(50, Math.ceil(rate * 1.2)) };
      })
      .sort((a, b) => b.rate - a.rate);
  }

  // ---------- ứng viên: lịch sử ứng tuyển, tạm ngưng, báo cáo (Đợt 81) ----------
  private async applicationsOf(p: WorkerProfile) {
    const rows = await this.apps.find({ where: { profileId: p.id }, order: { createdAt: 'DESC' }, take: 50 });
    const jobs = rows.length ? await this.jobs.find({ where: { id: In(rows.map((r) => r.jobPostingId)) }, relations: { company: true } }) : [];
    const byId = new Map(jobs.map((j) => [j.id, j]));
    return {
      isSeeking: p.isSeeking,
      examMode: p.examMode ?? null,
      examUntil: p.examUntil ? String(p.examUntil).slice(0, 10) : null,
      kind: p.kind,
      items: rows.map((r) => {
        const j = byId.get(r.jobPostingId);
        return { id: r.id, jobId: r.jobPostingId, title: j?.title ?? 'Tin đã gỡ', company: j?.company?.name ?? null, createdAt: r.createdAt, status: r.status ?? 'new', seen: !!r.seenAt, filled: !!j?.filledAt, groupCode: r.groupCode ?? null, interviewAt: r.interviewAt ?? null, interviewPlace: r.interviewPlace ?? null, startedAt: r.startedAt ?? null, certRequestedAt: r.certRequestedAt ?? null, workPlace: j?.workPlace ? [j.workPlace.oldWard ?? j.workPlace.newWard, j.workPlace.oldDistrict, j.workPlace.province].filter(Boolean).join(', ') : null, laborGroup: j?.laborGroup ?? null, channel: j?.channel ?? null };
      }),
    };
  }
  async myApplications(phone: string, birthDate: string) {
    return this.applicationsOf(await this.verified(phone, birthDate));
  }
  async myApplicationsMine(userId: string) {
    const p = await this.repo.findOne({ where: { userId } });
    if (!p) return { isSeeking: false, items: [] };
    return this.applicationsOf(p);
  }
  /** Đợt 84 — thực tập sinh xin xác nhận thực tập (chỉ khi đã nhận việc/đi làm). */
  private async requestCert(p: WorkerProfile, appId: string) {
    const a = await this.apps.findOne({ where: { id: appId, profileId: p.id } });
    if (!a) throw new NotFoundException('Không tìm thấy đơn ứng tuyển');
    if (p.kind !== 'intern') throw new BadRequestException('Chỉ dành cho thực tập sinh.');
    if (a.status !== 'hired' && !a.startedAt) throw new BadRequestException('Bạn chỉ xin xác nhận được sau khi đã nhận việc / đi làm.');
    a.certRequestedAt = new Date();
    await this.apps.save(a);
    return { ok: true, certRequestedAt: a.certRequestedAt };
  }
  async requestCertGuest(phone: string, birthDate: string, appId: string) {
    return this.requestCert(await this.verified(phone, birthDate), appId);
  }
  async requestCertMine(userId: string, appId: string) {
    const p = await this.repo.findOne({ where: { userId } });
    if (!p) throw new NotFoundException('Chưa có hồ sơ.');
    return this.requestCert(p, appId);
  }

  async setSeeking(p: WorkerProfile, seeking: boolean) {
    p.isSeeking = seeking;
    if (seeking) p.refreshedAt = new Date();
    await this.repo.save(p);
    return { ok: true, isSeeking: seeking };
  }
  async setSeekingGuest(phone: string, birthDate: string, seeking: boolean) {
    return this.setSeeking(await this.verified(phone, birthDate), seeking);
  }
  async setSeekingMine(userId: string, seeking: boolean) {
    const p = await this.repo.findOne({ where: { userId } });
    if (!p) throw new BadRequestException('Bạn chưa có hồ sơ lao động phổ thông.');
    return this.setSeeking(p, seeking);
  }
  /** Khách/ứng viên báo cáo tin đáng ngờ — vào hàng chờ "Người dùng báo cáo" của Admin. */
  async reportJob(jobId: string, reason: string, note?: string) {
    const j = await this.jobs.findOne({ where: { id: jobId } });
    if (!j) throw new NotFoundException('Không tìm thấy tin');
    const r = ['scam', 'duplicate', 'expired', 'wrong_info', 'discrimination', 'other'].includes(reason) ? reason : 'other';
    const text = fold(note ?? '');
    let category = r;
    if (r === 'other' || r === 'wrong_info') {
      if (/dat coc|nop phi|lua dao|chuyen khoan|thu tien|da cap|giu cccd|giu cmnd/.test(text)) category = 'scam';
      else if (/het han|da tuyen|dong tin|khong con tuyen/.test(text)) category = 'expired';
    }
    const open = await this.reports.count({ where: { jobPostingId: jobId, status: 'open' } });
    await this.reports.save(this.reports.create({ jobPostingId: jobId, reporterUserId: null, reason: r, note: (note ?? '').slice(0, 1000) || null, category, priority: category === 'scam' || open >= 2 ? 'high' : 'normal' }));
    return { ok: true };
  }

  // ---------- Đợt 83 ----------
  /** Số ngày trung bình để tin được tuyển đủ, theo nhóm việc (≥3 mẫu) hoặc theo loại kênh. */
  private async forecastTable() {
    const m = new Map<string, { days: number; samples: number; scope: string }>();
    const rows: { g: string | null; ch: string; d: number; n: number }[] = await this.repo.manager.query(
      `SELECT labor_group AS g, channel AS ch, AVG(EXTRACT(EPOCH FROM (filled_at - created_at)) / 86400)::float AS d, COUNT(*)::int AS n
       FROM job_postings WHERE channel <> 'office' AND filled_at IS NOT NULL GROUP BY labor_group, channel`,
    );
    const byCh = new Map<string, { sum: number; n: number }>();
    for (const r of rows) {
      if (r.g && r.n >= 3) m.set(r.g, { days: Math.max(1, Math.round(r.d)), samples: r.n, scope: r.g });
      const e = byCh.get(r.ch) ?? { sum: 0, n: 0 };
      e.sum += r.d * r.n;
      e.n += r.n;
      byCh.set(r.ch, e);
    }
    for (const [ch, e] of byCh) if (e.n >= 3) m.set(`#${ch}`, { days: Math.max(1, Math.round(e.sum / e.n)), samples: e.n, scope: 'cùng loại tin' });
    return m;
  }

  minWage(province?: string) {
    return minWageOf(province);
  }

  /** Tin tương tự khi tin đã đủ người / đã đóng. */
  async similar(jobId: string) {
    const j = await this.jobs.findOne({ where: { id: jobId } });
    if (!j || j.channel === 'office') return { items: [] };
    const prov = j.workPlace?.province ?? j.provinces?.[0];
    const params: Record<string, string | undefined> = { kind: j.channel, hideFilled: '1', pageSize: '8', sort: 'new', province: prov, group: j.laborGroup ?? undefined };
    if (j.workPlace?.province) Object.assign(params, { oProvince: j.workPlace.province, oDistrict: j.workPlace.oldDistrict ?? undefined, oWard: j.workPlace.newWardCode ?? undefined, sort: 'near' });
    let r = await this.browse(params);
    if (r.items.filter((x) => x.id !== jobId).length < 3) r = await this.browse({ ...params, group: undefined });
    return { items: r.items.filter((x) => x.id !== jobId).slice(0, 4) };
  }

  /** Mùa thi: pause (ẩn tới ngày) | weekend (chỉ nhận ca cuối tuần) | off. */
  private async setExam(p: WorkerProfile, mode: string, until?: string) {
    if (mode === 'off' || !mode) {
      p.examMode = null;
      p.examUntil = null;
    } else {
      if (!['pause', 'weekend'].includes(mode)) throw new BadRequestException('Chế độ không hợp lệ');
      const d = String(until ?? '').slice(0, 10);
      const t = new Date(d).getTime();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !(t > Date.now() - 864e5) || t > Date.now() + 120 * 864e5) throw new BadRequestException('Ngày kết thúc mùa thi phải trong 120 ngày tới.');
      p.examMode = mode;
      p.examUntil = d;
      if (mode === 'weekend') p.availability = (p.availability ?? []).filter((x) => x.startsWith('t7') || x.startsWith('cn'));
    }
    await this.repo.save(p);
    return { ok: true, examMode: p.examMode ?? null, examUntil: p.examUntil ?? null };
  }
  async setExamGuest(phone: string, birthDate: string, mode: string, until?: string) {
    return this.setExam(await this.verified(phone, birthDate), mode, until);
  }
  async setExamMine(userId: string, mode: string, until?: string) {
    const p = await this.repo.findOne({ where: { userId } });
    if (!p) throw new BadRequestException('Bạn chưa có hồ sơ lao động phổ thông.');
    return this.setExam(p, mode, until);
  }

  /** Hẹn phỏng vấn cho một hoặc nhiều đơn ứng tuyển (phỏng vấn nhóm). */
  async setInterview(userId: string, appIds: string[], at: string, place?: string) {
    const when = new Date(at);
    if (!appIds?.length || Number.isNaN(+when)) throw new BadRequestException('Vui lòng chọn ngày giờ phỏng vấn hợp lệ.');
    if (+when < Date.now() - 3600e3) throw new BadRequestException('Thời gian phỏng vấn phải ở tương lai.');
    let n = 0;
    for (const id of appIds.slice(0, 100)) {
      const a = await this.ownedApp(userId, id).catch(() => null);
      if (!a) continue;
      a.status = 'interview';
      a.interviewAt = when;
      a.interviewPlace = clip(place, 200);
      a.seenAt = a.seenAt ?? new Date();
      await this.apps.save(a);
      n++;
    }
    return { ok: true, updated: n };
  }
  /** Điểm danh ngày đầu: có đi làm → đã nhận việc; vắng → ghi "nhận việc nhưng không đi làm". */
  async markStart(userId: string, appId: string, attended: boolean) {
    const a = await this.ownedApp(userId, appId);
    if (attended) {
      a.status = 'hired';
      a.startedAt = new Date();
    } else {
      a.status = 'no_show';
      a.startedAt = null;
    }
    await this.apps.save(a);
    await this.recomputeFill(a.jobPostingId);
    return { ok: true, status: a.status };
  }

  // ---------- admin ----------
  async adminStats() {
    const raw = await this.repo
      .createQueryBuilder('w')
      .select('w.kind', 'kind')
      .addSelect('COUNT(*)::int', 'n')
      .addSelect('SUM(CASE WHEN w.refreshed_at > now() - interval \'30 days\' THEN 1 ELSE 0 END)::int', 'fresh')
      .addSelect('SUM(CASE WHEN w.is_hidden THEN 1 ELSE 0 END)::int', 'hidden')
      .groupBy('w.kind')
      .getRawMany();
    const apps = await this.apps.count();
    const contacts = await this.contacts.count();
    return { items: raw, apps, contacts, provinces: await this.provinceBalance() };
  }
  /** Đợt 81 — cung/cầu theo tỉnh: người đang tìm việc (45 ngày) so với chỗ còn trống ở các tin đang mở. */
  async provinceBalance() {
    const seekers: { province: string; n: number }[] = await this.repo.manager.query(
      `SELECT province, COUNT(*)::int AS n FROM worker_profiles WHERE is_hidden = false AND is_seeking = true AND refreshed_at > now() - interval '45 days' GROUP BY province`,
    );
    const open = await this.jobs
      .createQueryBuilder('j')
      .where('j.approvalStatus = :a', { a: JobApprovalStatus.APPROVED })
      .andWhere('j.isPaused = false')
      .andWhere("j.channel <> 'office'")
      .andWhere('j.filledAt IS NULL')
      .andWhere('(j.deadline IS NULL OR j.deadline >= CURRENT_DATE)')
      .getMany();
    const hired = await this.hiredCounts(open.map((j) => j.id));
    const slots = new Map<string, { slots: number; jobs: number }>();
    for (const j of open) {
      const prov = j.workPlace?.province ?? j.provinces?.[0];
      if (!prov) continue;
      const e = slots.get(prov) ?? { slots: 0, jobs: 0 };
      e.slots += Math.max(0, (j.headcount ?? 1) - (hired.get(j.id) ?? 0));
      e.jobs += 1;
      slots.set(prov, e);
    }
    const names = new Set([...seekers.map((x) => x.province), ...slots.keys()]);
    return Array.from(names)
      .map((province) => {
        const s1 = seekers.find((x) => x.province === province)?.n ?? 0;
        const e = slots.get(province) ?? { slots: 0, jobs: 0 };
        const label = s1 > e.slots * 2 ? 'Người tìm việc nhiều hơn chỗ trống' : e.slots > s1 ? 'Chỗ trống nhiều hơn người tìm việc' : 'Tương đối cân bằng';
        return { province, seekers: s1, slots: e.slots, jobs: e.jobs, label, gap: s1 - e.slots };
      })
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
      .slice(0, 30);
  }
  /** Đợt 83 — tin lặp: cùng SĐT liên hệ ở nhiều công ty, hoặc cùng nội dung đăng ở nhiều tỉnh/công ty (nghi môi giới). */
  async adminDuplicateJobs() {
    const rows = await this.jobs.find({ where: { channel: In(['worker', 'student', 'intern']) }, relations: { company: true }, order: { createdAt: 'DESC' }, take: 3000 });
    const mk = (j: JobPosting) => ({ id: j.id, title: j.title, company: j.company?.name ?? null, province: j.workPlace?.province ?? j.provinces?.[0] ?? null, createdAt: j.createdAt, status: j.approvalStatus });
    const groups: { key: string; reason: string; jobs: ReturnType<typeof mk>[] }[] = [];
    const byPhone = new Map<string, JobPosting[]>();
    const byText = new Map<string, JobPosting[]>();
    for (const j of rows) {
      const ph = (j.contactPhone ?? '').replace(/\D/g, '');
      if (ph.length >= 9) byPhone.set(ph, [...(byPhone.get(ph) ?? []), j]);
      const t = fold(`${j.title} ${(j.description ?? '').replace(/<[^>]*>/g, ' ')}`).slice(0, 220);
      if (t.length > 40) byText.set(t, [...(byText.get(t) ?? []), j]);
    }
    for (const [ph, l] of byPhone) if (new Set(l.map((x) => x.companyId)).size >= 2) groups.push({ key: `p:${ph}`, reason: `Cùng số liên hệ ${ph} xuất hiện ở ${new Set(l.map((x) => x.companyId)).size} công ty khác nhau`, jobs: l.slice(0, 8).map(mk) });
    for (const [k, l] of byText) {
      const comps = new Set(l.map((x) => x.companyId)).size;
      const provs = new Set(l.map((x) => x.workPlace?.province ?? x.provinces?.[0] ?? '')).size;
      if (l.length >= 2 && (comps >= 2 || provs >= 3)) groups.push({ key: `t:${k.slice(0, 30)}`, reason: comps >= 2 ? `Nội dung giống hệt ở ${comps} công ty khác nhau` : `Cùng một tin đăng lặp ở ${provs} tỉnh`, jobs: l.slice(0, 8).map(mk) });
    }
    return { items: groups.slice(0, 50) };
  }

  /** Đợt 83 — gom việc cần admin xử lý trong ngày. */
  async adminTodo() {
    const [rep]: { n: number }[] = await this.repo.manager.query(`SELECT COUNT(DISTINCT job_posting_id)::int AS n FROM job_reports WHERE status = 'open'`);
    const sus = await this.adminSuspicious();
    const dup = await this.adminDuplicateJobs();
    const pending = await this.jobs.find({ where: { channel: In(['worker', 'student', 'intern']), approvalStatus: JobApprovalStatus.PENDING }, order: { createdAt: 'DESC' }, take: 100 });
    const risky = pending
      .map((j) => ({ j, r: assessJobRisk(j as unknown as RiskJob, { others: [] }) }))
      .filter((x) => x.r.score >= 40)
      .map((x) => ({ id: x.j.id, title: x.j.title, score: x.r.score, reasons: x.r.reasons.slice(0, 3) }));
    const bal = (await this.provinceBalance()).filter((x) => Math.abs(x.gap) >= 5).slice(0, 3);
    return { openReports: rep?.n ?? 0, suspicious: sus.items.length, duplicates: dup.items.length, pendingTotal: pending.length, riskyPending: risky, imbalance: bal };
  }
  // ===== Đợt 135 — Admin quản lý hồ sơ lao động phổ thông (giống tab Ứng viên văn phòng) =====
  async adminList(q: Record<string, string | undefined>) {
    const qb = this.repo.createQueryBuilder('w');
    if (q.kind && KINDS.includes(q.kind as WorkerKind)) qb.andWhere('w.kind = :k', { k: q.kind });
    if (q.province) qb.andWhere('w.province = :pv', { pv: q.province });
    if (q.group) qb.andWhere("(',' || w.desired_jobs || ',') LIKE :g", { g: `%,${q.group},%` });
    if (q.shift) qb.andWhere("(',' || w.shifts || ',') LIKE :sh", { sh: `%,${q.shift},%` });
    if (q.seeking === '1') qb.andWhere('w.is_seeking = true');
    if (q.seeking === '0') qb.andWhere('w.is_seeking = false');
    if (q.hidden === '1') qb.andWhere('w.is_hidden = true');
    else if (q.hidden !== 'all') qb.andWhere('w.is_hidden = false');
    if (q.source === 'self') qb.andWhere('w.is_sourced = false');
    if (q.source === 'sourced') qb.andWhere('w.is_sourced = true');
    if (q.source === 'ntd') qb.andWhere('w.owner_company_id IS NOT NULL');
    if (q.account === '1') qb.andWhere('w.user_id IS NOT NULL');
    if (q.account === '0') qb.andWhere('w.user_id IS NULL');
    if (q.tag) qb.andWhere(':tag = ANY(w.admin_tags)', { tag: q.tag });
    if (q.stale === '1') qb.andWhere("w.refreshed_at < now() - interval '30 days'");
    const text = (q.q ?? '').trim();
    if (text) {
      const digits = text.replace(/\D/g, '');
      const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
      qb.andWhere(`(${unaccentSql('w.full_name')} LIKE :t OR ${unaccentSql("coalesce(w.admin_note,'')")} LIKE :t OR ${unaccentSql("coalesce(w.desired_jobs,'')")} LIKE :t${digits.length >= 3 ? ' OR w.phone LIKE :d OR w.relative_phone LIKE :d' : ''})`, { t: `%${t}%`, d: `%${digits}%` });
    }
    const sort = q.sort === 'new' ? 'w.created_at' : 'w.refreshed_at';
    qb.orderBy(sort, 'DESC');
    const size = 20;
    const page = Math.max(1, Number(q.page) || 1);
    const [rows, total] = await qb.skip((page - 1) * size).take(size).getManyAndCount();
    const ids = rows.map((r) => r.id);
    const appN: { pid: string; n: number }[] = ids.length ? await this.repo.manager.query('SELECT profile_id AS pid, COUNT(*)::int AS n FROM worker_applications WHERE profile_id = ANY($1) GROUP BY profile_id', [ids]) : [];
    const callN: { pid: string; n: number }[] = ids.length ? await this.repo.manager.query('SELECT profile_id AS pid, COUNT(*)::int AS n FROM worker_contacts WHERE profile_id = ANY($1) GROUP BY profile_id', [ids]) : [];
    const ownerIds = Array.from(new Set(rows.map((r) => r.ownerCompanyId).filter((x): x is string => !!x)));
    const cname = new Map((ownerIds.length ? await this.companies.find({ where: { id: In(ownerIds) }, select: { id: true, name: true } }) : []).map((c) => [c.id, c.name]));
    const am = new Map(appN.map((x) => [x.pid, x.n]));
    const cm = new Map(callN.map((x) => [x.pid, x.n]));
    const counts: { kind: string; n: number }[] = await this.repo.manager.query('SELECT kind, COUNT(*)::int AS n FROM worker_profiles WHERE is_hidden = false GROUP BY kind');
    const srcCounts: { src: string; n: number }[] = await this.repo.manager.query("SELECT CASE WHEN owner_company_id IS NOT NULL THEN 'ntd' WHEN is_sourced THEN 'sourced' ELSE 'self' END AS src, COUNT(*)::int AS n FROM worker_profiles WHERE is_hidden = false GROUP BY 1");
    return {
      items: rows.map((w) => ({
        id: w.id, kind: w.kind, fullName: w.fullName, phone: w.phone, gender: w.gender, age: ageOf(effBirth(w)),
        province: w.province, place: districtLabel({ province: w.province, oldDistrict: w.oldDistrict, newWardCode: w.newWardCode }),
        desiredJobs: w.desiredJobs ?? [], shifts: w.shifts ?? [], isSeeking: w.isSeeking, isHidden: w.isHidden, hasAccount: !!w.userId,
        refreshedAt: w.refreshedAt, createdAt: w.createdAt, tags: w.adminTags ?? [], note: w.adminNote ?? null,
        isSourced: w.isSourced, sourceLabel: w.sourceLabel ?? null, shareStatus: w.ownerCompanyId ? w.shareStatus ?? 'pending' : null, ownerCompany: w.ownerCompanyId ? cname.get(w.ownerCompanyId) ?? null : null,
        applications: am.get(w.id) ?? 0, calls: cm.get(w.id) ?? 0,
      })),
      total, page, totalPages: Math.max(1, Math.ceil(total / size)),
      counts: Object.fromEntries(counts.map((c) => [c.kind, c.n])),
      sourceCounts: Object.fromEntries(srcCounts.map((c) => [c.src, c.n])),
    };
  }

  async adminTags() {
    const rows: { tag: string; n: number }[] = await this.repo.manager.query('SELECT t AS tag, COUNT(*)::int AS n FROM worker_profiles, unnest(admin_tags) t GROUP BY t ORDER BY n DESC, t LIMIT 200');
    return rows.map((r) => ({ tag: r.tag, count: r.n }));
  }

  async adminDetail(id: string) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Không tìm thấy hồ sơ');
    const apps: { id: string; status: string; createdAt: Date; jobId: string; title: string; company: string }[] = await this.repo.manager.query(
      `SELECT a.id, a.status, a.created_at AS "createdAt", j.id AS "jobId", j.title, c.name AS company
       FROM worker_applications a JOIN job_postings j ON j.id = a.job_posting_id LEFT JOIN companies c ON c.id = j.company_id
       WHERE a.profile_id = $1 ORDER BY a.created_at DESC LIMIT 50`, [id]);
    const calls: { status: string; updatedAt: Date; company: string; jobTitle: string | null }[] = await this.repo.manager.query(
      `SELECT k.status, k.updated_at AS "updatedAt", c.name AS company, j.title AS "jobTitle"
       FROM worker_contacts k LEFT JOIN companies c ON c.id = k.company_id LEFT JOIN job_postings j ON j.id = k.job_posting_id
       WHERE k.profile_id = $1 ORDER BY k.updated_at DESC LIMIT 50`, [id]);
    const notes = await this.notes.find({ where: { profileId: id }, order: { createdAt: 'DESC' }, take: 30 });
    return { profile: { ...this.view(p), isSourced: p.isSourced, sourceLabel: p.sourceLabel ?? null, shareStatus: p.ownerCompanyId ? p.shareStatus ?? 'pending' : null, isHidden: p.isHidden, hasAccount: !!p.userId, tags: p.adminTags ?? [], note: p.adminNote ?? null }, applications: apps, calls, notes: notes.map((n) => ({ kind: n.kind, text: n.text, createdAt: n.createdAt })) };
  }

  async adminSetMeta(id: string, b: { tags?: string[]; note?: string | null }) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (Array.isArray(b.tags)) p.adminTags = Array.from(new Set(b.tags.map((t) => String(t).trim().slice(0, 40)).filter(Boolean))).slice(0, 15);
    if (b.note !== undefined) p.adminNote = b.note ? String(b.note).slice(0, 1000) : null;
    await this.repo.save(p);
    return { ok: true, tags: p.adminTags ?? [], note: p.adminNote ?? null };
  }

  /** Gợi ý tin phù hợp: cùng kênh, gần nơi ở, đúng việc muốn làm / ca / nhu cầu (dùng chung bộ chấm điểm của trang việc làm). */
  async adminSuggest(id: string) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Không tìm thấy hồ sơ');
    const r = await this.browse({
      kind: p.kind, sort: 'match', hideFilled: '1', pageSize: '10',
      oProvince: p.province, oDistrict: p.oldDistrict ?? undefined, oWard: p.newWardCode ?? undefined,
      oLat: p.lat != null ? String(p.lat) : undefined, oLon: p.lon != null ? String(p.lon) : undefined,
      groups: (p.desiredJobs ?? []).join('|'), avail: (p.availability ?? []).join(','),
      needs: [p.needsHousing ? 'housing' : '', p.needsShuttle ? 'shuttle' : ''].filter(Boolean).join(','),
      shifts: (p.shifts ?? []).join(',') || undefined,
    });
    // không có tin đúng ca → bỏ điều kiện ca
    const items = r.items.length ? r.items : (await this.browse({ kind: p.kind, sort: 'match', hideFilled: '1', pageSize: '10', oProvince: p.province, oDistrict: p.oldDistrict ?? undefined, groups: (p.desiredJobs ?? []).join('|') })).items;
    const applied = new Set((await this.apps.find({ where: { profileId: id }, select: { jobPostingId: true } })).map((a) => a.jobPostingId));
    return items.map((j) => ({ id: j.id, title: j.title, company: j.company?.name ?? '', distance: j.distance?.label ?? null, salaryMin: j.salaryMin, salaryMax: j.salaryMax, matched: j.matched, applied: applied.has(j.id) }));
  }

  /** Mời ứng tuyển: người có tài khoản nhận thông báo trong web (+ email nếu bật); không có tài khoản → trả về SĐT để Admin gọi/Zalo. */
  async adminInvite(id: string, jobId: string) {
    const p = await this.repo.findOne({ where: { id } });
    const job = await this.jobs.findOne({ where: { id: jobId }, relations: { company: true } });
    if (!p || !job) throw new NotFoundException('Không tìm thấy hồ sơ hoặc tin');
    if (p.userId) {
      await this.notifications.createMany([p.userId], 'job_invite', `Có việc phù hợp với bạn: "${job.title}" — ${job.company?.name ?? ''}. Bấm để xem và ứng tuyển nhanh.`, `/viec-lam/${job.id}`);
      return { ok: true, via: 'notification' as const };
    }
    return { ok: false, via: 'phone' as const, phone: p.phone, message: `Người này chưa có tài khoản — gọi hoặc nhắn Zalo ${p.phone} kèm link tin: /viec-lam/${job.id}` };
  }

  async adminHide(id: string, hidden: boolean) {
    await this.repo.update({ id }, { isHidden: hidden });
    return { ok: true };
  }

  /** Đợt 80 — phát hiện hồ sơ ảo / môi giới đăng hàng loạt (quy tắc, không dùng AI). */
  async adminSuspicious() {
    const all = await this.repo.find({ select: { id: true, fullName: true, phone: true, relativePhone: true, birthDate: true, createdAt: true, isHidden: true, kind: true, province: true }, order: { createdAt: 'DESC' }, take: 20000 });
    const groups: { key: string; reason: string; score: number; profiles: typeof all }[] = [];
    const push = (key: string, reason: string, score: number, list: typeof all) => groups.push({ key, reason, score, profiles: list });
    // 1) Một số người thân dùng cho ≥3 hồ sơ
    const byRel = new Map<string, typeof all>();
    for (const p of all) if (p.relativePhone) byRel.set(p.relativePhone, [...(byRel.get(p.relativePhone) ?? []), p]);
    for (const [rel, list] of byRel) if (list.length >= 3) push(`rel:${rel}`, `Cùng số người thân ${rel} cho ${list.length} hồ sơ`, 30 + list.length * 5, list);
    // 2) Cùng họ tên + ngày sinh nhưng khác số điện thoại
    const byNameBirth = new Map<string, typeof all>();
    for (const p of all) {
      if (!p.birthDate) continue;
      const k = `${fold(p.fullName)}|${String(p.birthDate).slice(0, 10)}`;
      byNameBirth.set(k, [...(byNameBirth.get(k) ?? []), p]);
    }
    for (const [k, list] of byNameBirth) if (list.length >= 2) push(`nb:${k}`, `Trùng họ tên + ngày sinh với ${list.length} số điện thoại khác nhau`, 25 + list.length * 5, list);
    // 3) Số điện thoại liền dãy (giống 8 số đầu) tạo dồn trong 24 giờ
    const byPrefix = new Map<string, typeof all>();
    for (const p of all) byPrefix.set(p.phone.slice(0, 8), [...(byPrefix.get(p.phone.slice(0, 8)) ?? []), p]);
    for (const [pre, list] of byPrefix) {
      if (list.length < 4) continue;
      const times = list.map((p) => +new Date(p.createdAt)).sort((a, b) => a - b);
      let burst = 0;
      for (let i = 0, j = 0; j < times.length; j++) {
        while (times[j] - times[i] > 864e5) i++;
        burst = Math.max(burst, j - i + 1);
      }
      if (burst >= 4) push(`pre:${pre}`, `${burst} hồ sơ có số liền dãy ${pre}xx tạo trong 24 giờ`, 40 + burst * 3, list);
    }
    // 4) Số cá nhân của hồ sơ này là số người thân của ≥3 hồ sơ khác (người "đăng hộ" hàng loạt)
    const phones = new Map(all.map((p) => [p.phone, p]));
    for (const [rel, list] of byRel) {
      const owner = phones.get(rel);
      if (owner && list.length >= 3) push(`own:${rel}`, `Số của ${owner.fullName} là số người thân của ${list.length} hồ sơ — nghi đăng hộ/môi giới`, 35 + list.length * 4, [owner, ...list]);
    }
    return {
      items: groups
        .sort((a, b) => b.score - a.score)
        .slice(0, 100)
        .map((g) => ({ ...g, profiles: g.profiles.slice(0, 12).map((p) => ({ id: p.id, fullName: p.fullName, phone: p.phone, kind: p.kind, province: p.province, createdAt: p.createdAt, isHidden: p.isHidden })) })),
    };
  }
}
