import { assertPublicHttpUrl } from './public-url.util';

// Đợt 18b (26/09/2026) — "dán link CV": tải 1 trang web công khai và lấy CHỮ để đưa qua bộ tách CV.
// Chỉ best-effort (đã nói rõ với người dùng): phần lớn trang CV (LinkedIn, TopCV…) yêu cầu đăng nhập
// hoặc chặn tải tự động → trả về cảnh báo gợi ý dùng "Dán nội dung" thay thế.
// Nếu trang có dữ liệu chuẩn hoá schema.org "Person" (JSON-LD) thì đưa lên đầu dưới dạng các dòng có
// nhãn ("Họ và tên: …") để bộ tách đọc chính xác hơn.

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d: string) =>
      String.fromCodePoint(parseInt(d, 10)),
    )
    .replace(
      /&([a-z]+);/gi,
      (full: string, n: string) => ENTITIES[n.toLowerCase()] ?? full,
    );
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(
        /<\/(p|div|li|ul|ol|h[1-6]|tr|section|article|header|footer)>/gi,
        '\n',
      )
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function personFromJsonLd(html: string): string[] {
  const lines: string[] = [];
  for (const m of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let json: unknown;
    try {
      json = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const nodes: unknown[] = Array.isArray(json)
      ? json
      : json &&
          typeof json === 'object' &&
          Array.isArray((json as Record<string, unknown>)['@graph'])
        ? ((json as Record<string, unknown>)['@graph'] as unknown[])
        : [json];
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      const n = node as Record<string, unknown>;
      const type = n['@type'];
      if (
        type !== 'Person' &&
        !(Array.isArray(type) && type.includes('Person'))
      )
        continue;
      const str = (v: unknown) =>
        typeof v === 'string' && v.trim()
          ? decodeEntities(v.trim())
          : undefined;
      const name = str(n.name);
      if (name) lines.push(`Họ và tên: ${name}`);
      const title = str(n.jobTitle);
      if (title) lines.push(`Vị trí: ${title}`);
      const email = str(n.email)?.replace(/^mailto:/i, '');
      if (email) lines.push(`Email: ${email}`);
      const phone = str(n.telephone);
      if (phone) lines.push(`Điện thoại: ${phone}`);
      const addr = n.address as Record<string, unknown> | undefined;
      const locality =
        addr && typeof addr === 'object'
          ? [str(addr.addressLocality), str(addr.addressRegion)]
              .filter(Boolean)
              .join(', ')
          : str(n.address);
      if (locality) lines.push(`Địa chỉ: ${locality}`);
      const desc = str(n.description);
      if (desc) lines.push('Giới thiệu', desc);
      return lines;
    }
  }
  return lines;
}

export async function fetchPageText(
  rawUrl: string,
): Promise<{ ok: true; text: string } | { ok: false; warning: string }> {
  let url = await assertPublicHttpUrl(rawUrl);
  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } catch {
      return {
        ok: false,
        warning:
          'Không tải được trang này (có thể do trang chặn truy cập tự động).',
      };
    } finally {
      clearTimeout(timer);
    }
    const location =
      res.status >= 300 && res.status < 400
        ? res.headers.get('location')
        : null;
    if (!location) break;
    // Mỗi lần chuyển hướng đều kiểm tra lại địa chỉ đích (tránh bị chuyển hướng vào mạng nội bộ).
    url = await assertPublicHttpUrl(new URL(location, url).toString());
    res = null;
  }
  if (!res) return { ok: false, warning: 'Trang chuyển hướng quá nhiều lần.' };
  if (!res.ok) {
    return {
      ok: false,
      warning: `Trang trả về lỗi ${res.status} — nhiều trang CV yêu cầu đăng nhập. Hãy mở trang, copy toàn bộ nội dung rồi dùng "Dán nội dung".`,
    };
  }
  const buf = Buffer.from((await res.arrayBuffer()).slice(0, MAX_BYTES));
  const html = buf.toString('utf-8');
  const person = personFromJsonLd(html);
  const text = [...person, htmlToText(html)].join('\n').trim();
  if (text.replace(/\s/g, '').length < 80) {
    return {
      ok: false,
      warning:
        'Trang gần như không có nội dung đọc được (có thể cần đăng nhập). Hãy copy nội dung rồi dùng "Dán nội dung".',
    };
  }
  return { ok: true, text: text.slice(0, 100_000) };
}
