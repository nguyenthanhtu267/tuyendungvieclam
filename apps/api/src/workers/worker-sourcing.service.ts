import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WorkerPhoneView, WorkerProfile } from '../database/entities/worker-profile.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';
import { AdminActor, SYSTEM_ACTOR, logAdminAction } from '../admin-tools/admin-audit';
import { cleanProfileExtra } from './labor-extra';
import { LABOR_GROUPS, LaborKind, SHIFTS_BY_KIND } from './labor-groups';
import { resolvePlace } from './vn-geo';
import { ParsedWorker, parseWorkerPost, parseWorkerTable } from './worker-post-parser';

// Đợt 136 — thu thập hồ sơ lao động phổ thông từ nhiều nguồn:
//  (1) Admin dán bài Zalo/Facebook → form xem lại → lưu "Nguồn tổng hợp"
//  (2) Admin dán nhiều dòng (Excel/CSV) → xem trước hợp lệ/trùng/thiếu → lưu hàng loạt
//  (3) NTD tự nhập vào "Kho người lao động của tôi" (chỉ công ty đó thấy) → Admin chia sẻ (tay hoặc tự động 15 phút)
//  (4) Xem số điện thoại hồ sơ nguồn tổng hợp: NTD bấm "Xem số", ghi nhật ký, tối đa 30 lượt/24 giờ/công ty
//  (5) Chính chủ gỡ / nhận lại hồ sơ ở trang công khai (SĐT + ngày/năm sinh).
// Đơn đã nộp cho 1 công ty: hồ sơ lao động thật vốn đã công khai cho mọi NTD (người lao động đã đồng ý khi điền) nên không cần hàng chờ.
export const AUTO_SHARE_MIN = 15;
export const PHONE_VIEW_LIMIT = 30;

export interface SourcedInput {
  fullName?: string | null;
  phone?: string | null;
  gender?: string | null;
  birthYear?: number | null;
  birthDate?: string | null;
  province?: string | null;
  oldDistrict?: string | null;
  kind?: string | null;
  desiredJobs?: string[] | null;
  shifts?: string[] | null;
  experience?: string | null;
  needsHousing?: boolean;
  needsShuttle?: boolean;
  note?: string | null;
}

export const maskPhone = (p: string) => (p.length === 10 ? `${p.slice(0, 3)}****${p.slice(7)}` : '***');

@Injectable()
export class WorkerSourcingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerSourcingService.name);
  private timer?: ReturnType<typeof setInterval>;
  private sweeping = false;

  constructor(
    @InjectRepository(WorkerProfile) private readonly repo: Repository<WorkerProfile>,
    @InjectRepository(WorkerPhoneView) private readonly views: Repository<WorkerPhoneView>,
    @InjectRepository(CompanyUser) private readonly companyUsers: Repository<CompanyUser>,
    @InjectRepository(AdminAuditLog) private readonly audit: Repository<AdminAuditLog>,
    private readonly ds: DataSource,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.autoShareSweep(), 60_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ---------- tách & xem trước ----------
  private async phonesTaken(phones: string[]): Promise<Map<string, { id: string; isSourced: boolean; fullName: string }>> {
    if (!phones.length) return new Map();
    const rows = await this.repo.createQueryBuilder('w').select(['w.id', 'w.phone', 'w.isSourced', 'w.fullName']).where('w.phone IN (:...ph)', { ph: phones }).getMany();
    return new Map(rows.map((r) => [r.phone, { id: r.id, isSourced: r.isSourced, fullName: r.fullName }]));
  }

  async previewPost(text: string) {
    const t = String(text ?? '').trim();
    if (t.length < 10) throw new BadRequestException('Hãy dán nội dung bài đăng (ít nhất vài chữ).');
    const parsed = parseWorkerPost(t);
    const taken = parsed.phone ? (await this.phonesTaken([parsed.phone])).get(parsed.phone) ?? null : null;
    return { parsed, existing: taken };
  }

  async previewTable(text: string) {
    const r = parseWorkerTable(String(text ?? ''));
    if (!r.rows.length) throw new BadRequestException('Không đọc được dòng nào — hãy dán bảng có cột Họ tên, Số điện thoại, Tỉnh…');
    const taken = await this.phonesTaken(r.rows.map((x) => x.phone).filter((x): x is string => !!x));
    const seen = new Set<string>();
    const rows = r.rows.map((x) => {
      let status: 'ok' | 'missing' | 'duplicate' | 'repeat' = 'ok';
      const ex = x.phone ? taken.get(x.phone) : undefined;
      if (!x.phone || !x.fullName || !x.province) status = 'missing';
      else if (ex) status = 'duplicate';
      else if (seen.has(x.phone)) status = 'repeat';
      if (x.phone) seen.add(x.phone);
      return { ...x, status, existing: ex ?? null };
    });
    const count = (s: string) => rows.filter((x) => x.status === s).length;
    return { rows, headerDetected: r.headerDetected, columns: r.columns, summary: { total: rows.length, ok: count('ok'), missing: count('missing'), duplicate: count('duplicate'), repeat: count('repeat') } };
  }

  // ---------- tạo hồ sơ ----------
  /** Tạo 1 hồ sơ nguồn tổng hợp. Trả lý do nếu bỏ qua (trùng SĐT / thiếu thông tin). */
  async createOne(input: SourcedInput, opts: { label: string; ownerCompanyId?: string | null }): Promise<{ ok: true; id: string } | { ok: false; reason: string; existingId?: string }> {
    const phone = String(input.phone ?? '').replace(/\D/g, '');
    if (!/^0\d{9}$/.test(phone)) return { ok: false, reason: 'Số điện thoại không hợp lệ' };
    const fullName = String(input.fullName ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (fullName.length < 2) return { ok: false, reason: 'Thiếu họ tên' };
    const kind: LaborKind = (['worker', 'student', 'intern'] as const).includes(input.kind as LaborKind) ? (input.kind as LaborKind) : 'worker';
    const place = resolvePlace({ province: String(input.province ?? ''), mode: 'old', oldDistrict: input.oldDistrict || null });
    if (!place) return { ok: false, reason: 'Thiếu hoặc sai tỉnh/thành' };
    const exists = await this.repo.findOne({ where: { phone }, select: { id: true } });
    if (exists) return { ok: false, reason: 'Đã có hồ sơ với số này (không tạo bản sao)', existingId: exists.id };
    const desired = (input.desiredJobs ?? []).filter((g) => LABOR_GROUPS[kind].includes(g)).slice(0, 3);
    const fallback: Record<LaborKind, string> = { worker: 'Lao động phổ thông khác', student: 'Bán thời gian khác', intern: 'Ngành khác' };
    const ty = new Date().getFullYear();
    const bd = /^\d{4}-\d{2}-\d{2}$/.test(String(input.birthDate ?? '')) ? String(input.birthDate) : null;
    const by = bd ? +bd.slice(0, 4) : Number(input.birthYear) || null;
    const p = this.repo.create({
      kind,
      fullName,
      phone,
      relativePhone: null,
      gender: ['male', 'female'].includes(String(input.gender)) ? String(input.gender) : 'other',
      birthDate: bd as string,
      birthYear: by && by >= ty - 70 && by <= ty - 15 ? by : null,
      province: place.province,
      addressMode: 'old',
      oldDistrict: place.oldDistrict,
      oldWard: null,
      newWardCode: null,
      newWard: null,
      desiredJobs: desired.length ? desired : [fallback[kind]],
      shifts: (input.shifts ?? []).filter((s) => SHIFTS_BY_KIND[kind].includes(s)),
      availability: null,
      extra: cleanProfileExtra(kind, input.experience ? { experience: input.experience } : null),
      needsHousing: !!input.needsHousing,
      needsShuttle: !!input.needsShuttle,
      isSeeking: true,
      isSourced: true,
      sourceLabel: opts.label.slice(0, 120),
      ownerCompanyId: opts.ownerCompanyId ?? null,
      shareStatus: opts.ownerCompanyId ? 'pending' : null,
      adminNote: input.note ? String(input.note).slice(0, 1000) : null,
    });
    await this.repo.save(p);
    return { ok: true, id: p.id };
  }

  // ---------- Admin ----------
  async adminSave(admin: AdminActor, b: { rows?: SourcedInput[]; label?: string }) {
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 500) : [];
    if (!rows.length) throw new BadRequestException('Chưa có hồ sơ nào để lưu.');
    const label = (b.label ?? '').trim() || 'Admin nhập tay';
    let created = 0;
    const skipped: { phone: string | null; name: string | null; reason: string }[] = [];
    for (const r of rows) {
      const res = await this.createOne(r, { label });
      if (res.ok) created++;
      else skipped.push({ phone: r.phone ?? null, name: r.fullName ?? null, reason: (res as { reason: string }).reason });
    }
    await logAdminAction(this.audit, admin, 'worker.sourced_create', 'worker_profile', undefined, `${label}: +${created}, bỏ qua ${skipped.length}`);
    return { created, skipped };
  }

  async adminDelete(admin: AdminActor, id: string) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (!p.isSourced) throw new ForbiddenException('Chỉ gỡ được hồ sơ nguồn tổng hợp. Hồ sơ người lao động tự điền hãy dùng nút Ẩn.');
    await this.ds.transaction(async (m) => {
      await m.query('DELETE FROM worker_notes WHERE profile_id = $1', [id]);
      await m.query('DELETE FROM worker_contacts WHERE profile_id = $1', [id]);
      await m.query('DELETE FROM worker_phone_views WHERE profile_id = $1', [id]);
      await m.query('DELETE FROM worker_applications WHERE profile_id = $1', [id]);
      await m.query('DELETE FROM worker_profiles WHERE id = $1', [id]);
    });
    await logAdminAction(this.audit, admin, 'worker.sourced_delete', 'worker_profile', id, `${p.fullName} ${maskPhone(p.phone)}`);
    return { ok: true };
  }

  // ----- hàng chờ chia sẻ (hồ sơ NTD tự nhập) -----
  async autoShareState() {
    const rows: { worker_auto_share_enabled: boolean; worker_auto_share_enabled_at: Date | null }[] = await this.ds.query(`SELECT worker_auto_share_enabled, worker_auto_share_enabled_at FROM admin_settings WHERE id = 'singleton'`);
    return { enabled: !!rows[0]?.worker_auto_share_enabled, enabledAt: rows[0]?.worker_auto_share_enabled_at ?? null, minutes: AUTO_SHARE_MIN };
  }
  async setAutoShare(admin: AdminActor, enabled: boolean) {
    await this.ds.query(`INSERT INTO admin_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING`);
    if (enabled) await this.ds.query(`UPDATE admin_settings SET worker_auto_share_enabled = true, worker_auto_share_enabled_at = CASE WHEN worker_auto_share_enabled THEN worker_auto_share_enabled_at ELSE now() END WHERE id = 'singleton'`);
    else await this.ds.query(`UPDATE admin_settings SET worker_auto_share_enabled = false WHERE id = 'singleton'`);
    await logAdminAction(this.audit, admin, enabled ? 'worker.auto_share_on' : 'worker.auto_share_off', 'setting');
    return this.autoShareState();
  }

  /** Chia sẻ các hồ sơ chờ quá 15 phút — chỉ hồ sơ tạo SAU lúc bật công tắc. So sánh bằng đồng hồ CSDL (tránh lệch múi giờ Node/DB). */
  async autoShareSweep(): Promise<number> {
    if (this.sweeping) return 0;
    this.sweeping = true;
    try {
      const res: unknown = await this.ds.query(
        `UPDATE worker_profiles w SET share_status = 'shared', shared_at = now()
         FROM admin_settings s
         WHERE s.id = 'singleton' AND s.worker_auto_share_enabled = true AND s.worker_auto_share_enabled_at IS NOT NULL
           AND w.share_status = 'pending' AND w.owner_company_id IS NOT NULL AND w.is_hidden = false
           AND w.created_at >= s.worker_auto_share_enabled_at AND w.created_at <= now() - ($1 || ' minutes')::interval
         RETURNING w.id`,
        [String(AUTO_SHARE_MIN)],
      );
      const n = Array.isArray(res) ? (Array.isArray(res[0]) ? res[0].length : res.length) : 0;
      return n;
    } catch (e) {
      this.logger.error(`Lỗi tự chia sẻ hồ sơ lao động: ${(e as Error).message}`);
      return 0;
    } finally {
      this.sweeping = false;
    }
  }

  async queueList(q: { status?: string; page?: string }) {
    const status = ['pending', 'shared', 'dismissed'].includes(String(q.status)) ? String(q.status) : 'pending';
    const page = Math.max(1, Number(q.page) || 1);
    const size = 20;
    const rows: Record<string, unknown>[] = await this.ds.query(
      `SELECT w.id, w.full_name AS "fullName", w.phone, w.kind, w.province, w.old_district AS "oldDistrict", w.desired_jobs AS "desiredJobs", w.created_at AS "createdAt", w.shared_at AS "sharedAt",
              w.share_status AS "shareStatus", c.name AS company, c.id AS "companyId",
              (SELECT COUNT(*)::int FROM worker_profiles x WHERE x.phone = w.phone) AS dup
       FROM worker_profiles w LEFT JOIN companies c ON c.id = w.owner_company_id
       WHERE w.owner_company_id IS NOT NULL AND w.share_status = $1 AND w.is_hidden = false
       ORDER BY w.created_at DESC LIMIT $2 OFFSET $3`,
      [status, size, (page - 1) * size],
    );
    const tot: { n: number; p: number; s: number; d: number }[] = await this.ds.query(
      `SELECT COUNT(*) FILTER (WHERE share_status = $1)::int AS n, COUNT(*) FILTER (WHERE share_status = 'pending')::int AS p,
              COUNT(*) FILTER (WHERE share_status = 'shared')::int AS s, COUNT(*) FILTER (WHERE share_status = 'dismissed')::int AS d
       FROM worker_profiles WHERE owner_company_id IS NOT NULL AND is_hidden = false`,
      [status],
    );
    return { items: rows, total: tot[0].n, counts: { pending: tot[0].p, shared: tot[0].s, dismissed: tot[0].d }, page, totalPages: Math.max(1, Math.ceil(tot[0].n / size)), auto: await this.autoShareState() };
  }

  async queueAct(admin: AdminActor, ids: string[], action: string) {
    const list = (Array.isArray(ids) ? ids : []).filter((x) => /^[0-9a-f-]{36}$/i.test(String(x))).slice(0, 200);
    if (!list.length) throw new BadRequestException('Chưa chọn hồ sơ nào.');
    const next = action === 'share' ? 'shared' : action === 'dismiss' ? 'dismissed' : action === 'requeue' ? 'pending' : null;
    if (!next) throw new BadRequestException('Thao tác không hợp lệ.');
    const r: unknown = await this.ds.query(
      `UPDATE worker_profiles SET share_status = $1::text, shared_at = CASE WHEN $1::text = 'shared' THEN now() ELSE NULL END WHERE id = ANY($2::uuid[]) AND owner_company_id IS NOT NULL RETURNING id`,
      [next, list],
    );
    const n = Array.isArray(r) ? (Array.isArray(r[0]) ? r[0].length : r.length) : 0;
    await logAdminAction(this.audit, admin, `worker.share_${action}`, 'worker_profile', undefined, `${n} hồ sơ`);
    return { changed: n };
  }

  // ----- nhật ký xem số -----
  async phoneViewLog(q: { companyId?: string; page?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const size = 30;
    const where = q.companyId && /^[0-9a-f-]{36}$/i.test(q.companyId) ? 'WHERE v.company_id = $3' : '';
    const params: unknown[] = [size, (page - 1) * size];
    if (where) params.push(q.companyId);
    const rows = await this.ds.query(
      `SELECT v.id, v.viewed_at AS "viewedAt", c.name AS company, c.id AS "companyId", w.id AS "profileId", w.full_name AS "fullName", w.phone, w.source_label AS "sourceLabel", u.email AS "userEmail"
       FROM worker_phone_views v LEFT JOIN companies c ON c.id = v.company_id LEFT JOIN worker_profiles w ON w.id = v.profile_id LEFT JOIN users u ON u.id = v.user_id
       ${where} ORDER BY v.viewed_at DESC LIMIT $1 OFFSET $2`,
      params,
    );
    const totalRow: { n: number }[] = await this.ds.query(`SELECT COUNT(*)::int AS n FROM worker_phone_views v ${where.replace('$3', '$1')}`, where ? [q.companyId] : []);
    const top = await this.ds.query(
      `SELECT c.name AS company, c.id AS "companyId", COUNT(*)::int AS n FROM worker_phone_views v LEFT JOIN companies c ON c.id = v.company_id
       WHERE v.viewed_at > now() - interval '24 hours' GROUP BY c.id, c.name ORDER BY n DESC LIMIT 5`,
    );
    return { items: rows.map((r: { phone: string }) => ({ ...r, phone: r.phone ? maskPhone(r.phone) : null })), total: totalRow[0]?.n ?? 0, page, totalPages: Math.max(1, Math.ceil((totalRow[0]?.n ?? 0) / size)), last24h: top, limit: PHONE_VIEW_LIMIT };
  }

  // ---------- NTD ----------
  private async companyOf(userId: string) {
    const link = await this.companyUsers.findOne({ where: { userId } });
    if (!link) throw new ForbiddenException('Tài khoản chưa liên kết công ty.');
    return link.companyId;
  }

  async revealPhone(userId: string, profileId: string) {
    const companyId = await this.companyOf(userId);
    const p = await this.repo.findOne({ where: { id: profileId } });
    if (!p || p.isHidden) throw new NotFoundException('Không tìm thấy hồ sơ');
    if (!p.isSourced || p.ownerCompanyId === companyId) return { phone: p.phone, used: null, limit: PHONE_VIEW_LIMIT, logged: false };
    if (p.ownerCompanyId && p.shareStatus !== 'shared') throw new NotFoundException('Không tìm thấy hồ sơ');
    const done: { n: number }[] = await this.ds.query(`SELECT COUNT(*)::int AS n FROM worker_phone_views WHERE company_id = $1 AND profile_id = $2 AND viewed_at > now() - interval '24 hours'`, [companyId, profileId]);
    const used: { n: number }[] = await this.ds.query(`SELECT COUNT(DISTINCT profile_id)::int AS n FROM worker_phone_views WHERE company_id = $1 AND viewed_at > now() - interval '24 hours'`, [companyId]);
    if (done[0].n > 0) return { phone: p.phone, used: used[0].n, limit: PHONE_VIEW_LIMIT, logged: false };
    if (used[0].n >= PHONE_VIEW_LIMIT) throw new ConflictException(`Công ty bạn đã xem ${PHONE_VIEW_LIMIT} số trong 24 giờ qua. Vui lòng thử lại sau hoặc liên hệ Admin.`);
    await this.views.save(this.views.create({ companyId, profileId, userId }));
    return { phone: p.phone, used: used[0].n + 1, limit: PHONE_VIEW_LIMIT, logged: true };
  }

  async phoneQuota(userId: string) {
    const companyId = await this.companyOf(userId);
    const used: { n: number }[] = await this.ds.query(`SELECT COUNT(DISTINCT profile_id)::int AS n FROM worker_phone_views WHERE company_id = $1 AND viewed_at > now() - interval '24 hours'`, [companyId]);
    return { used: used[0].n, limit: PHONE_VIEW_LIMIT };
  }

  async myStock(userId: string, q: { page?: string; q?: string }) {
    const companyId = await this.companyOf(userId);
    const page = Math.max(1, Number(q.page) || 1);
    const size = 20;
    const qb = this.repo.createQueryBuilder('w').where('w.owner_company_id = :c', { c: companyId });
    const t = (q.q ?? '').trim();
    if (t) qb.andWhere('(w.full_name ILIKE :t OR w.phone LIKE :t)', { t: `%${t}%` });
    const [rows, total] = await qb.orderBy('w.created_at', 'DESC').skip((page - 1) * size).take(size).getManyAndCount();
    return {
      items: rows.map((w) => ({
        id: w.id, fullName: w.fullName, phone: w.phone, kind: w.kind, province: w.province, oldDistrict: w.oldDistrict ?? null, desiredJobs: w.desiredJobs ?? [], shifts: w.shifts ?? [],
        birthYear: w.birthYear ?? (w.birthDate ? +String(w.birthDate).slice(0, 4) : null), shareStatus: w.shareStatus ?? 'pending', createdAt: w.createdAt, isSeeking: w.isSeeking,
      })),
      total, page, totalPages: Math.max(1, Math.ceil(total / size)),
    };
  }

  async myPreviewTable(userId: string, text: string) {
    await this.companyOf(userId);
    return this.previewTable(text);
  }
  async myPreviewPost(userId: string, text: string) {
    await this.companyOf(userId);
    return this.previewPost(text);
  }

  async mySave(userId: string, b: { rows?: SourcedInput[] }) {
    const companyId = await this.companyOf(userId);
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 200) : [];
    if (!rows.length) throw new BadRequestException('Chưa có hồ sơ nào để lưu.');
    let created = 0;
    const skipped: { phone: string | null; name: string | null; reason: string }[] = [];
    for (const r of rows) {
      const res = await this.createOne(r, { label: 'NTD tự nhập', ownerCompanyId: companyId });
      if (res.ok) created++;
      else skipped.push({ phone: r.phone ?? null, name: r.fullName ?? null, reason: (res as { reason: string }).reason });
    }
    return { created, skipped };
  }

  async myDelete(userId: string, id: string) {
    const companyId = await this.companyOf(userId);
    const p = await this.repo.findOne({ where: { id, ownerCompanyId: companyId } });
    if (!p) throw new NotFoundException('Không tìm thấy hồ sơ của công ty bạn');
    if (p.shareStatus === 'shared') throw new ForbiddenException('Hồ sơ này đã được Admin chia sẻ cho nhà tuyển dụng khác — hãy liên hệ Admin nếu cần gỡ.');
    await this.ds.query('DELETE FROM worker_contacts WHERE profile_id = $1', [id]);
    await this.ds.query('DELETE FROM worker_notes WHERE profile_id = $1', [id]);
    await this.repo.delete({ id });
    return { ok: true };
  }

  // ---------- công khai: chính chủ gỡ / nhận lại ----------
  async publicClaimOrRemove(b: { phone?: string; birth?: string; type?: string }) {
    const phone = String(b.phone ?? '').replace(/\D/g, '');
    if (!/^0\d{9}$/.test(phone)) throw new BadRequestException('Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0).');
    if (b.type !== 'remove' && b.type !== 'claim') throw new BadRequestException('Chọn "Gỡ hồ sơ" hoặc "Nhận lại hồ sơ".');
    const p = await this.repo.findOne({ where: { phone, isSourced: true } });
    // Không cho dò: mọi lỗi xác minh đều trả cùng một thông điệp
    const nope = new NotFoundException('Không tìm thấy hồ sơ nguồn tổng hợp khớp với số điện thoại và ngày sinh bạn nhập.');
    if (!p || p.claimedAt) throw nope;
    const known = p.birthDate ? String(p.birthDate).slice(0, 10) : null;
    const input = String(b.birth ?? '').trim();
    const inYear = /^\d{4}$/.test(input) ? Number(input) : /^\d{4}-\d{2}-\d{2}$/.test(input) ? Number(input.slice(0, 4)) : null;
    if (known) {
      if (input.slice(0, 10) !== known) throw nope;
    } else if (p.birthYear) {
      if (inYear !== p.birthYear) throw nope;
    } else {
      // Hồ sơ chưa có năm sinh nào để đối chiếu → chuyển Admin xử lý
      return { needsAdmin: true as const, message: 'Hồ sơ này chưa có ngày sinh để đối chiếu tự động. Vui lòng dùng mục "Liên hệ" để Admin xác minh và xử lý giúp bạn.' };
    }
    if (b.type === 'remove') {
      await this.ds.query('DELETE FROM worker_notes WHERE profile_id = $1', [p.id]);
      await this.ds.query('DELETE FROM worker_contacts WHERE profile_id = $1', [p.id]);
      await this.ds.query('DELETE FROM worker_phone_views WHERE profile_id = $1', [p.id]);
      await this.ds.query('DELETE FROM worker_applications WHERE profile_id = $1', [p.id]);
      await this.repo.delete({ id: p.id });
      return { done: 'removed' as const, message: 'Đã gỡ hồ sơ của bạn khỏi hệ thống.' };
    }
    // Nhận lại: cần ngày sinh đầy đủ (dùng làm mật khẩu hồ sơ về sau)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input) && !known) throw new BadRequestException('Để nhận lại hồ sơ, vui lòng nhập đầy đủ ngày sinh (ngày/tháng/năm).');
    if (!known) p.birthDate = input;
    p.isSourced = false;
    p.claimedAt = new Date();
    p.ownerCompanyId = null;
    p.shareStatus = null;
    p.sourceLabel = p.sourceLabel ? `${p.sourceLabel} → chính chủ nhận lại` : 'Chính chủ nhận lại';
    await this.repo.save(p);
    return { done: 'claimed' as const, message: 'Đã nhận lại hồ sơ. Bạn có thể vào trang Điền thông tin lao động, nhập SĐT + ngày sinh để chỉnh sửa và bổ sung.' };
  }

  /** Dùng cho test nhanh: tạo hồ sơ từ dữ liệu đã tách. */
  fromParsed(p: ParsedWorker): SourcedInput {
    return { fullName: p.fullName, phone: p.phone, gender: p.gender, birthYear: p.birthYear, birthDate: p.birthDate, province: p.province, oldDistrict: p.oldDistrict, kind: p.kind, desiredJobs: p.desiredJobs, shifts: p.shifts, experience: p.experience, needsHousing: p.needsHousing, needsShuttle: p.needsShuttle, note: p.note };
  }
  readonly SYSTEM = SYSTEM_ACTOR;
}
