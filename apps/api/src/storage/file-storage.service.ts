import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { AdminSetting } from '../database/entities/admin-setting.entity';
import { StoredFile } from '../database/entities/stored-file.entity';
import { AdminAuditLog } from '../database/entities/admin-audit-log.entity';
import { AdminActor, logAdminAction } from '../admin-tools/admin-audit';
import { resolveCorsOrigins, resolveJwtSecret } from '../config/env-guard';
import {
  DriveError,
  aboutQuota,
  buildAuthUrl,
  copyFile,
  createFolder,
  deleteFile,
  downloadFile,
  emailFromIdToken,
  exchangeCode,
  refreshAccessToken,
  uploadFile,
} from './google-drive.client';

// Đợt 20 (27/09/2026) — lưu MỌI file tải lên (CV ứng viên, bản sao Kho CV, giấy tờ pháp lý công ty, ảnh đại
// diện) lên Google Drive của chủ web thay vì trong CSDL (Supabase miễn phí chỉ 500MB) — theo lựa chọn người
// dùng qua AskUserQuestion. Nguyên tắc:
//  - Chưa kết nối Drive / Drive lỗi khi tải lên → vẫn lưu vào CSDL như trước: KHÔNG BAO GIỜ mất file.
//  - Tải xuống luôn đi qua máy chủ (giữ nguyên kiểm tra quyền), file trên Drive không có link công khai.
//  - File cũ trong CSDL được chuyển dần lên Drive (vòng chạy nền), chuyển xong thì xoá bản trong CSDL.
//  - File "mồ côi" (bản ghi gốc đã xoá: ứng viên xoá CV/tài khoản, đổi ảnh...) được tự dọn khỏi Drive.

export type StorageCategory = 'cv' | 'archive' | 'legal' | 'avatar' | 'ad';

interface CategoryDef {
  table: string;
  dataCol: string;
  keyCol: string;
  nameCol: string | null;
  mimeCol: string;
  folder: string;
  label: string;
}

export const CATEGORIES: Record<StorageCategory, CategoryDef> = {
  cv: {
    table: 'cvs',
    dataCol: 'file_data',
    keyCol: 'file_storage_key',
    nameCol: 'original_file_name',
    mimeCol: 'file_mime_type',
    folder: 'CV ứng viên',
    label: 'CV ứng viên tải lên',
  },
  archive: {
    table: 'cv_archive_entries',
    dataCol: 'cv_file_data',
    keyCol: 'cv_file_storage_key',
    nameCol: 'cv_file_name',
    mimeCol: 'cv_mime_type',
    folder: 'Kho CV nhà tuyển dụng',
    label: 'Bản sao CV trong Kho CV',
  },
  legal: {
    table: 'companies',
    dataCol: 'legal_doc_data',
    keyCol: 'legal_doc_storage_key',
    nameCol: 'legal_doc_original_file_name',
    mimeCol: 'legal_doc_mime_type',
    folder: 'Giấy tờ pháp lý công ty',
    label: 'Giấy tờ pháp lý công ty',
  },
  avatar: {
    table: 'candidate_profiles',
    dataCol: 'avatar_data',
    keyCol: 'avatar_storage_key',
    nameCol: null,
    mimeCol: 'avatar_mime_type',
    folder: 'Ảnh đại diện ứng viên',
    label: 'Ảnh đại diện ứng viên',
  },
  // Đợt 24 — ảnh nền banner quảng cáo do Admin tải lên.
  ad: {
    table: 'ad_campaigns',
    dataCol: 'bg_image_data',
    keyCol: 'bg_image_key',
    nameCol: 'name',
    mimeCol: 'bg_image_mime',
    folder: 'Ảnh nền banner quảng cáo',
    label: 'Ảnh nền banner quảng cáo',
  },
};
const ROOT_FOLDER = 'TuyenDungViecLam - File cua web (khong xoa)';

const MIGRATE_EVERY_MS = 2 * 60_000;
const GC_EVERY_MS = 30 * 60_000;
const CACHE_MAX_BYTES = 40 * 1024 * 1024;
const CACHE_MAX_ITEM = 3 * 1024 * 1024;

@Injectable()
export class FileStorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('FileStorage');
  private readonly clientId = process.env.GOOGLE_CLIENT_ID?.trim() || '';
  private readonly clientSecret =
    process.env.GOOGLE_CLIENT_SECRET?.trim() || '';
  private readonly key = createHash('sha256')
    .update(`${resolveJwtSecret(process.env.JWT_SECRET)}:gdrive-refresh-token`)
    .digest();
  private settings?: { at: number; value: AdminSetting };
  private access?: { token: string; exp: number };
  private cache = new Map<string, Buffer>();
  private cacheBytes = 0;
  private timers: NodeJS.Timeout[] = [];
  private migrating = false;
  private folderPromise?: Promise<Record<string, string>>;

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(AdminSetting)
    private readonly settingsRepo: Repository<AdminSetting>,
    @InjectRepository(StoredFile)
    private readonly storedRepo: Repository<StoredFile>,
    @InjectRepository(AdminAuditLog)
    private readonly auditRepo: Repository<AdminAuditLog>,
    private readonly jwt: JwtService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timers.push(setTimeout(() => void this.migrateStep(), 30_000));
    this.timers.push(
      setInterval(() => void this.migrateStep(), MIGRATE_EVERY_MS),
    );
    this.timers.push(
      setInterval(() => void this.collectOrphans(), GC_EVERY_MS),
    );
  }

  onModuleDestroy() {
    this.timers.forEach((t) => clearTimeout(t));
  }

  // ------------------------------------------------------------------ cấu hình & token
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  private async getSettings(force = false): Promise<AdminSetting> {
    if (!force && this.settings && Date.now() - this.settings.at < 30_000)
      return this.settings.value;
    let s = await this.settingsRepo.findOne({ where: { id: 'singleton' } });
    if (!s)
      s = await this.settingsRepo.save(
        this.settingsRepo.create({
          id: 'singleton',
          autoApproveEnabled: false,
        }),
      );
    this.settings = { at: Date.now(), value: s };
    return s;
  }

  private invalidateSettings() {
    this.settings = undefined;
  }

  private encrypt(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
  }

  private decrypt(v: string): string {
    const [, iv, tag, data] = v.split(':');
    const d = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(iv, 'base64'),
    );
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      d.update(Buffer.from(data, 'base64')),
      d.final(),
    ]).toString('utf8');
  }

  async isConnected(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const s = await this.getSettings();
    return !!s.gdriveRefreshTokenEnc;
  }

  private async token(): Promise<string> {
    if (this.access && Date.now() < this.access.exp) return this.access.token;
    const s = await this.getSettings();
    if (!this.isConfigured() || !s.gdriveRefreshTokenEnc)
      throw new DriveError('Chưa kết nối Google Drive', 0);
    let refresh: string;
    try {
      refresh = this.decrypt(s.gdriveRefreshTokenEnc);
    } catch {
      throw new DriveError(
        'Không giải mã được mã kết nối Google Drive (JWT_SECRET đã đổi?) — hãy kết nối lại',
        0,
        'decrypt',
      );
    }
    try {
      const r = await refreshAccessToken(
        this.clientId,
        this.clientSecret,
        refresh,
      );
      this.access = {
        token: r.access_token,
        exp: Date.now() + (r.expires_in - 120) * 1000,
      };
      if (s.gdriveLastError) await this.setError(null);
      return r.access_token;
    } catch (err) {
      if (
        err instanceof DriveError &&
        (err.code === 'invalid_grant' ||
          err.status === 400 ||
          err.status === 401)
      ) {
        await this.setError(
          'Google đã thu hồi quyền truy cập Drive (thường do ứng dụng Google còn để chế độ "Testing" nên quyền hết hạn sau 7 ngày, hoặc bạn đã gỡ quyền). Hãy chuyển ứng dụng sang "In production" rồi bấm "Kết nối lại".',
        );
      }
      throw err;
    }
  }

  private async setError(msg: string | null) {
    await this.settingsRepo.update(
      { id: 'singleton' },
      { gdriveLastError: msg },
    );
    this.invalidateSettings();
  }

  private async folders(): Promise<Record<string, string>> {
    const s = await this.getSettings();
    const f = s.gdriveFolders ?? {};
    if (
      f.root &&
      (Object.keys(CATEGORIES) as StorageCategory[]).every((c) => f[c])
    )
      return f;
    // Chỉ tạo thư mục 1 lần kể cả khi nhiều yêu cầu đến cùng lúc.
    this.folderPromise ??= (async () => {
      const t = await this.token();
      const out: Record<string, string> = { ...f };
      out.root ??= await createFolder(t, ROOT_FOLDER);
      for (const [cat, def] of Object.entries(CATEGORIES))
        out[cat] ??= await createFolder(t, def.folder, out.root);
      await this.settingsRepo.update(
        { id: 'singleton' },
        { gdriveFolders: out },
      );
      this.invalidateSettings();
      return out;
    })().finally(() => {
      this.folderPromise = undefined;
    });
    return this.folderPromise;
  }

  // ------------------------------------------------------------------ đọc / ghi file
  // Đẩy file lên Drive. Trả "gd:<id>" nếu thành công; null nếu chưa kết nối hoặc lỗi → nơi gọi lưu CSDL như cũ.
  async put(
    data: Buffer | null | undefined,
    opts: {
      name?: string | null;
      mime?: string | null;
      category: StorageCategory;
    },
  ): Promise<string | null> {
    if (!data || !data.length || !(await this.isConnected())) return null;
    try {
      const folders = await this.folders();
      const name = this.fileName(opts.name, opts.category);
      const up = await uploadFile(await this.token(), {
        name,
        mimeType: opts.mime || 'application/octet-stream',
        parentId: folders[opts.category],
        data,
      });
      const key = `gd:${up.id}`;
      await this.storedRepo.save(
        this.storedRepo.create({
          key,
          category: opts.category,
          fileName: name,
          size: up.size || data.length,
        }),
      );
      this.remember(key, data);
      return key;
    } catch (err) {
      this.logger.warn(
        `Không đẩy được file lên Google Drive (lưu tạm vào CSDL): ${(err as Error).message}`,
      );
      return null;
    }
  }

  // Tạo bản sao riêng trên Drive (VD Kho CV giữ bản riêng dù ứng viên xoá CV gốc).
  async copy(
    key: string,
    opts: { name?: string | null; category: StorageCategory },
  ): Promise<string | null> {
    if (!key.startsWith('gd:') || !(await this.isConnected())) return null;
    try {
      const folders = await this.folders();
      const name = this.fileName(opts.name, opts.category);
      const cp = await copyFile(
        await this.token(),
        key.slice(3),
        name,
        folders[opts.category],
      );
      const newKey = `gd:${cp.id}`;
      await this.storedRepo.save(
        this.storedRepo.create({
          key: newKey,
          category: opts.category,
          fileName: name,
          size: cp.size,
        }),
      );
      return newKey;
    } catch (err) {
      this.logger.warn(
        `Không sao chép được file trên Google Drive: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async read(key: string): Promise<Buffer> {
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      this.cache.set(key, hit); // LRU
      return hit;
    }
    if (!key.startsWith('gd:'))
      throw new ServiceUnavailableException('Không rõ nơi lưu file');
    try {
      const buf = await downloadFile(await this.token(), key.slice(3));
      this.remember(key, buf);
      return buf;
    } catch (err) {
      this.logger.warn(
        `Không tải được file từ Google Drive: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Không tải được file từ Google Drive lúc này, vui lòng thử lại sau ít phút',
      );
    }
  }

  // Lấy nội dung file dù đang nằm trong CSDL hay trên Drive.
  async resolve(
    data: Buffer | null | undefined,
    key: string | null | undefined,
  ): Promise<Buffer | null> {
    if (data && data.length) return data;
    if (key) return this.read(key);
    return null;
  }

  private remember(key: string, buf: Buffer) {
    if (buf.length > CACHE_MAX_ITEM) return;
    this.cache.set(key, buf);
    this.cacheBytes += buf.length;
    while (this.cacheBytes > CACHE_MAX_BYTES) {
      const first = this.cache.keys().next().value as string | undefined;
      if (!first) break;
      this.cacheBytes -= this.cache.get(first)?.length ?? 0;
      this.cache.delete(first);
    }
  }

  private fileName(
    name: string | null | undefined,
    category: StorageCategory,
  ): string {
    const base = (name || `${category}-file`)
      .replace(/[\\/:*?"<>|]+/g, '_')
      .slice(0, 150);
    const stamp = new Date(Date.now() + 7 * 3600_000)
      .toISOString()
      .slice(0, 10);
    return `${stamp} ${base}`;
  }

  // ------------------------------------------------------------------ kết nối (OAuth)
  redirectUriFor(proto: string, host: string): string {
    return (
      process.env.GOOGLE_REDIRECT_URI?.trim() ||
      `${proto}://${host}/storage/google/callback`
    );
  }

  connectUrl(admin: AdminActor, redirectUri: string, returnTo: string): string {
    if (!this.isConfigured())
      throw new BadRequestException(
        'Máy chủ chưa có GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — làm theo hướng dẫn ở trang này trước.',
      );
    const origins = resolveCorsOrigins(process.env.CORS_ORIGIN);
    let ret: string;
    try {
      ret = new URL(returnTo).origin;
    } catch {
      throw new BadRequestException('Địa chỉ quay về không hợp lệ');
    }
    if (origins !== true && !origins.includes(ret))
      throw new BadRequestException(
        'Địa chỉ quay về không nằm trong danh sách được phép',
      );
    const state = this.jwt.sign(
      { p: 'gdrive', a: admin.userId, e: admin.email, r: redirectUri, t: ret },
      { expiresIn: '15m' },
    );
    return buildAuthUrl(this.clientId, redirectUri, state);
  }

  // Google chuyển trình duyệt về đây sau khi chủ web bấm "Cho phép". Trả địa chỉ trang Admin để quay về.
  async handleCallback(
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
  ): Promise<string> {
    let st: { p: string; a: string; e: string; r: string; t: string };
    try {
      st = this.jwt.verify(state ?? '');
      if (st.p !== 'gdrive') throw new Error('state');
    } catch {
      throw new BadRequestException(
        'Phiên kết nối Google Drive không hợp lệ hoặc đã hết hạn (15 phút) — hãy bấm "Kết nối" lại từ trang Admin.',
      );
    }
    const back = (status: string, msg?: string) =>
      `${st.t}/admin/dashboard?tab=storage&drive=${status}${msg ? `&msg=${encodeURIComponent(msg.slice(0, 300))}` : ''}`;
    if (error || !code)
      return back(
        'error',
        error === 'access_denied'
          ? 'Bạn đã bấm từ chối cấp quyền.'
          : error || 'Thiếu mã xác nhận từ Google',
      );
    try {
      const tok = await exchangeCode(
        this.clientId,
        this.clientSecret,
        st.r,
        code,
      );
      if (!tok.refresh_token)
        return back(
          'error',
          'Google không trả mã làm mới. Vào myaccount.google.com/permissions gỡ quyền của ứng dụng này rồi bấm Kết nối lại.',
        );
      if (tok.scope && !tok.scope.includes('drive.file'))
        return back(
          'error',
          'Bạn chưa tích ô cho phép web tạo và xem file trên Drive — hãy kết nối lại và tích đủ các ô.',
        );
      const email = emailFromIdToken(tok.id_token);
      const s = await this.getSettings(true);
      const sameAccount = !!email && s.gdriveAccountEmail === email;
      await this.settingsRepo.update(
        { id: 'singleton' },
        {
          gdriveRefreshTokenEnc: this.encrypt(tok.refresh_token),
          gdriveAccountEmail: email,
          gdriveConnectedAt: new Date(),
          gdriveLastError: null,
          // Đổi sang tài khoản Google khác → tạo bộ thư mục mới trong Drive của tài khoản đó.
          gdriveFolders: sameAccount ? s.gdriveFolders : null,
        },
      );
      this.invalidateSettings();
      this.access = {
        token: tok.access_token,
        exp: Date.now() + (tok.expires_in - 120) * 1000,
      };
      await this.folders();
      await logAdminAction(
        this.auditRepo,
        { userId: st.a, email: st.e },
        'storage.gdrive_connect',
        'storage',
        undefined,
        `Kết nối Google Drive ${email ?? ''}`,
      );
      void this.migrateStep();
      return back('ok');
    } catch (err) {
      this.logger.warn(`Kết nối Google Drive lỗi: ${(err as Error).message}`);
      return back(
        'error',
        `Kết nối Google Drive lỗi: ${(err as Error).message}`,
      );
    }
  }

  async disconnect(admin: AdminActor) {
    await this.settingsRepo.update(
      { id: 'singleton' },
      { gdriveRefreshTokenEnc: null, gdriveLastError: null },
    );
    this.invalidateSettings();
    this.access = undefined;
    await logAdminAction(
      this.auditRepo,
      admin,
      'storage.gdrive_disconnect',
      'storage',
      undefined,
      'Ngắt kết nối Google Drive',
    );
    return this.status();
  }

  async setMigrationPaused(admin: AdminActor, paused: boolean) {
    await this.settingsRepo.update(
      { id: 'singleton' },
      { storageMigrationPaused: paused },
    );
    this.invalidateSettings();
    await logAdminAction(
      this.auditRepo,
      admin,
      paused ? 'storage.migration_pause' : 'storage.migration_resume',
      'storage',
    );
    if (!paused) void this.migrateStep();
    return this.status();
  }

  // ------------------------------------------------------------------ trạng thái
  async status(redirectUri?: string) {
    const s = await this.getSettings(true);
    const categories = [];
    for (const [cat, def] of Object.entries(CATEGORIES) as [
      StorageCategory,
      CategoryDef,
    ][]) {
      const [row] = await this.ds.query(
        `SELECT count(*) FILTER (WHERE ${def.dataCol} IS NOT NULL) AS db_count,
                coalesce(sum(octet_length(${def.dataCol})), 0) AS db_bytes,
                count(*) FILTER (WHERE ${def.keyCol} IS NOT NULL) AS drive_count
         FROM ${def.table}`,
      );
      const [drv] = await this.ds.query(
        `SELECT coalesce(sum(size), 0) AS bytes FROM stored_files WHERE category = $1`,
        [cat],
      );
      categories.push({
        category: cat,
        label: def.label,
        dbCount: Number(row.db_count),
        dbBytes: Number(row.db_bytes),
        driveCount: Number(row.drive_count),
        driveBytes: Number(drv.bytes),
      });
    }
    const [{ size }] = await this.ds.query(
      `SELECT pg_database_size(current_database()) AS size`,
    );
    let quota: Awaited<ReturnType<typeof aboutQuota>> | null = null;
    const connected = this.isConfigured() && !!s.gdriveRefreshTokenEnc;
    if (connected) {
      try {
        quota = await aboutQuota(await this.token());
      } catch {
        quota = null;
      }
    }
    const fresh = await this.getSettings(true);
    return {
      configured: this.isConfigured(),
      connected,
      accountEmail: fresh.gdriveAccountEmail ?? null,
      connectedAt: fresh.gdriveConnectedAt ?? null,
      lastError: fresh.gdriveLastError ?? null,
      migrationPaused: fresh.storageMigrationPaused,
      redirectUri: redirectUri ?? null,
      databaseBytes: Number(size),
      quota,
      categories,
    };
  }

  // ------------------------------------------------------------------ chuyển file cũ + dọn file mồ côi
  async migrateStep(budgetMs = 60_000): Promise<number> {
    if (this.migrating) return 0;
    this.migrating = true;
    let moved = 0;
    const until = Date.now() + budgetMs;
    try {
      const s = await this.getSettings(true);
      if (
        !(await this.isConnected()) ||
        s.storageMigrationPaused ||
        s.gdriveLastError
      )
        return 0;
      for (const [cat, def] of Object.entries(CATEGORIES) as [
        StorageCategory,
        CategoryDef,
      ][]) {
        while (Date.now() < until) {
          const rows: {
            id: string;
            data: Buffer;
            name: string | null;
            mime: string | null;
          }[] = await this.ds.query(
            `SELECT id, ${def.dataCol} AS data, ${def.nameCol ?? 'NULL'} AS name, ${def.mimeCol} AS mime
             FROM ${def.table} WHERE ${def.dataCol} IS NOT NULL AND ${def.keyCol} IS NULL LIMIT 5`,
          );
          if (!rows.length) break;
          for (const r of rows) {
            const key = await this.put(r.data, {
              name: r.name,
              mime: r.mime,
              category: cat,
            });
            if (!key) return moved; // Drive lỗi → dừng, thử lại vòng sau
            const res = await this.ds.query(
              `UPDATE ${def.table} SET ${def.keyCol} = $1, ${def.dataCol} = NULL WHERE id = $2 AND ${def.keyCol} IS NULL`,
              [key, r.id],
            );
            // Bản ghi đã bị xoá/đổi trong lúc tải lên → file vừa tải thành mồ côi, sẽ được dọn.
            if (Array.isArray(res) && res[1] === 0) continue;
            moved++;
          }
        }
      }
      if (moved)
        this.logger.log(
          `Đã chuyển ${moved} file cũ từ CSDL sang Google Drive.`,
        );
    } catch (err) {
      this.logger.warn(
        `Chuyển file sang Google Drive lỗi: ${(err as Error).message}`,
      );
    } finally {
      this.migrating = false;
    }
    return moved;
  }

  async collectOrphans(graceMinutes = 60): Promise<number> {
    let removed = 0;
    try {
      if (!(await this.isConnected())) return 0;
      for (const [cat, def] of Object.entries(CATEGORIES) as [
        StorageCategory,
        CategoryDef,
      ][]) {
        const rows: { key: string }[] = await this.ds.query(
          `SELECT sf.key FROM stored_files sf
           WHERE sf.category = $1 AND sf.created_at < now() - ($2 || ' minutes')::interval
             AND NOT EXISTS (SELECT 1 FROM ${def.table} t WHERE t.${def.keyCol} = sf.key)
           LIMIT 100`,
          [cat, String(graceMinutes)],
        );
        for (const r of rows) {
          await deleteFile(await this.token(), r.key.slice(3));
          await this.storedRepo.delete({ key: r.key });
          this.cache.delete(r.key);
          removed++;
        }
      }
      if (removed)
        this.logger.log(
          `Đã dọn ${removed} file không còn dùng khỏi Google Drive.`,
        );
    } catch (err) {
      this.logger.warn(`Dọn file Google Drive lỗi: ${(err as Error).message}`);
    }
    return removed;
  }
}
