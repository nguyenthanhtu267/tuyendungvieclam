import { Controller, Get, Query, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { Company } from '../database/entities/company.entity';
import { assertPublicHttpUrl } from '../common/public-url.util';

// Đợt 91 — "logo nhẹ": logo công ty là link ảnh do NTD dán (có khi cả vài trăm KB, 1000×1000px) nhưng chỉ hiện ở khung 44–80px.
// Endpoint này tải ảnh gốc MỘT lần, thu nhỏ còn ≤192px, nén WebP (thường 3–10 KB), nhớ trong RAM; trình duyệt/CDN giữ 30 ngày.
//  • CHỈ phục vụ link đang là logo của một công ty trong CSDL (không thể dùng làm "proxy ảnh" tự do).
//  • Chặn SSRF (assertPublicHttpUrl ở mọi bước chuyển hướng), giới hạn dung lượng gốc 3 MB, tối đa 2 ảnh xử lý cùng lúc.
//  • Lỗi bất kỳ → 404 ngắn hạn; web tự quay về dùng link gốc (không bao giờ tệ hơn trước).
const ALLOWED = [48, 64, 96, 128, 192];
const MAX_SRC = 3 * 1024 * 1024;
const TIMEOUT_MS = 5000;
const MAX_CACHE = 400;
const UA = 'Mozilla/5.0 (compatible; TuyenDungLogoProxy/1.0)';

type Sharp = typeof import('sharp');
let sharpMod: Sharp | null | undefined;
function getSharp(): Sharp | null {
  if (sharpMod !== undefined) return sharpMod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sharpMod = require('sharp') as Sharp;
    sharpMod.cache(false);
    sharpMod.concurrency(1);
  } catch {
    sharpMod = null; // máy không cài được sharp → endpoint tự tắt (404), web dùng link gốc
  }
  return sharpMod;
}

const cache = new Map<string, Buffer>();
let active = 0;
const waiting: (() => void)[] = [];
async function acquire() {
  if (active < 2) {
    active++;
    return;
  }
  await new Promise<void>((r) => waiting.push(r));
  active++;
}
function release() {
  active--;
  waiting.shift()?.();
}

@Controller('public/logo')
@SkipThrottle()
export class LogoProxyController {
  constructor(@InjectRepository(Company) private readonly companies: Repository<Company>) {}

  private async download(rawUrl: string): Promise<Buffer | null> {
    let u = await assertPublicHttpUrl(rawUrl).catch(() => null);
    for (let hop = 0; u && hop < 4; hop++) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(u, { redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'image/*' } });
        const loc = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
        if (loc) {
          u = await assertPublicHttpUrl(new URL(loc, u).toString()).catch(() => null);
          continue;
        }
        if (!res.ok) return null;
        const type = (res.headers.get('content-type') ?? '').toLowerCase();
        if (!type.startsWith('image/') || type.includes('svg')) return null; // SVG để trình duyệt tự hiển thị từ link gốc
        const len = Number(res.headers.get('content-length') ?? 0);
        if (len > MAX_SRC) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        return buf.length > MAX_SRC ? null : buf;
      } catch {
        return null;
      } finally {
        clearTimeout(t);
      }
    }
    return null;
  }

  @Get()
  async logo(@Query('u') u: string | undefined, @Query('s') s: string | undefined, @Res() res: Response) {
    const fail = () => {
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.status(404).end();
    };
    if (!u || u.length > 600 || !/^https?:\/\//i.test(u)) return fail();
    const want = Number(s) || 96;
    const size = ALLOWED.find((n) => n >= want) ?? ALLOWED[ALLOWED.length - 1];
    const key = `${size}|${u}`;

    let out = cache.get(key);
    if (!out) {
      const sharp = getSharp();
      if (!sharp) return fail();
      // chỉ phục vụ logo thật sự thuộc một công ty
      const owned = await this.companies.exists({ where: [{ logoUrl: u }, { autoLogoUrl: u }] }).catch(() => false);
      if (!owned) return fail();
      await acquire();
      try {
        const src = await this.download(u);
        if (!src) return fail();
        out = await sharp(src, { failOn: 'none', limitInputPixels: 25_000_000 })
          .rotate()
          .resize(size, size, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
        cache.set(key, out);
      } catch {
        return fail();
      } finally {
        release();
      }
    }
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.status(200).send(out);
  }
}
