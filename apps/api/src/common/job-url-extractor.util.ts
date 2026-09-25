// Đợt 17 (25/09/2026) — "Dán URL → trích xuất tự động" (mục nhập nội dung, 1 trong 2 cách đã chốt
// qua AskUserQuestion). Không thêm thư viện cào HTML mới (axios/cheerio/jsdom — đã kiểm tra
// package.json KHÔNG có sẵn) — dùng thẳng `fetch` có sẵn của Node 22 + regex/JSON.parse để đọc dữ
// liệu schema.org "JobPosting" (JSON-LD) mà phần lớn trang tuyển dụng lớn (careerviet.vn,
// vietnamworks.com, glints.com, itviec.com...) nhúng sẵn CHÍNH ĐỂ các bên tổng hợp (aggregator) như
// Google for Jobs đọc được — đáng tin hơn dò HTML thô vì đây là dữ liệu chuẩn hoá, ít vỡ khi trang
// đổi giao diện. Chỉ best-effort: trang không nhúng JSON-LD (VD nhóm Facebook, forum) thì trả về rỗng,
// Admin tự nhập tay — KHÔNG coi đây là lỗi cứng.

export interface ExtractedJobData {
  title?: string;
  companyName?: string;
  description?: string;
  location?: string;
  employmentType?: string;
  salaryMin?: number;
  salaryMax?: number;
}

export interface ExtractJobUrlResult {
  found: boolean;
  data: ExtractedJobData;
  warning?: string;
}

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 3 * 1024 * 1024; // 3MB đủ cho hầu hết trang tin tuyển dụng, tránh tải trang quá nặng

// Đợt 17b (25/09/2026) — FIX lỗi người dùng báo (ảnh chụp): mô tả trích xuất dính thành 1 khối chữ
// (mất hết xuống dòng) + còn nguyên "&amp;" chưa giải mã. Nguyên nhân: trường `description` trong
// JSON-LD của nhiều trang (VD careerviet.vn) là TEXT THUẦN (không phải thẻ HTML thật) nhưng đã được
// mã hoá thực thể HTML (VD "M&amp;A") + dùng "\n" thật để xuống dòng — code cũ (a) không giải mã thực
// thể, (b) dùng `.replace(/\s+/g, ' ')` gộp LUÔN cả ký tự xuống dòng thành 1 khoảng trắng, xoá sạch
// cấu trúc dòng. Hàm mới xử lý ĐƯỢC CẢ 2 trường hợp (text thuần lẫn có thẻ HTML thật xen kẽ): chuyển
// thẻ khối (<p>/<div>/<li>/<br>...) thành ký tự xuống dòng TRƯỚC khi xoá thẻ còn lại, giải mã thực
// thể HTML, rồi giữ nguyên từng dòng khi bọc lại thành đoạn <p> — đúng yêu cầu "phải xuống dòng như
// hiển thị của trang gốc".
const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  copy: '©',
  reg: '®',
  trade: '™',
  bull: '•',
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (full: string, name: string) => NAMED_HTML_ENTITIES[name.toLowerCase()] ?? full);
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Chuyển text/HTML thô từ JSON-LD thành rich text HTML gọn (mỗi dòng nguồn → 1 đoạn <p>), tương
// thích trực tiếp với RichTextEditor ở FE và `sanitizeRichText()` khi lưu ở backend.
function toRichTextHtml(raw?: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  let text = raw
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  text = decodeHtmlEntities(text);
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return undefined;
  return lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
}

function asText(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return decodeHtmlEntities(value.trim());
  if (Array.isArray(value) && value.length > 0) return asText(value[0]);
  return undefined;
}

// schema.org JobPosting.jobLocation có thể là 1 object hoặc mảng object Place/PostalAddress lồng nhau.
function extractLocation(jobLocation: unknown): string | undefined {
  const place = Array.isArray(jobLocation) ? jobLocation[0] : jobLocation;
  if (!place || typeof place !== 'object') return undefined;
  const address = (place as Record<string, unknown>).address;
  const addr = (Array.isArray(address) ? address[0] : address) as Record<string, unknown> | undefined;
  if (!addr) return undefined;
  const parts = [addr.addressLocality, addr.addressRegion].filter((p) => typeof p === 'string' && p.trim());
  return parts.length > 0
    ? decodeHtmlEntities((parts as string[]).join(', '))
    : asText(addr.addressLocality ?? addr.addressRegion);
}

function extractSalary(baseSalary: unknown): { min?: number; max?: number } {
  if (!baseSalary || typeof baseSalary !== 'object') return {};
  const value = (baseSalary as Record<string, unknown>).value;
  const v = (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined;
  if (!v) return {};
  const toNum = (x: unknown) => (typeof x === 'number' ? x : typeof x === 'string' && x.trim() ? Number(x) : undefined);
  const min = toNum(v.minValue) ?? toNum(v.value);
  const max = toNum(v.maxValue) ?? toNum(v.value);
  return {
    min: Number.isFinite(min) ? min : undefined,
    max: Number.isFinite(max) ? max : undefined,
  };
}

function findJobPostingNode(json: unknown): Record<string, unknown> | undefined {
  const isJobPosting = (item: unknown): item is Record<string, unknown> => {
    if (!item || typeof item !== 'object') return false;
    const type = (item as Record<string, unknown>)['@type'];
    return type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));
  };
  if (isJobPosting(json)) return json;
  const candidates: unknown[] = Array.isArray(json)
    ? json
    : json && typeof json === 'object' && Array.isArray((json as Record<string, unknown>)['@graph'])
      ? ((json as Record<string, unknown>)['@graph'] as unknown[])
      : [];
  return candidates.find(isJobPosting) as Record<string, unknown> | undefined;
}

export async function extractJobFromUrl(url: string): Promise<ExtractJobUrlResult> {
  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          // Vài trang chặn user-agent mặc định của fetch/bot — giả lập trình duyệt thường để tăng khả
          // năng tải được trang (không phải để né bất kỳ cơ chế xác thực/đăng nhập nào).
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      return { found: false, data: {}, warning: `Không tải được trang (mã lỗi ${res.status}) — vui lòng nhập tay.` };
    }
    const buf = await res.arrayBuffer();
    html = Buffer.from(buf.slice(0, MAX_HTML_BYTES)).toString('utf-8');
  } catch {
    return { found: false, data: {}, warning: 'Không tải được trang này (có thể do chặn truy cập tự động) — vui lòng nhập tay.' };
  }

  const scriptMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scriptMatches) {
    let json: unknown;
    try {
      json = JSON.parse(match[1].trim());
    } catch {
      continue;
    }
    const node = findJobPostingNode(json);
    if (!node) continue;

    const org = node.hiringOrganization as Record<string, unknown> | undefined;
    const salary = extractSalary(node.baseSalary);
    const data: ExtractedJobData = {
      title: asText(node.title),
      companyName: asText(org?.name),
      description: toRichTextHtml(node.description),
      location: extractLocation(node.jobLocation),
      employmentType: asText(node.employmentType),
      salaryMin: salary.min,
      salaryMax: salary.max,
    };
    const hasAnyField = Object.values(data).some((v) => v !== undefined);
    if (hasAnyField) return { found: true, data };
  }

  return {
    found: false,
    data: {},
    warning: 'Trang này không có sẵn dữ liệu chuẩn hoá (JSON-LD) để trích xuất tự động — vui lòng nhập tay.',
  };
}
