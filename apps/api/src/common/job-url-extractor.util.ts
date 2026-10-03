// Đợt 17 (25/09/2026) — "Dán URL → trích xuất tự động" (mục nhập nội dung, 1 trong 2 cách đã chốt
// qua AskUserQuestion). Không thêm thư viện cào HTML mới (axios/cheerio/jsdom — đã kiểm tra
// package.json KHÔNG có sẵn) — dùng thẳng `fetch` có sẵn của Node 22 + regex/JSON.parse để đọc dữ
// liệu schema.org "JobPosting" (JSON-LD) mà phần lớn trang tuyển dụng lớn (careerviet.vn,
// vietnamworks.com, glints.com, itviec.com...) nhúng sẵn CHÍNH ĐỂ các bên tổng hợp (aggregator) như
// Google for Jobs đọc được — đáng tin hơn dò HTML thô vì đây là dữ liệu chuẩn hoá, ít vỡ khi trang
// đổi giao diện. Chỉ best-effort: trang không nhúng JSON-LD (VD nhóm Facebook, forum) thì trả về rỗng,
// Admin tự nhập tay — KHÔNG coi đây là lỗi cứng.

import { assertPublicHttpUrl } from './public-url.util';
import { BOT_UA, PoliteBlockError, politeGate, politeReport } from './polite-crawl.util';
import { inferIndustry } from './job-industry.util';
import { inferChannel } from './job-channel.util';

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
  // Đợt 119 — thông tin công ty đọc kèm (schema.org hiringOrganization) + ngành, để tạo/so khớp công ty tự động.
  companyWebsite?: string;
  companyLogo?: string;
  industry?: string;
  // Đợt 126 — đọc thật kỹ: tách các khối nội dung + thông tin phụ để đăng xong là đầy đủ như trang gốc.
  requirements?: string;
  benefits?: string;
  experienceLevel?: string;
  level?: string;
  headcount?: number;
  gender?: string;
  ageRange?: string;
  workSchedule?: string;
  address?: string;
  tags?: string[];
  isUrgent?: boolean;
  // Đợt 126 — đã đọc kỹ (đánh dấu để không đọc lại lần nữa khi đăng hàng loạt).
  enriched?: boolean;
  // Đợt 135 — kênh tin + nhóm việc + phúc lợi + nơi làm việc (tin công nhân/sinh viên/thực tập)
  channel?: string;
  laborGroup?: string;
  laborPerks?: string[];
  workPlace?: { province: string; mode: 'old'; oldDistrict?: string | null } | null;
}

export interface ExtractJobUrlResult {
  found: boolean;
  data: ExtractedJobData;
  warning?: string;
  // Đợt 120 — link thật sau khi theo chuyển hướng (link theo dõi trong email → link tin gốc).
  finalUrl?: string;
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

function asUrl(value: unknown): string | undefined {
  const v = asText(value);
  return v && /^https?:\/\//i.test(v) ? v : undefined;
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

export async function extractJobFromUrl(url: string, opts: { auto?: boolean } = {}): Promise<ExtractJobUrlResult> {
  let html: string;
  let finalUrl: string | undefined;
  try {
    // Đợt 119 — chỉ gọi tới địa chỉ Internet công khai (chặn mạng nội bộ), tự theo chuyển hướng tối đa 4 lần và kiểm tra lại từng chặng.
    let target: URL | null = await assertPublicHttpUrl(url).catch(() => null);
    if (!target) return { found: false, data: {}, warning: 'Link không hợp lệ hoặc không phải trang web công khai.' };
    let res: Response | null = null;
    for (let hop = 0; hop < 5; hop++) {
      // Đợt 157 — lần tải TỰ ĐỘNG (quét nguồn) đi qua cổng lịch sự: robots.txt, giãn cách, giới hạn ngày, dừng khi bị từ chối.
      if (opts.auto) await politeGate(target);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        res = await fetch(target, {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            // Vài trang chặn user-agent mặc định của fetch/bot — giả lập trình duyệt thường để tăng khả
            // năng tải được trang (không phải để né bất kỳ cơ chế xác thực/đăng nhập nào).
            'User-Agent': opts.auto
              ? BOT_UA
              : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml',
          },
        });
      } finally {
        clearTimeout(timeout);
      }
      const loc = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!loc) break;
      target = await assertPublicHttpUrl(new URL(loc, target).toString()).catch(() => null);
      if (!target) return { found: false, data: {}, warning: 'Trang chuyển hướng tới địa chỉ không hợp lệ.' };
      res = null;
    }
    if (!res) return { found: false, data: {}, warning: 'Trang chuyển hướng quá nhiều lần — vui lòng nhập tay.' };
    if (opts.auto) await politeReport(target, res.status);
    if (!res.ok) {
      return { found: false, data: {}, warning: `Không tải được trang (mã lỗi ${res.status}) — vui lòng nhập tay.` };
    }
    finalUrl = target.toString();
    const buf = await res.arrayBuffer();
    html = Buffer.from(buf.slice(0, MAX_HTML_BYTES)).toString('utf-8');
  } catch (e) {
    if (e instanceof PoliteBlockError) return { found: false, data: {}, warning: e.message };
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
      companyWebsite: asUrl(org?.sameAs) ?? asUrl(org?.url),
      companyLogo: asUrl(org?.logo) ?? asUrl((org?.logo as Record<string, unknown> | undefined)?.url),
      industry: asText(node.industry),
    };
    enrichFromNode(node, data);
    const hasAnyField = Object.values(data).some((v) => v !== undefined);
    if (hasAnyField) return { found: true, data, finalUrl };
  }

  return {
    found: false,
    data: {},
    warning: 'Trang này không có sẵn dữ liệu chuẩn hoá (JSON-LD) để trích xuất tự động — vui lòng nhập tay.',
    finalUrl,
  };
}


// ===== Đợt 126 — đọc kỹ: tách khối + suy ra thông tin phụ =====
const BOARD_SITES = /(careerviet|vietnamworks|topcv|itviec|glints|jobsgo|timviec365|vieclam24h|123job|mywork|joboko|careerlink|vieclamtot|indeed|linkedin|jobstreet|navigos|ybox|topdev|viectotnhat|timviecnhanh|lamthem|facebook|zalo|google|youtube)\./i;
export function isJobBoardUrl(u?: string): boolean {
  try {
    return !!u && BOARD_SITES.test(new URL(u).hostname.replace(/^www\./, '') + '.');
  } catch {
    return false;
  }
}

function plain(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

type Section = 'desc' | 'req' | 'ben' | 'sched' | 'addr' | 'other' | 'apply';
function headingOf(line: string): { sec: Section; rest: string } | null {
  const m = line.match(/^[•\-\s*#]*([^:：]{3,70}?)\s*[:：]\s*(.*)$/);
  const head = plain(m ? m[1] : line.replace(/^[•\-\s*#]+/, '')).trim();
  const rest = m ? m[2] : '';
  const short = !m && line.length <= 60;
  if (!m && !short) return null;
  const table: [RegExp, Section][] = [
    [/^(mo ta( cong viec)?|noi dung cong viec|trach nhiem|nhiem vu)$/, 'desc'],
    [/^(yeu cau( ung vien| cong viec| tuyen dung| khac)?|tieu chuan|ky nang|trinh do|ung vien can)$/, 'req'],
    [/^(quyen loi|quyen loi duoc huong|phuc loi|che do( phuc loi)?|che do dai ngo|thu nhap va phuc loi|tai sao ban se yeu thich)$/, 'ben'],
    [/^(thoi gian lam viec|gio lam viec|ca lam viec|lich lam viec)$/, 'sched'],
    [/^(dia diem lam viec|noi lam viec|dia chi lam viec)$/, 'addr'],
    [/^(ho so|ho so ung tuyen|cach thuc ung tuyen|cach nop|lien he|thong tin lien he)$/, 'apply'],
    [/^(thong tin khac|luu y)$/, 'other'],
  ];
  for (const [re, sec] of table) if (re.test(head)) return { sec, rest: rest.trim() };
  return null;
}

function splitSections(lines: string[]) {
  const out: Record<Section, string[]> = { desc: [], req: [], ben: [], sched: [], addr: [], other: [], apply: [] };
  let cur: Section = 'desc';
  let found = false;
  for (const ln of lines) {
    const h = headingOf(ln);
    if (h) {
      found = true;
      cur = h.sec;
      if (h.rest) out[cur].push(h.rest);
      continue;
    }
    // Dòng dạng "Số lượng: 2", "Giới tính: Nam"... là thông tin phụ, không thuộc khối đang đọc.
    if (/^[•\-\s*]*(so luong|gioi tinh|do tuoi|kinh nghiem|cap bac|hinh thuc|muc luong|han nop|nganh nghe|hoc van)[^:：]{0,20}[:：]/.test(plain(ln))) {
      out.other.push(ln);
      continue;
    }
    out[cur].push(ln);
  }
  return { out, found };
}

const toP = (ls: string[]) => (ls.length ? ls.map((l) => `<p>${escapeHtml(l)}</p>`).join('') : undefined);

function expLevelFromYears(y: number): string {
  if (y <= 0) return 'Không yêu cầu kinh nghiệm';
  if (y < 1) return 'Đến dưới 1 năm';
  if (y < 5) return 'Từ 1 đến 4 năm';
  if (y < 7) return 'Từ 5 đến 7 năm';
  if (y < 11) return 'Từ 7 đến 10 năm';
  return 'Từ 11 năm';
}

export function inferLevel(title: string): string {
  const t = plain(title);
  if (/giam doc|director|\bceo\b|\bcfo\b|\bcoo\b|tong giam doc/.test(t)) return 'Quản lý cấp cao';
  if (/truong phong|pho phong|manager|quan ly|truong bo phan|truong chi nhanh/.test(t)) return 'Quản lý';
  if (/truong nhom|giam sat|leader|supervisor|to truong|truong ca|team lead/.test(t)) return 'Trưởng nhóm / Giám sát';
  if (/thuc tap|intern/.test(t)) return 'Sinh viên / Thực tập sinh';
  if (/moi tot nghiep|fresher/.test(t)) return 'Mới tốt nghiệp';
  return 'Nhân viên';
}

function textOf(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap(textOf);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return textOf(o.name ?? o.description ?? o.value ?? '');
  }
  return typeof v === 'string' ? cleanTextLines(v) : [];
}

// Bổ sung các trường phụ cho `data` từ nút JSON-LD gốc + văn bản mô tả. Chỉ điền trường còn trống.
export function enrichFromNode(node: Record<string, unknown>, data: ExtractedJobData): ExtractedJobData {
  const raw = [...cleanTextLines(node.description)];
  const extra = {
    resp: textOf(node.responsibilities),
    qual: [...textOf(node.qualifications), ...textOf(node.educationRequirements), ...textOf(node.skills)],
    ben: [...textOf(node.jobBenefits), ...textOf(node.incentiveCompensation)],
    hours: textOf(node.workHours),
  };
  const { out, found } = splitSections(raw);
  const desc = found ? [...out.desc, ...extra.resp] : [...raw, ...extra.resp];
  const req = [...out.req, ...extra.qual];
  const ben = [...out.ben, ...extra.ben];
  // Phần "thông tin khác"/hồ sơ ứng tuyển vẫn giữ lại ở cuối mô tả để không mất chữ nào của trang gốc.
  const tail = [...out.other, ...out.apply];
  if (found) {
    data.description = toP([...desc, ...tail.map((l) => l)]) ?? data.description;
    data.requirements ??= toP(req);
    data.benefits ??= toP(ben);
  }
  const fullText = [...raw, ...extra.qual, ...extra.hours].join('\n');
  const ft = plain(fullText);
  const title = data.title ?? '';

  data.workSchedule ??= (extra.hours[0] ?? out.sched.join('; ')) || undefined;
  if (!data.address) {
    const loc = node.jobLocation;
    const place = (Array.isArray(loc) ? loc[0] : loc) as Record<string, any> | undefined;
    const a = (place?.address ?? {}) as Record<string, unknown>;
    const parts = [a.streetAddress, a.addressLocality, a.addressRegion].filter((x) => typeof x === 'string' && x.trim()) as string[];
    data.address = (parts.length ? decodeHtmlEntities(parts.join(', ')) : out.addr.join(', ')) || data.location || undefined;
  }

  // Kinh nghiệm
  if (!data.experienceLevel) {
    const er = node.experienceRequirements as Record<string, unknown> | string | undefined;
    const months = er && typeof er === 'object' ? Number((er as Record<string, unknown>).monthsOfExperience) : NaN;
    if (Number.isFinite(months)) data.experienceLevel = expLevelFromYears(months / 12);
    else if (/khong yeu cau (kinh nghiem|kn)|khong can kinh nghiem|chua co kinh nghiem|chua can kinh nghiem/.test(ft)) data.experienceLevel = 'Không yêu cầu kinh nghiệm';
    else {
      const m = ft.match(/(\d{1,2})\s*(?:-|den|~)?\s*(\d{1,2})?\s*nam\s*(?:kinh nghiem|kn)/) ?? ft.match(/kinh nghiem[^0-9\n]{0,25}(\d{1,2})\s*(?:-|den|~)?\s*(\d{1,2})?\s*nam/);
      if (m) data.experienceLevel = expLevelFromYears(Number(m[1]));
      else if (/(duoi|it hon) 1 nam|(\d+)\s*thang kinh nghiem/.test(ft)) data.experienceLevel = 'Đến dưới 1 năm';
    }
  }
  data.level ??= inferLevel(title);

  // Số lượng tuyển
  if (data.headcount === undefined) {
    const n = Number(node.totalJobOpenings);
    const m = ft.match(/so luong( tuyen)?\s*[:\-]?\s*(\d{1,3})/);
    const v = Number.isFinite(n) && n > 0 ? n : m ? Number(m[2]) : undefined;
    if (v && v > 0) data.headcount = v;
  }

  // Giới tính + độ tuổi
  if (!data.gender) {
    const g = ft.match(/gioi tinh\s*[:\-]?\s*(nam\s*\/\s*nu|nu\s*\/\s*nam|nam|nu|khong yeu cau)/);
    if (g) data.gender = /\//.test(g[1]) || /khong/.test(g[1]) ? 'Không yêu cầu' : g[1] === 'nam' ? 'Nam' : 'Nữ';
    else if (/\(nam\)/.test(plain(title))) data.gender = 'Nam';
    else if (/\(nu\)/.test(plain(title))) data.gender = 'Nữ';
  }
  if (!data.ageRange) {
    const a = ft.match(/(?:do tuoi|tuoi)\s*[:\-]?\s*(?:tu\s*)?(\d{2})\s*(?:-|–|den|~|toi)\s*(\d{2})/);
    if (a) data.ageRange = `${a[1]} - ${a[2]}`;
  }

  // Hình thức làm việc (nếu JSON-LD chưa có)
  if (!data.employmentType) {
    if (/thuc tap sinh|internship/.test(plain(title))) data.employmentType = 'Thực tập';
    else if (/part ?time|ban thoi gian|thoi vu/.test(ft + plain(title))) data.employmentType = 'Thời vụ - Nghề tự do';
    else if (/full ?time|toan thoi gian/.test(ft)) data.employmentType = 'Nhân viên chính thức';
  }

  // Thẻ kỹ năng
  if (!data.tags) {
    const sk = textOf(node.skills).flatMap((s) => s.split(/[,;•]/)).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 40);
    if (sk.length) data.tags = Array.from(new Set(sk)).slice(0, 10);
  }

  if (data.isUrgent === undefined && /(\bgap\b|di lam ngay|urgent|tuyen gap)/.test(plain(title))) data.isUrgent = true;

  // Ngành nghề: ưu tiên đoán từ nội dung; ngành ghi trên trang gốc chỉ dùng nếu trùng danh mục.
  data.industry = inferIndustry(title, fullText, data.industry) ?? undefined;

  // Website công ty: bỏ nếu thực chất là link trang việc làm.
  if (data.companyWebsite && isJobBoardUrl(data.companyWebsite)) data.companyWebsite = undefined;
  if (!data.channel) {
    const ch = inferChannel(title, [data.description, data.requirements, data.benefits].filter(Boolean).join(' '), data.address ?? data.location ?? '');
    data.channel = ch.channel;
    if (ch.channel !== 'office') {
      data.laborGroup = ch.laborGroup;
      data.laborPerks = ch.laborPerks;
      data.workPlace = ch.workPlace ?? null;
    }
  }
  data.enriched = true;
  return data;
}
