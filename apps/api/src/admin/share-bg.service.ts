import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomBytes } from 'crypto';

// Đợt 153 — "Ảnh chia sẻ tin tuyển dụng" (khung xem trước khi dán link tin vào Facebook / Zalo): nền ảnh do Admin chọn.
// Có sẵn một bộ mẫu vector (vẽ trong web, mã p1..p8) + ảnh Admin tự tải lên. Chế độ: đổi mỗi ngày (xoay vòng) hoặc cố định.
export const SHARE_PRESET_IDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
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
}
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

const DEFAULT_CFG: ShareBgConfig = { mode: 'daily', fixedId: 'p1', presets: [...SHARE_PRESET_IDS], custom: [], texts: { ...DEFAULT_TEXTS } };

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

  async update(b: { mode?: string; fixedId?: string; presets?: string[]; texts?: Partial<ShareTexts> }) {
    const c = await this.get();
    if (b.mode === 'daily' || b.mode === 'fixed') c.mode = b.mode;
    if (typeof b.fixedId === 'string') c.fixedId = b.fixedId;
    if (Array.isArray(b.presets)) c.presets = b.presets.filter((x) => SHARE_PRESET_IDS.includes(x));
    if (b.texts) c.texts = cleanTexts(b.texts);
    const ids = [...SHARE_PRESET_IDS, ...c.custom.map((x) => x.id)];
    if (!ids.includes(c.fixedId)) c.fixedId = 'p1';
    if (!c.presets.length && !c.custom.length) throw new BadRequestException('Cần giữ ít nhất một nền trong vòng đổi theo ngày');
    await this.save(c);
    return this.adminView();
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
  async pick(date?: string, only?: string): Promise<{ type: 'preset' | 'image'; id: string; dataUrl?: string; texts?: ShareTexts }> {
    const c = await this.get();
    const r = await this.pickBg(c, date, only);
    return { ...r, texts: c.texts };
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
