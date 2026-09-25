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
  // Đợt 17d (25/09/2026) — schema.org `validThrough` là field chuẩn cho hạn nộp, trước đó bỏ sót.
  deadline?: string;
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

// Đợt 17d (25/09/2026) — tách phần "dọn text" dùng chung cho cả toRichTextHtml() (bọc <p>) VÀ
// extractSalaryFromText() mới (dò số tiền trong đoạn văn xuôi) — trước đó logic này nằm gọn trong
// toRichTextHtml(), giờ cần dùng lại dạng text thuần (không HTML) cho việc dò lương.
function cleanTextLines(raw?: unknown): string[] {
  if (typeof raw !== 'string') return [];
  let text = raw
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  text = decodeHtmlEntities(text);
  return text
    .split(/\r\n|\r|\n/)
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

// Chuyển text/HTML thô từ JSON-LD thành rich text HTML gọn (mỗi dòng nguồn → 1 đoạn <p>), tương
// thích trực tiếp với RichTextEditor ở FE và `sanitizeRichText()` khi lưu ở backend.
function toRichTextHtml(raw?: unknown): string | undefined {
  const lines = cleanTextLines(raw);
  if (lines.length === 0) return undefined;
  return lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
}

// Đợt 17d (25/09/2026) — quy ước TOÀN HỆ THỐNG: cột `salary_min`/`salary_max` lưu theo ĐƠN VỊ TRIỆU
// ĐỒNG (VD 15 nghĩa là 15.000.000đ — xem SALARY_TIERS/formatSalary/formatSalaryTag ở frontend), KHÔNG
// phải số tiền đầy đủ. Trước đợt này, `extractSalary()` lấy thẳng `minValue`/`maxValue` từ schema.org
// baseSalary — mà giá trị đó ở hầu hết trang nguồn là SỐ TIỀN ĐẦY ĐỦ (VD 15000000), nên nếu lưu thẳng
// sẽ ra "15000000 triệu" hiển thị vô lý. Hàm này quy đổi số ≥ 1.000.000 xuống đơn vị triệu; số đã nhỏ
// (đã đúng đơn vị triệu, VD dò được "15" từ text "15 triệu") thì giữ nguyên. Áp dụng cho MỌI nơi số
// lương/thu nhập được tạo ra (JSON-LD baseSalary lẫn dò trong văn bản) để không lưu nhầm số khổng lồ.
function normalizeSalaryAmount(raw: number | undefined): number | undefined {
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return undefined;
  if (raw >= 1_000_000) return Math.round(raw / 1_000_000);
  return Math.round(raw);
}

// Đợt 17d (25/09/2026) — bổ sung theo yêu cầu người dùng (đã hỏi rõ qua AskUserQuestion, chọn "Có, tự
// dò best-effort"): nhiều tin (đặc biệt do Admin tự dán/nhập tay từ Facebook) không có baseSalary
// chuẩn hoá — số tiền nằm lẫn trong đoạn mô tả/phúc lợi dạng văn xuôi (VD "Thu nhập: 15 - 18 triệu
// theo năng lực"). CHỈ dùng khi extractSalary() từ baseSalary không ra kết quả gì — Admin luôn xem lại
// trước khi lưu vì đây chỉ là dò mẫu câu thường gặp, không phải đọc hiểu ngữ nghĩa.
function extractSalaryFromText(lines: string[]): { min?: number; max?: number } {
  const text = lines.join(' ');
  // "15 - 18 triệu" / "15tr - 18tr" / "15 triệu đến 18 triệu"
  const rangeMatch = text.match(
    /(\d{1,3})\s*(?:triệu|tr)?\s*(?:-|–|~|đến)\s*(\d{1,3})\s*(?:triệu|tr\b)/i,
  );
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (min > 0 || max > 0) return { min: min || undefined, max: max || undefined };
  }
  // "lương 20 triệu" / "thu nhập 20tr/tháng" — chỉ 1 giá trị, dùng chung cho cả min/max.
  const singleMatch = text.match(/(\d{1,3})\s*(?:triệu|tr\b)/i);
  if (singleMatch) {
    const v = Number(singleMatch[1]);
    if (v > 0) return { min: v, max: v };
  }
  return {};
}

// Đợt 17d (25/09/2026) — schema.org employmentType trả về mã tiếng Anh chuẩn (FULL_TIME/PART_TIME/...)
// nhưng hệ thống chỉ chấp nhận 4 giá trị tiếng Việt cố định (EMPLOYMENT_TYPES ở apps/web/src/lib/
// catalogs.ts) — trước đây lưu thẳng mã tiếng Anh thô, không khớp lựa chọn nào nên hiển thị "—" ở trang
// công khai. Map sang đúng nhãn tiếng Việt; mã lạ/không nhận diện được → để trống (không đoán bừa).
const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  FULL_TIME: 'Nhân viên chính thức',
  PART_TIME: 'Thời vụ - Nghề tự do',
  CONTRACTOR: 'Tạm thời/Dự án',
  TEMPORARY: 'Tạm thời/Dự án',
  INTERN: 'Thực tập',
  INTERNSHIP: 'Thực tập',
  VOLUNTEER: 'Thời vụ - Nghề tự do',
  PER_DIEM: 'Tạm thời/Dự án',
};

function mapEmploymentType(raw?: string): string | undefined {
  if (!raw) return undefined;
  const first = raw.split(',')[0].replace(/[[\]"]/g, '').trim().toUpperCase();
  return EMPLOYMENT_TYPE_MAP[first] ?? undefined;
}

// Đợt 17d (25/09/2026) — schema.org `validThrough` là field chuẩn cho hạn nộp hồ sơ, dạng ISO
// ("2026-12-31" hoặc "2026-12-31T00:00:00+07:00") — trước đây bị bỏ sót hoàn toàn, chưa trích xuất.
function extractDeadline(raw: unknown): string | undefined {
  const value = asText(raw);
  if (!value) return undefined;
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
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
    min: normalizeSalaryAmount(Number.isFinite(min) ? min : undefined),
    max: normalizeSalaryAmount(Number.isFinite(max) ? max : undefined),
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
    let salary = extractSalary(node.baseSalary);
    // Đợt 17d — không có baseSalary chuẩn hoá thì thử dò số tiền trong đoạn mô tả (best-effort, đã xác
    // nhận với người dùng). Số dò được từ text (VD "15" từ "15 triệu") đã đúng đơn vị triệu sẵn, không
    // cần normalizeSalaryAmount() thêm lần nữa (hàm này tự bỏ qua số đã nhỏ).
    if (salary.min === undefined && salary.max === undefined) {
      salary = extractSalaryFromText(cleanTextLines(node.description));
    }
    const data: ExtractedJobData = {
      title: asText(node.title),
      companyName: asText(org?.name),
      description: toRichTextHtml(node.description),
      location: extractLocation(node.jobLocation),
      employmentType: mapEmploymentType(asText(node.employmentType)),
      salaryMin: salary.min,
      salaryMax: salary.max,
      deadline: extractDeadline(node.validThrough),
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
