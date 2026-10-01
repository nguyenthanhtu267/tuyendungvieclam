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
import { inferIndustry } from '../common/job-industry.util';
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

// Website của trang việc làm (không phải website riêng của công ty) — không dùng để so khớp công ty / lưu làm website công ty.
const BOARD_HOSTS = /(careerviet|vietnamworks|topcv|itviec|glints|jobsgo|timviec365|vieclam24h|123job|mywork|joboko|careerlink|vieclamtot|indeed|linkedin|jobstreet|navigos|ybox|topdev|viectotnhat|timviecnhanh|lamthem|facebook|zalo|google|youtube)\./i;
function isBoardHost(h: string): boolean {
  return !!h && BOARD_HOSTS.test(h + '.');
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
    if (host && host.includes('.') && !isBoardHost(host)) {
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
    // Trùng nội dung: cùng chức danh + cùng công ty (+ cùng địa điểm) dù khác link — tránh 1 tin hiện 2 lần.
    if (ex.found) {
      const key = this.contentKey(ex.data as Record<string, unknown>);
      if (key) {
        const sameImp = await this.repo
          .createQueryBuilder('i')
          .where("i.status <> 'failed'")
          .andWhere(`${unaccentSql("(i.data->>'title')")} = :t AND ${unaccentSql("(i.data->>'companyName')")} = :c`, { t: key.t, c: key.c })
          .getMany();
        if (sameImp.some((x) => this.contentKey(x.data)?.l === key.l)) return { url: finalUrl, result: 'duplicate', id: sameImp[0].id, message: 'Tin trùng nội dung (cùng chức danh, công ty, địa điểm)' };
      }
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

  private contentKey(d: Record<string, unknown>): { t: string; c: string; l: string } | null {
    const t = normalizeSearchText(String(d?.title ?? ''));
    const c = normalizeSearchText(String(d?.companyName ?? ''));
    if (!t || !c) return null;
    return { t, c, l: normalizeSearchText(String(d?.location ?? '')) };
  }

  // Gộp các mục đang chờ bị lặp (cùng chức danh + công ty + địa điểm): giữ mục cũ nhất, các mục còn lại chuyển sang "Bỏ qua".
  async mergeDuplicates(): Promise<number> {
    const rows = await this.repo.find({ where: { status: 'pending' }, order: { createdAt: 'ASC' } });
    const seen = new Map<string, string>();
    let n = 0;
    for (const r of rows) {
      const k = this.contentKey(r.data);
      if (!k) continue;
      const id = `${k.t}|${k.c}|${k.l}`;
      if (seen.has(id)) {
        r.status = 'skipped';
        r.note = 'Trùng nội dung với mục đã có';
        await this.repo.save(r);
        n++;
      } else seen.set(id, r.id);
    }
    return n;
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
    await this.enrich(id).catch(() => undefined);
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
        website: d.companyWebsite && !isBoardHost(hostOf(d.companyWebsite)) ? d.companyWebsite : undefined,
        logoUrl: d.companyLogo || undefined,
        industry: d.industry || undefined,
        sourceLabel: host ? `Tổng hợp từ ${host}` : undefined,
      });
      company = created.company;
    }
    const prov = findProvince(d.location);
    const job = await this.admin.createJobForCompany(admin, company.id, {
      title,
      industry: d.industry || inferIndustry(title, d.description) || undefined,
      provinces: prov ? [prov] : undefined,
      location: d.location || undefined,
      address: d.address || d.location || undefined,
      requirements: d.requirements || undefined,
      benefits: d.benefits || undefined,
      experienceLevel: d.experienceLevel || undefined,
      level: d.level || undefined,
      headcount: Number(d.headcount) > 0 ? Number(d.headcount) : undefined,
      gender: d.gender || undefined,
      ageRange: d.ageRange || undefined,
      workSchedule: d.workSchedule || undefined,
      tags: Array.isArray(d.tags) && d.tags.length ? d.tags : undefined,
      isUrgent: d.isUrgent === true ? true : undefined,
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

  // Đọc lại trang gốc của tin cũ (nhập trước Đợt 126) để bổ sung ngành nghề + các khối còn thiếu. Chỉ điền chỗ còn trống, không đè phần Admin đã sửa.
  async enrich(id: string) {
    const row = await this.getOne(id);
    const d = (row.data ?? {}) as Record<string, any>;
    if (d.enriched || !['pending', 'failed'].includes(row.status)) return row;
    const ex = await extractJobFromUrl(row.sourceUrl);
    if (!ex.found) return row;
    const merged: Record<string, any> = { ...d };
    for (const [k, v] of Object.entries(ex.data as Record<string, any>)) {
      const cur = merged[k];
      const empty = cur === undefined || cur === null || cur === '' || (Array.isArray(cur) && !cur.length);
      if (empty && v !== undefined && v !== null && v !== '') merged[k] = v;
    }
    if (merged.companyWebsite && d.companyWebsite && !ex.data.companyWebsite) merged.companyWebsite = undefined;
    merged.enriched = true;
    row.data = merged as never;
    return this.repo.save(row);
  }

  // Tự đăng: tin "Chờ xem" tìm được sau `since` và đã quá `minutes` phút. Lỗi 2 lần thì thôi (để Admin xem tay).
  async autoPublishDue(minutes: number, since: Date, actor: AdminActor): Promise<number> {
    const cutoff = new Date(Date.now() - minutes * 60_000);
    const rows = await this.repo
      .createQueryBuilder('i')
      .where("i.status = 'pending'")
      .andWhere('i.createdAt >= :since AND i.createdAt <= :cutoff', { since, cutoff })
      .orderBy('i.createdAt', 'ASC')
      .take(15)
      .getMany();
    let n = 0;
    for (const r of rows) {
      if (n >= 5) break;
      const fails = Number((r.data as Record<string, unknown>)?.autoFails ?? 0);
      if (fails >= 2) continue;
      try {
        await this.publish(actor, r.id, {});
        n++;
      } catch (e) {
        const fresh = await this.repo.findOne({ where: { id: r.id } });
        if (fresh && fresh.status === 'pending') {
          fresh.data = { ...(fresh.data as object), autoFails: fails + 1 } as never;
          fresh.note = `Tự đăng chưa được: ${(e as Error).message}`;
          await this.repo.save(fresh);
        }
      }
    }
    return n;
  }

  // Đăng nhiều tin một lúc (đã xem lướt): lần lượt từng tin để công ty vừa tạo được nhận ra ở tin sau.
  async publishMany(admin: AdminActor, ids: string[]) {
    const list = Array.from(new Set((ids ?? []).map(String))).slice(0, 10);
    let ok = 0;
    const failed: { id: string; message: string }[] = [];
    for (const id of list) {
      try {
        await this.publish(admin, id, {});
        ok++;
      } catch (e) {
        failed.push({ id, message: (e as Error).message });
      }
    }
    return { ok, failed };
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

  // Tin đã đăng nhưng sai (ví dụ gắn nhầm công ty): xóa tin đã đăng và đưa mục về "Chờ xem" để đăng lại đúng.
  async reopen(admin: AdminActor, id: string) {
    const row = await this.getOne(id);
    if (row.status !== 'published') throw new BadRequestException('Chỉ đăng lại được tin đã đăng');
    if (row.jobId) {
      try {
        await this.admin.deleteJob(admin, row.jobId);
      } catch {
        /* tin đã bị xóa trước đó */
      }
    }
    row.status = 'pending';
    row.jobId = null as never;
    row.matchedCompanyId = null as never;
    return this.repo.save(row);
  }

  async skip(id: string) {
    const row = await this.getOne(id);
    row.status = 'skipped';
    return this.repo.save(row);
  }

  // Đưa mục về lại hàng chờ: "Bỏ qua" → "Chờ xem" (hoặc "Công ty có chủ" nếu công ty đó đã có chủ thật); "Đã báo công ty" → "Công ty có chủ".
  // Đặt lại giờ để chế độ tự đăng không đăng ngay các tin vừa đưa về.
  async restore(id: string) {
    const row = await this.getOne(id);
    if (!['skipped', 'owner_notified'].includes(row.status)) throw new BadRequestException('Mục này không cần đưa về hàng chờ');
    let owner = row.status === 'owner_notified';
    if (!owner && row.matchedCompanyId) {
      const c = await this.companyRepo.findOne({ where: { id: row.matchedCompanyId } });
      owner = !!c && this.hasOwner(c);
    }
    const d = { ...(row.data as Record<string, unknown>) };
    delete d.autoFails;
    row.data = d as never;
    row.status = owner ? 'owner_review' : 'pending';
    row.note = null as never;
    await this.repo.save(row);
    await this.repo.update(id, { createdAt: new Date() } as never);
    return row;
  }

  // Thao tác hàng loạt trên nhiều mục: bỏ qua / đưa về hàng chờ / báo công ty.
  async bulk(admin: AdminActor, ids: string[], action: 'skip' | 'restore' | 'notify') {
    const list = Array.from(new Set((ids ?? []).map(String))).slice(0, 100);
    let ok = 0;
    const failed: { id: string; message: string }[] = [];
    for (const id of list) {
      try {
        if (action === 'skip') await this.skip(id);
        else if (action === 'restore') await this.restore(id);
        else await this.notifyOwner(admin, id);
        ok++;
      } catch (e) {
        failed.push({ id, message: (e as Error).message });
      }
    }
    return { ok, failed };
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
