import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Company } from '../database/entities/company.entity';
import { CompanyUser } from '../database/entities/company-user.entity';
import { JobPosting } from '../database/entities/job-posting.entity';
import { JobImport, JobImportStatus } from '../database/entities/job-import.entity';
import { AdminService, AdminActor } from './admin.service';
import { NotificationsService } from '../notifications/notifications.service';
import { extractJobFromUrl } from '../common/job-url-extractor.util';
import { findProvince } from '../common/cv-parser.util';
import { normalizeSearchText } from '../common/search-text.util';
import { unaccentSql } from '../common/sql-unaccent.util';
import { assertPublicHttpUrl } from '../common/public-url.util';

// Đợt 119 — "Hộp nhập tin từ link". Luồng: dán link → đọc dữ liệu chuẩn (JSON-LD) → so khớp công ty → xếp hàng chờ.
// Admin XEM LẠI rồi mới bấm Đăng (không tự đăng). Công ty đã có chủ thật thì KHÔNG đăng vào tài khoản họ — báo để họ tự nhận.
const MAX_LINKS = 20;

export function normalizeSourceUrl(raw: string): string {
  const u = new URL(raw.trim());
  u.hash = '';
  for (const k of Array.from(u.searchParams.keys())) {
    if (/^(utm_|fbclid|gclid|ref$|source$|trk)/i.test(k)) u.searchParams.delete(k);
  }
  let s = u.toString();
  if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
  return s;
}

// Tên công ty rút gọn để so khớp: không dấu, bỏ "công ty / TNHH / cổ phần…".
export function coreCompanyName(name: string): string {
  return normalizeSearchText(name)
    .replace(/\b(cong ty|tnhh|co phan|cp|mtv|tm|dv|sx|xnk|dau tu|thuong mai|dich vu|san xuat|chi nhanh|tap doan|joint stock company|jsc|co ltd|ltd|company|corp|inc)\b/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hostOf(url?: string | null): string {
  try {
    return new URL(/^https?:\/\//i.test(url ?? '') ? (url as string) : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

@Injectable()
export class JobImportService {
  constructor(
    @InjectRepository(JobImport) private readonly repo: Repository<JobImport>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyUser) private readonly companyUserRepo: Repository<CompanyUser>,
    @InjectRepository(JobPosting) private readonly jobRepo: Repository<JobPosting>,
    private readonly admin: AdminService,
    private readonly notifications: NotificationsService,
  ) {}

  // Tìm công ty trong hệ thống: trùng tên rút gọn, hoặc trùng tên miền website.
  async matchCompany(name?: string, website?: string): Promise<{ company: Company; kind: 'name' | 'website' } | null> {
    const core = coreCompanyName(name ?? '');
    const host = hostOf(website);
    if (core.length >= 3) {
      const rows = await this.companyRepo
        .createQueryBuilder('c')
        .where(`${unaccentSql('c.name')} LIKE :like`, { like: `%${core.split(' ')[0]}%` })
        .take(60)
        .getMany();
      const hit = rows.find((c) => coreCompanyName(c.name) === core);
      if (hit) return { company: hit, kind: 'name' };
    }
    if (host && host.includes('.')) {
      const rows = await this.companyRepo
        .createQueryBuilder('c')
        .where('c.website ILIKE :h', { h: `%${host}%` })
        .take(20)
        .getMany();
      const hit = rows.find((c) => hostOf(c.website) === host);
      if (hit) return { company: hit, kind: 'website' };
    }
    return null;
  }

  private hasOwner(c: Company): boolean {
    return !c.isAdminSourced || !!c.claimedAt;
  }

  // Một link: đọc → so khớp công ty → lưu hàng chờ. quiet=true (quét email): link không đọc được thì KHÔNG lưu (đa số là link quảng cáo/hủy đăng ký).
  async addOne(raw: string, opts: { quiet?: boolean; note?: string } = {}): Promise<{ url: string; result: 'new' | 'duplicate' | 'failed'; id?: string; message?: string }> {
    let url: string;
    try {
      await assertPublicHttpUrl(raw);
      url = normalizeSourceUrl(raw);
    } catch {
      return { url: raw, result: 'failed', message: 'Link không hợp lệ' };
    }
    const isDup = async (u: string) => {
      const imp = await this.repo
        .createQueryBuilder('i')
        .where("(i.sourceUrl = :u OR i.data->>'rawUrl' = :u)", { u })
        .getOne();
      if (imp) return { imp };
      const job = await this.jobRepo.findOne({ where: { sourceUrl: u }, select: { id: true } });
      return job ? { job } : null;
    };
    let dup = await isDup(url);
    // Link từng lỗi (không đọc được) thì cho thử lại khi Admin dán tay — xoá bản cũ rồi đọc lại.
    if (dup?.imp?.status === 'failed' && !opts.quiet) {
      await this.repo.delete(dup.imp.id);
      dup = null;
    }
    if (dup) return { url, result: 'duplicate', id: dup.imp?.id, message: dup.imp ? 'Link này đã nhập trước đó' : 'Đã có tin đăng từ link này' };
    const ex = await extractJobFromUrl(url);
    let finalUrl = url;
    if (ex.finalUrl) {
      try {
        finalUrl = normalizeSourceUrl(ex.finalUrl);
      } catch {
        /* giữ link gốc */
      }
    }
    if (finalUrl !== url) {
      const d2 = await isDup(finalUrl);
      if (d2) return { url: finalUrl, result: 'duplicate', id: d2.imp?.id, message: 'Tin này đã có (link nguồn trùng)' };
    }
    if (!ex.found && opts.quiet) return { url: finalUrl, result: 'failed', message: ex.warning };
    const data = { ...(ex.data as Record<string, unknown>), ...(finalUrl !== url ? { rawUrl: url } : {}) };
    const match = ex.found ? await this.matchCompany(ex.data.companyName, ex.data.companyWebsite) : null;
    const row = await this.repo.save(
      this.repo.create({
        sourceUrl: finalUrl,
        status: (!ex.found ? 'failed' : match && this.hasOwner(match.company) ? 'owner_review' : 'pending') as JobImportStatus,
        data,
        matchedCompanyId: match?.company.id ?? null,
        matchKind: match?.kind ?? null,
        companyHasOwner: match ? this.hasOwner(match.company) : false,
        note: ex.found ? opts.note ?? null : ex.warning ?? 'Không đọc được dữ liệu từ trang này',
      }),
    );
    return { url: finalUrl, result: ex.found ? 'new' : 'failed', id: row.id, message: ex.found ? undefined : row.note ?? undefined };
  }

  // Dán nhiều link một lần.
  async addLinks(urls: string[]) {
    const list = Array.from(new Set((urls ?? []).map((u) => String(u || '').trim()).filter(Boolean))).slice(0, MAX_LINKS);
    if (!list.length) throw new BadRequestException('Vui lòng dán ít nhất 1 link');
    const results = [];
    for (const raw of list) results.push(await this.addOne(raw));
    return { results };
  }

  async list(status?: string, q?: string) {
    const qb = this.repo.createQueryBuilder('i').orderBy('i.createdAt', 'DESC').take(200);
    if (status) qb.andWhere('i.status = :s', { s: status });
    if (q?.trim()) qb.andWhere("(i.data->>'title' ILIKE :q OR i.data->>'companyName' ILIKE :q OR i.sourceUrl ILIKE :q)", { q: `%${q.trim()}%` });
    const items = await qb.getMany();
    const ids = Array.from(new Set(items.map((i) => i.matchedCompanyId).filter(Boolean))) as string[];
    const companies = ids.length ? await this.companyRepo.findBy({ id: In(ids) }) : [];
    const cmap = new Map(companies.map((c) => [c.id, c]));
    const counts = await this.repo
      .createQueryBuilder('i')
      .select('i.status', 'status')
      .addSelect('COUNT(*)', 'n')
      .groupBy('i.status')
      .getRawMany<{ status: string; n: string }>();
    return {
      items: items.map((i) => ({
        ...i,
        matchedCompany: i.matchedCompanyId ? { id: cmap.get(i.matchedCompanyId)?.id, name: cmap.get(i.matchedCompanyId)?.name, isAdminSourced: cmap.get(i.matchedCompanyId)?.isAdminSourced } : null,
      })),
      counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])),
    };
  }

  private async getOne(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy mục nhập tin');
    return row;
  }

  // Đăng tin (Admin đã xem/sửa): công ty đã có (nguồn ngoài, chưa có chủ) → thêm vào; chưa có → tạo mới + tài khoản nháp.
  async publish(admin: AdminActor, id: string, edit: Record<string, unknown> = {}) {
    const row = await this.getOne(id);
    if (row.status === 'owner_review') throw new BadRequestException('Công ty này đã có chủ thật — hãy bấm "Báo công ty nhận tin" thay vì đăng hộ.');
    if (!['pending', 'failed'].includes(row.status)) throw new BadRequestException('Mục này không ở trạng thái chờ đăng');
    const d = { ...(row.data ?? {}), ...edit } as Record<string, any>;
    const title = String(d.title ?? '').trim();
    const companyName = String(d.companyName ?? '').trim();
    if (!title) throw new BadRequestException('Thiếu chức danh tin tuyển dụng');
    let company: Company | null = null;
    if (row.matchedCompanyId) company = await this.companyRepo.findOne({ where: { id: row.matchedCompanyId } });
    // Admin có thể đã sửa tên/website công ty hoặc có công ty mới tạo từ link khác — so khớp lại để không tạo công ty trùng.
    if (!company) company = (await this.matchCompany(companyName, d.companyWebsite))?.company ?? null;
    if (company && this.hasOwner(company)) throw new BadRequestException('Công ty này đã có chủ thật — hãy bấm "Báo công ty nhận tin" thay vì đăng hộ.');
    if (!company) {
      if (!companyName) throw new BadRequestException('Thiếu tên công ty');
      const host = hostOf(row.sourceUrl);
      const created = await this.admin.createDraftCompany(admin, {
        name: companyName,
        website: d.companyWebsite || undefined,
        logoUrl: d.companyLogo || undefined,
        industry: d.industry || undefined,
        sourceLabel: host ? `Tổng hợp từ ${host}` : undefined,
      });
      company = created.company;
    }
    const prov = findProvince(d.location);
    const job = await this.admin.createJobForCompany(admin, company.id, {
      title,
      industry: d.industry || undefined,
      provinces: prov ? [prov] : undefined,
      address: d.location || undefined,
      employmentType: d.employmentType || undefined,
      salaryMin: d.salaryMin ?? undefined,
      salaryMax: d.salaryMax ?? undefined,
      description: d.description || undefined,
      deadline: d.deadline || undefined,
      sourceUrl: row.sourceUrl,
    } as never);
    row.status = 'published';
    row.jobId = job.id;
    row.matchedCompanyId = company.id;
    await this.repo.save(row);
    return { import: row, job, company };
  }

  // Công ty đã có chủ thật: Admin bấm báo → thông báo tới tài khoản công ty để họ tự nhận hoặc bỏ qua.
  async notifyOwner(admin: AdminActor, id: string) {
    const row = await this.getOne(id);
    if (row.status !== 'owner_review' || !row.matchedCompanyId) throw new BadRequestException('Mục này không cần báo công ty');
    const users = await this.companyUserRepo.find({ where: { companyId: row.matchedCompanyId } });
    const title = String((row.data as Record<string, unknown>).title ?? 'tin tuyển dụng');
    await this.notifications.createMany(
      users.map((u) => u.userId),
      'job_suggestion',
      `Chúng tôi tìm thấy tin "${title}" của công ty bạn trên Internet. Bạn có thể nhận để đăng nhanh lên web (đã điền sẵn nội dung), hoặc bỏ qua.`,
      '/nha-tuyen-dung/tin-dang',
    );
    row.status = 'owner_notified';
    await this.repo.save(row);
    return row;
  }

  async skip(id: string) {
    const row = await this.getOne(id);
    row.status = 'skipped';
    return this.repo.save(row);
  }

  // ===== Phía nhà tuyển dụng =====
  async suggestionsForCompany(companyId: string) {
    return this.repo.find({ where: { matchedCompanyId: companyId, status: 'owner_notified' }, order: { createdAt: 'DESC' }, take: 20 });
  }
  async getForCompany(companyId: string, id: string) {
    const row = await this.getOne(id);
    if (row.matchedCompanyId !== companyId || row.status !== 'owner_notified') throw new NotFoundException('Không tìm thấy đề xuất');
    return row;
  }
  async markAccepted(row: JobImport, jobId: string) {
    row.status = 'accepted';
    row.jobId = jobId;
    return this.repo.save(row);
  }
  async dismissForCompany(companyId: string, id: string) {
    const row = await this.getForCompany(companyId, id);
    row.status = 'skipped';
    return this.repo.save(row);
  }
}
