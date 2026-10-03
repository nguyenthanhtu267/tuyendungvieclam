import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomBytes } from 'crypto';

// Đợt 153 — "Ảnh chia sẻ tin tuyển dụng" (khung xem trước khi dán link tin vào Facebook / Zalo): nền ảnh do Admin chọn.
// Có sẵn một bộ mẫu vector (vẽ trong web, mã p1..p8) + ảnh Admin tự tải lên. Chế độ: đổi mỗi ngày (xoay vòng) hoặc cố định.
export const SHARE_PRESET_IDS = Array.from({ length: 18 }, (_, i) => `p${i + 1}`);
const KEY = 'share_bg';
const MAX_CUSTOM = 8;
const MAX_DATA_URL = 900_000; // ~650KB ảnh

export interface ShareBgConfig {
  mode: 'daily' | 'fixed';
  fixedId: string;
  presets: string[];
  custom: { id: string; name: string; dataUrl: string }[];
  /** Chữ cố định in trên ảnh (Admin sửa được). Chữ theo từng tin (tiêu đề, công ty, lương, liên hệ...) luôn lấy từ tin. */
  texts: ShareTexts;
  /** Đợt 158 — kiểu chữ từng phần, hiện/ẩn thông tin, người minh hoạ, khổ ảnh. */
  style: ShareStyle;
  people: SharePeople;
  format: ShareFormat;
  /** Đợt 159 — hình người do Admin tự tải lên (nam / nữ) + chỉnh to nhỏ, lật trái–phải. */
  cast: ShareCast;
}
export interface CastPerson { dataUrl: string; w: number; h: number; scale: number; flip: boolean }
export interface ShareCast { source: 'vector' | 'upload'; male: CastPerson; female: CastPerson }
const emptyPerson = (): CastPerson => ({ dataUrl: '', w: 0, h: 0, scale: 100, flip: false });
export function cleanCast(raw: unknown): ShareCast {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { source?: unknown; male?: Partial<CastPerson>; female?: Partial<CastPerson> };
  const one = (x?: Partial<CastPerson>): CastPerson => {
    const ok = typeof x?.dataUrl === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(x.dataUrl) && x.dataUrl.length <= 900_000;
    return { dataUrl: ok ? (x!.dataUrl as string) : '', w: ok ? num(x?.w, 1, 8000, 1) : 0, h: ok ? num(x?.h, 1, 8000, 1) : 0, scale: num(x?.scale, 40, 220, 100), flip: x?.flip === true };
  };
  return { source: r.source === 'upload' ? 'upload' : 'vector', male: one(r.male), female: one(r.female) };
}
/** Đọc kích thước ảnh PNG/JPEG từ base64 (không cần thư viện). */
export function imageSize(dataUrl: string): { w: number; h: number } | null {
  try {
    const b = Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');
    if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch { /* hỏng */ }
  return null;
}
export const EL_KEYS = ['brand', 'tagline', 'badge', 'title', 'company', 'salary', 'meta', 'contact'] as const;
export type ShareEl = (typeof EL_KEYS)[number];
export interface ElStyle { color: string; scale: number; bold: boolean; italic: boolean }
export interface ShareStyle { els: Record<ShareEl, ElStyle>; show: { salary: boolean; location: boolean; deadline: boolean; contact: boolean }; scrim: number }
export type SharePeople = 'none' | 'male' | 'female' | 'both';
export type ShareFormat = 'wide' | 'square' | 'auto';
const defEl = (bold = true): ElStyle => ({ color: '', scale: 100, bold, italic: false });
export const DEFAULT_STYLE: ShareStyle = {
  els: { brand: defEl(), tagline: defEl(false), badge: defEl(), title: defEl(), company: defEl(), salary: defEl(), meta: defEl(), contact: defEl() },
  show: { salary: true, location: true, deadline: true, contact: true },
  scrim: 55,
};
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
export function cleanStyle(raw: unknown): ShareStyle {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { els?: Record<string, Partial<ElStyle>>; show?: Record<string, unknown>; scrim?: unknown };
  const els = {} as Record<ShareEl, ElStyle>;
  for (const k of EL_KEYS) {
    const d = DEFAULT_STYLE.els[k];
    const x = r.els?.[k] ?? {};
    els[k] = {
      color: typeof x.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(x.color) ? x.color : '',
      scale: num(x.scale, 60, 170, d.scale),
      bold: typeof x.bold === 'boolean' ? x.bold : d.bold,
      italic: typeof x.italic === 'boolean' ? x.italic : d.italic,
    };
  }
  const sh = r.show ?? {};
  const b = (k: string) => (typeof sh[k] === 'boolean' ? (sh[k] as boolean) : true);
  return { els, show: { salary: b('salary'), location: b('location'), deadline: b('deadline'), contact: b('contact') }, scrim: num(r.scrim, 0, 85, DEFAULT_STYLE.scrim) };
}
const cleanPeople = (v: unknown): SharePeople => (v === 'male' || v === 'female' || v === 'both' ? v : 'none');
const cleanFormat = (v: unknown): ShareFormat => (v === 'square' || v === 'auto' ? v : 'wide');
export interface ShareTexts { brand: string; tagline: string; urgent: string; fallback: string }
export const DEFAULT_TEXTS: ShareTexts = { brand: 'VIỆC LÀM NGAY', tagline: 'vieclamngay.vn · Ứng tuyển miễn phí', urgent: 'TUYỂN GẤP', fallback: 'Bấm vào liên kết để xem chi tiết và ứng tuyển' };
const cleanTexts = (t: Partial<ShareTexts> | undefined): ShareTexts => {
  const o = { ...DEFAULT_TEXTS };
  (Object.keys(o) as (keyof ShareTexts)[]).forEach((k) => {
    const v = t?.[k];
    if (typeof v === 'string' && v.trim()) o[k] = v.trim().slice(0, k === 'brand' ? 24 : 70);
  });
  return o;
};

const DEFAULT_CFG: ShareBgConfig = { mode: 'daily', fixedId: 'p1', presets: [...SHARE_PRESET_IDS], custom: [], texts: { ...DEFAULT_TEXTS }, style: cleanStyle({}), people: 'none', format: 'wide', cast: cleanCast({}) };

@Injectable()
export class ShareBgService implements OnModuleInit {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    await this.ds.query(`CREATE TABLE IF NOT EXISTS site_kv (key varchar(60) PRIMARY KEY, value jsonb NOT NULL, updated_at timestamp NOT NULL DEFAULT now())`).catch(() => undefined);
  }

  async get(): Promise<ShareBgConfig> {
    try {
      const r: { value: Partial<ShareBgConfig> }[] = await this.ds.query(`SELECT value FROM site_kv WHERE key=$1`, [KEY]);
      const v = r[0]?.value ?? {};
      return {
        mode: v.mode === 'fixed' ? 'fixed' : 'daily',
        fixedId: typeof v.fixedId === 'string' ? v.fixedId : DEFAULT_CFG.fixedId,
        presets: Array.isArray(v.presets) ? v.presets.filter((x) => SHARE_PRESET_IDS.includes(x)) : [...SHARE_PRESET_IDS],
        custom: Array.isArray(v.custom) ? v.custom : [],
        texts: cleanTexts(v.texts),
        style: cleanStyle((v as { style?: unknown }).style),
        people: cleanPeople((v as { people?: unknown }).people),
        format: cleanFormat((v as { format?: unknown }).format),
        cast: cleanCast((v as { cast?: unknown }).cast),
      };
    } catch {
      return { ...DEFAULT_CFG };
    }
  }

  private async save(c: ShareBgConfig) {
    await this.ds.query(
      `INSERT INTO site_kv (key, value, updated_at) VALUES ($1,$2::jsonb,now()) ON CONFLICT (key) DO UPDATE SET value=$2::jsonb, updated_at=now()`,
      [KEY, JSON.stringify(c)],
    );
  }

  // Cho Admin: trả về cấu hình, ảnh tự tải lên rút gọn (không kèm dữ liệu ảnh) để danh sách nhẹ.
  async adminView() {
    const c = await this.get();
    return { ...c, custom: c.custom.map((x) => ({ id: x.id, name: x.name, dataUrl: x.dataUrl })) };
  }

  async update(b: { mode?: string; fixedId?: string; presets?: string[]; texts?: Partial<ShareTexts>; style?: unknown; people?: string; format?: string; cast?: { source?: string; male?: Partial<CastPerson>; female?: Partial<CastPerson> } }) {
    const c = await this.get();
    if (b.mode === 'daily' || b.mode === 'fixed') c.mode = b.mode;
    if (typeof b.fixedId === 'string') c.fixedId = b.fixedId;
    if (Array.isArray(b.presets)) c.presets = b.presets.filter((x) => SHARE_PRESET_IDS.includes(x));
    if (b.texts) c.texts = cleanTexts(b.texts);
    if (b.style) c.style = cleanStyle(b.style);
    if (b.people) c.people = cleanPeople(b.people);
    if (b.format) c.format = cleanFormat(b.format);
    if (b.cast) {
      // chỉ nhận nguồn + cỡ + lật; dữ liệu ảnh chỉ đổi qua setPerson/removePerson
      if (b.cast.source === 'upload' || b.cast.source === 'vector') c.cast.source = b.cast.source;
      for (const k of ['male', 'female'] as const) {
        const x = b.cast[k];
        if (x) { c.cast[k].scale = num(x.scale, 40, 220, c.cast[k].scale); if (typeof x.flip === 'boolean') c.cast[k].flip = x.flip; }
      }
    }
    const ids = [...SHARE_PRESET_IDS, ...c.custom.map((x) => x.id)];
    if (!ids.includes(c.fixedId)) c.fixedId = 'p1';
    if (!c.presets.length && !c.custom.length) throw new BadRequestException('Cần giữ ít nhất một nền trong vòng đổi theo ngày');
    await this.save(c);
    return this.adminView();
  }

  async setPerson(who: string, dataUrl: string) {
    if (who !== 'male' && who !== 'female') throw new BadRequestException('Chỉ có hình nam hoặc nữ.');
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(dataUrl || '')) throw new BadRequestException('Chỉ nhận ảnh PNG hoặc JPG (nên dùng PNG nền trong suốt).');
    if (dataUrl.length > MAX_DATA_URL) throw new BadRequestException('Ảnh quá nặng (tối đa khoảng 650KB). Hãy thu nhỏ ảnh (cao khoảng 800px) rồi tải lại.');
    const sz = imageSize(dataUrl);
    if (!sz || sz.w < 1 || sz.h < 1) throw new BadRequestException('Không đọc được kích thước ảnh.');
    const c = await this.get();
    c.cast[who] = { ...c.cast[who], dataUrl, w: sz.w, h: sz.h };
    await this.save(c);
    return this.adminView();
  }

  async removePerson(who: string) {
    if (who !== 'male' && who !== 'female') throw new BadRequestException('Chỉ có hình nam hoặc nữ.');
    const c = await this.get();
    c.cast[who] = { ...emptyPerson(), scale: c.cast[who].scale, flip: c.cast[who].flip };
    if (!c.cast.male.dataUrl && !c.cast.female.dataUrl) c.cast.source = 'vector';
    await this.save(c);
    return this.adminView();
  }

  /** Chỉ khổ ảnh — cho trang /s (nhẹ, không kèm ảnh). */
  async formatOnly() {
    return { format: (await this.get()).format };
  }

  async addCustom(name: string, dataUrl: string) {
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(dataUrl || '')) throw new BadRequestException('Chỉ nhận ảnh PNG hoặc JPG.');
    if (dataUrl.length > MAX_DATA_URL) throw new BadRequestException('Ảnh quá nặng (tối đa khoảng 650KB). Hãy thu nhỏ ảnh về 1200×630 rồi tải lại.');
    const c = await this.get();
    if (c.custom.length >= MAX_CUSTOM) throw new BadRequestException(`Tối đa ${MAX_CUSTOM} ảnh tự tải lên — hãy xoá bớt ảnh cũ.`);
    c.custom.push({ id: `c${randomBytes(4).toString('hex')}`, name: (name || 'Ảnh nền').trim().slice(0, 60), dataUrl });
    await this.save(c);
    return this.adminView();
  }

  async removeCustom(id: string) {
    const c = await this.get();
    c.custom = c.custom.filter((x) => x.id !== id);
    if (c.fixedId === id) c.fixedId = 'p1';
    await this.save(c);
    return this.adminView();
  }

  /** Nền áp dụng cho một ngày (yyyy-mm-dd, giờ Việt Nam). `only` = xem thử một nền cụ thể. */
  async pick(date?: string, only?: string): Promise<{ type: 'preset' | 'image'; id: string; dataUrl?: string; texts?: ShareTexts; style?: ShareStyle; people?: SharePeople; format?: ShareFormat; cast?: ShareCast }> {
    const c = await this.get();
    const r = await this.pickBg(c, date, only);
    return { ...r, texts: c.texts, style: c.style, people: c.people, format: c.format, cast: c.cast };
  }

  private async pickBg(c: ShareBgConfig, date?: string, only?: string): Promise<{ type: 'preset' | 'image'; id: string; dataUrl?: string }> {
    const find = (id: string) => {
      const cu = c.custom.find((x) => x.id === id);
      if (cu) return { type: 'image' as const, id: cu.id, dataUrl: cu.dataUrl };
      if (SHARE_PRESET_IDS.includes(id)) return { type: 'preset' as const, id };
      return null;
    };
    if (only) {
      const x = find(only);
      if (x) return x;
    }
    if (c.mode === 'fixed') return find(c.fixedId) ?? { type: 'preset', id: 'p1' };
    const pool = [...c.presets.map((id) => ({ type: 'preset' as const, id })), ...c.custom.map((x) => ({ type: 'image' as const, id: x.id, dataUrl: x.dataUrl }))];
    if (!pool.length) return { type: 'preset', id: 'p1' };
    const d = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? new Date(`${date}T00:00:00Z`) : new Date();
    const day = Math.floor(d.getTime() / 86400000);
    return pool[day % pool.length];
  }
}
