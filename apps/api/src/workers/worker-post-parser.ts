import { LABOR_GROUPS, LaborKind, SHIFTS_BY_KIND } from './labor-groups';
import { guessProvince, oldDistricts } from './vn-geo';

// Đợt 136 — bộ tách thông tin người lao động từ bài đăng tìm việc (Zalo/Facebook) và từ bảng dán (Excel/CSV).
// Thuần quy tắc, không gọi AI/mạng. Kết quả luôn để Admin xem lại trước khi lưu.
export interface ParsedWorker {
  fullName: string | null;
  phone: string | null;
  birthYear: number | null;
  birthDate: string | null;
  gender: 'male' | 'female' | 'other' | null;
  province: string | null;
  oldDistrict: string | null;
  kind: LaborKind;
  desiredJobs: string[];
  shifts: string[];
  experience: 'none' | 'lt1' | 'gte1' | null;
  needsHousing: boolean;
  needsShuttle: boolean;
  note: string | null;
  /** Các thông tin quan trọng còn thiếu (để hiện cảnh báo) */
  missing: string[];
}

export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export function toPhone(v?: string | null): string | null {
  if (!v) return null;
  const m = String(v).match(/(?:\+?84|0)[\s.\-]?(?:\d[\s.\-]?){8,9}\d?/g) ?? [];
  for (const x of m) {
    let d = x.replace(/\D/g, '');
    if (d.startsWith('84') && d.length >= 11) d = '0' + d.slice(2);
    if (/^0\d{9}$/.test(d)) return d;
  }
  const d = String(v).replace(/\D/g, '');
  if (/^0\d{9}$/.test(d)) return d;
  if (/^[1-9]\d{8}$/.test(d) && /^[\d\s.\-+()]+$/.test(String(v))) return '0' + d; // Excel làm mất số 0 đầu
  return null;
}

const GROUP_KEYWORDS: [string, RegExp][] = [
  ['May mặc - Giày da', /\bmay\b|may mac|giay da|\bgiay\b|thoi trang|xuong may/],
  ['Điện tử - Lắp ráp', /dien tu|lap rap|linh kien|\bsmt\b|samsung/],
  ['Cơ khí - Hàn - Tiện', /co khi|\bhan\b|\btien\b|\bcnc\b|\bphay\b|tho han|tho tien/],
  ['Chế biến thực phẩm', /thuc pham|che bien|thuy san|\bbanh\b/],
  ['Kho vận - Bốc xếp', /\bkho\b|boc xep|boc vac|xuat nhap kho|thu kho|xe nang|phu kho|soan hang|boc hang/],
  ['Đóng gói - Phân loại', /dong goi|phan loai|\bqc\b|kiem hang|soi hang|\bkcs\b/],
  ['Nhựa - Bao bì - In ấn', /\bnhua\b|bao bi|in an|thung carton|carton/],
  ['Gỗ - Nội thất', /\bgo\b|noi that|\bmoc\b|tho moc|cua go/],
  ['Bảo vệ', /bao ve|\bbv\b|giu xe|trong xe/],
  ['Tạp vụ - Vệ sinh', /tap vu|ve sinh|don dep|giup viec|lao cong|o sin/],
  ['Lái xe - Giao hàng', /lai xe|tai xe|giao hang|shipper|xe tai|chay xe/],
  ['Phụ bếp - Phục vụ', /phu bep|phuc vu|bung be|nha hang|quan an|\bbep\b|rua chen|rua bat/],
  ['Xây dựng', /xay dung|phu ho|tho ho|tho son|cong trinh|tho xay/],
];
const STUDENT_KEYWORDS: [string, RegExp][] = [
  ['Phục vụ - Pha chế', /pha che|barista|phuc vu|bung be|cafe|ca phe|tra sua|nha hang/],
  ['Bán hàng - Thu ngân', /ban hang|thu ngan|cua hang|tap hoa|sieu thi/],
  ['Giao hàng', /giao hang|shipper|chay xe/],
  ['Gia sư', /gia su|day kem|day them/],
  ['Sự kiện - PG/PB', /\bpg\b|\bpb\b|su kien|le tan|phat to roi|tiep thi/],
  ['Nhập liệu - Văn phòng', /nhap lieu|van phong|data entry|\bexcel\b/],
  ['Chăm sóc khách hàng - Telesale', /cham soc khach|telesale|tong dai|cskh|call center/],
];
const INTERN_KEYWORDS: [string, RegExp][] = [
  ['Kế toán - Tài chính', /ke toan|tai chinh|kiem toan|ngan hang/],
  ['Công nghệ thông tin', /cntt|cong nghe thong tin|lap trinh|developer|\bit\b|phan mem/],
  ['Marketing - Truyền thông', /marketing|truyen thong|content|\bseo\b|quang cao|\bpr\b/],
  ['Kinh doanh - Bán hàng', /kinh doanh|sales|ban hang/],
  ['Nhân sự - Hành chính', /nhan su|hanh chinh|\bhr\b|tuyen dung/],
  ['Kỹ thuật - Cơ khí', /ky thuat|co khi|xay dung/],
  ['Điện - Điện tử', /dien tu|\bdien\b|tu dong hoa/],
  ['Thiết kế - Mỹ thuật', /thiet ke|my thuat|do hoa|design|photoshop/],
  ['Ngoại ngữ - Biên phiên dịch', /ngoai ngu|bien dich|phien dich|tieng (anh|trung|han|nhat)/],
  ['Logistics - Xuất nhập khẩu', /logistics|xuat nhap khau|\bxnk\b|van tai/],
];
const DEFAULT_GROUP: Record<LaborKind, string> = { worker: 'Lao động phổ thông khác', student: 'Bán thời gian khác', intern: 'Ngành khác' };

export function detectKind(text: string): LaborKind {
  const f = fold(text);
  if (/thuc tap|\btts\b|intern/.test(f)) return 'intern';
  if (/sinh vien|\bsv\b|part.?time|ban thoi gian|hoc sinh|dai hoc|cao dang/.test(f)) return 'student';
  return 'worker';
}

export function detectGroups(text: string, kind: LaborKind): string[] {
  const f = fold(text);
  const table = kind === 'intern' ? INTERN_KEYWORDS : kind === 'student' ? STUDENT_KEYWORDS : GROUP_KEYWORDS;
  const out: string[] = [];
  for (const [g, re] of table) if (re.test(f) && !out.includes(g)) out.push(g);
  // Người nhập đúng tên nhóm (vd "Bảo vệ", "Kho vận - Bốc xếp") → khớp luôn
  for (const g of LABOR_GROUPS[kind]) if (f.includes(fold(g)) && !out.includes(g)) out.push(g);
  return out.slice(0, 3);
}

export function detectShifts(text: string, kind: LaborKind): string[] {
  const f = fold(text);
  const out: string[] = [];
  if (/ca dem|lam dem/.test(f)) out.push('Ca đêm');
  if (/xoay ca|ca kip|ca luan phien/.test(f)) out.push('Xoay ca');
  if (/hanh chinh|gio hanh chinh|ca ngay/.test(f)) out.push('Hành chính');
  if (/cuoi tuan|\bt7\b|thu 7|chu nhat|\bcn\b/.test(f)) out.push('Cuối tuần');
  if (/linh hoat|theo gio|part.?time|ban thoi gian|ca toi|ca sang|ca chieu/.test(f)) out.push('Theo giờ linh hoạt');
  return out.filter((s) => SHIFTS_BY_KIND[kind].includes(s));
}

export function detectExperience(text: string): 'none' | 'lt1' | 'gte1' | null {
  const f = fold(text);
  if (/chua (co|tung|di lam)|khong (co )?kinh nghiem|chua kinh nghiem|moi ra truong|chua lam/.test(f)) return 'none';
  const y = f.match(/(\d+)\s*nam\s*(kinh nghiem|lam)|kinh nghiem\s*(\d+)\s*nam|(\d+)\s*nam\s*kn/);
  if (y) return Number(y[1] ?? y[3] ?? y[4]) >= 1 ? 'gte1' : 'lt1';
  if (/duoi 1 nam|vai thang|\d+\s*thang kinh nghiem/.test(f)) return 'lt1';
  if (/co kinh nghiem|da (tung )?lam|kinh nghiem/.test(f)) return 'lt1';
  return null;
}

function detectGender(text: string, label?: string | null): 'male' | 'female' | 'other' | null {
  const l = fold(label ?? '').trim();
  if (l) {
    if (/^(nu|female|f)$/.test(l)) return 'female';
    if (/^(nam|male|m)$/.test(l)) return 'male';
  }
  const f = fold(text)
    .replace(/(sinh\s*)?nam\s*(sinh\s*)?[:\-]?\s*\d+/g, ' ')
    .replace(/nam\s*(thu|hoc|nhat|hai|ba|tu|cuoi)\b/g, ' ');
  const lab = f.match(/gioi tinh\s*[:\-]?\s*(nam|nu)\b/);
  if (lab) return lab[1] === 'nu' ? 'female' : 'male';
  const fe = (f.match(/\b(nu|chi|em gai|con gai)\b/g) ?? []).length;
  const ma = (f.match(/\b(nam|anh|em trai|con trai)\b/g) ?? []).length;
  if (fe > ma) return 'female';
  if (ma > fe) return 'male';
  return null;
}

function detectBirth(text: string): { year: number | null; date: string | null } {
  const thisYear = new Date().getFullYear();
  const okYear = (y: number) => y >= thisYear - 70 && y <= thisYear - 15;
  const full = text.match(/(?:sinh|ns|sn|birth)[^\d\n]{0,15}(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/i) ?? text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.]((?:19|20)\d{2})\b/);
  if (full) {
    const d = Number(full[1]);
    const m = Number(full[2]);
    const y = Number(full[3]);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && okYear(y)) return { year: y, date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
  }
  const yr = text.match(/(?:sinh\s*năm|năm\s*sinh|\bsn\b|\bns\b|\bsinh\b)[^\d\n]{0,10}((?:19|20)\d{2}|\d{2})\b/i);
  if (yr) {
    let y = Number(yr[1]);
    if (y < 100) y += y > (thisYear % 100) - 12 ? 1900 : 2000;
    if (okYear(y)) return { year: y, date: null };
  }
  const lone = text.match(/(?:^|[,;|\n])\s*((?:19[5-9]\d|20[01]\d))\s*(?:$|[,;|\n])/);
  if (lone && okYear(Number(lone[1]))) return { year: Number(lone[1]), date: null };
  const age = text.match(/(\d{2})\s*tuổi/i);
  if (age) {
    const a = Number(age[1]);
    if (a >= 15 && a <= 70) return { year: thisYear - a, date: null };
  }
  return { year: null, date: null };
}

function titleCase(s: string) {
  return s.toLowerCase().split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

function detectName(text: string): string | null {
  const t = text.replace(/\r/g, '');
  const lab = t.match(/(?:họ\s*(?:và)?\s*tên|em\s*tên\s*là|mình\s*tên\s*là|tôi\s*tên\s*là|\btên\s*là|\btên)\s*[:\-–]?\s*([^\n,;|:\d()]{2,45})/i);
  const clean = (s: string) => s.replace(/\s+(sinh|sdt|sđt|zalo|tuổi|nam|nữ|giới|năm|ở|quê|đang|muốn|cần|tìm)\b.*$/i, '').replace(/\s+/g, ' ').trim();
  if (lab) {
    const n = clean(lab[1]);
    if (n.length >= 2) return titleCase(n);
  }
  const hon = t.match(/(?:^|[\s,.;:])(?:Anh|Chị|Em|Cô|Chú|Bác|anh|chị|em|cô|chú|bác)\s+([A-ZÀ-Ỵ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỵ][a-zà-ỹ]+){0,4})(?=\s*[,.;\d(\n]|\s+\d|\s+(?:sinh|ở|quê|tìm|muốn|cần|đang)\b)/);
  if (hon) {
    const fn = fold(hon[1]);
    if (!guessProvince(hon[1]) && !/^(thanh pho|quan|huyen|thi xa)/.test(fn)) return titleCase(hon[1].trim());
  }
  const cand = t.matchAll(/(?:^|[\s,.;:])(?:anh|chị|em|cô|chú|bác|mình|tôi)?\s*((?:[A-ZÀ-Ỵ][a-zà-ỹ]+\s+){1,4}[A-ZÀ-Ỵ][a-zà-ỹ]+)(?=\s*[,.;\d(\n]|\s+\d)/g);
  for (const m of cand) {
    const n = m[1].trim();
    const fn = fold(n);
    if (guessProvince(n) || /^(thanh pho|quan|huyen|thi xa|cong nhan|tim viec|sinh vien|dai hoc|cong ty|viet nam|lao dong|kinh nghiem|xin chao|gia dinh)/.test(fn)) continue;
    return titleCase(n);
  }
  const first = t.split('\n').map((x) => x.trim()).find((x) => x.length > 0);
  if (first && /^[A-ZÀ-Ỵa-zà-ỹ ]{4,40}$/.test(first)) {
    const w = first.split(/\s+/).length;
    if (w >= 2 && w <= 5 && !/tìm|cần|việc|tuyển|làm|công nhân|xin/i.test(first)) return titleCase(first);
  }
  return null;
}

const DISTRICT_PREFIX = /^(quận|huyện|thành phố|thị xã|thị trấn|tp\.?)\s+/i;
export function detectDistrict(text: string, province: string | null): string | null {
  if (!province) return null;
  const f = fold(text);
  let best: { d: string; len: number } | null = null;
  for (const d of oldDistricts(province)) {
    const bare = fold(d.replace(DISTRICT_PREFIX, ''));
    if (/^\d+$/.test(bare)) {
      if (new RegExp(`(quan|q\\.?)\\s*${bare}\\b`).test(f) && (!best || best.len < 3)) best = { d, len: 3 };
      continue;
    }
    if (bare.length < 3) continue;
    if (new RegExp(`(^|[^a-z0-9])${bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(f) && (!best || bare.length > best.len)) best = { d, len: bare.length };
  }
  return best?.d ?? null;
}

export interface WorkerFields {
  name?: string | null;
  phone?: string | null;
  birth?: string | null;
  gender?: string | null;
  province?: string | null;
  district?: string | null;
  jobs?: string | null;
  shifts?: string | null;
  kind?: string | null;
  exp?: string | null;
  note?: string | null;
  housing?: string | null;
}

const yes = (v?: string | null) => !!v && /^(1|x|co|yes|y|true|can|ok)$/.test(fold(v).replace(/\s+/g, ''));
const kindOfLabel = (v: string): LaborKind | null => {
  const f = fold(v);
  if (/thuc tap|tts|intern/.test(f)) return 'intern';
  if (/sinh vien|^sv|part|ban thoi gian/.test(f)) return 'student';
  if (/cong nhan|lao dong|pho thong|worker/.test(f)) return 'worker';
  return null;
};

/** Tách từ các ô đã biết loại (bảng) — phần còn thiếu tự đoán thêm từ văn bản tự do. */
export function parseFields(f: WorkerFields, fullText?: string): ParsedWorker {
  const free = fullText ?? '';
  const all = [free, f.name, f.birth, f.gender, f.province, f.district, f.jobs, f.shifts, f.kind, f.exp, f.note, f.housing].filter(Boolean).join('\n');
  const kind: LaborKind = (f.kind && kindOfLabel(f.kind)) || detectKind(all);
  const phone = toPhone(f.phone) ?? toPhone(free) ?? null;
  const fullName = f.name ? titleCase(String(f.name).replace(/\s+/g, ' ').trim().slice(0, 120)) : detectName(free);
  let birth = f.birth ? detectBirth(`sinh ${f.birth}`) : { year: null as number | null, date: null as string | null };
  if (!birth.year && f.birth && /^\s*(\d{4}|\d{2})\s*$/.test(f.birth)) {
    let y = Number(f.birth);
    const ty = new Date().getFullYear();
    if (y < 100) y += y > (ty % 100) - 12 ? 1900 : 2000;
    if (y >= ty - 70 && y <= ty - 15) birth = { year: y, date: null };
  }
  if (!birth.year) birth = detectBirth(free);
  const province = (f.province ? guessProvince(f.province) : null) ?? (f.district ? guessProvince(f.district) : null) ?? guessProvince(free);
  const oldDistrict = detectDistrict(`${f.district ?? ''}\n${f.province ?? ''}\n${free}`, province);
  let desired = detectGroups(f.jobs ?? '', kind);
  if (!desired.length) desired = detectGroups(`${free}\n${f.note ?? ''}`, kind);
  const fa = fold(all);
  if (!desired.length && /cong nhan|lao dong pho thong|lam gi cung|viec gi cung|viec nhe|lao dong/.test(fa)) desired = [DEFAULT_GROUP[kind]];
  const shifts = Array.from(new Set([...detectShifts(f.shifts ?? '', kind), ...detectShifts(`${free}\n${f.note ?? ''}`, kind)]));
  const exp = f.exp ? detectExperience(f.exp) ?? (/^\s*\d+\s*$/.test(f.exp) ? (Number(f.exp) >= 1 ? 'gte1' : 'none') : null) : detectExperience(`${free}\n${f.note ?? ''}`);
  const needsHousing = yes(f.housing) || /\bktx\b|ky tuc|can cho o|can o\b|co cho o|nha tro/.test(fa);
  const needsShuttle = /xe dua don|xe don|co xe|xe cong ty|xe buyt cong ty/.test(fa);
  const missing: string[] = [];
  if (!fullName) missing.push('họ tên');
  if (!phone) missing.push('số điện thoại');
  if (!province) missing.push('tỉnh/thành');
  if (!desired.length) missing.push('việc muốn làm');
  return {
    fullName,
    phone,
    birthYear: birth.year,
    birthDate: birth.date,
    gender: (f.gender ? detectGender('', f.gender) : null) ?? detectGender(fullName ? free.replace(new RegExp(fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ') : free, null),
    province,
    oldDistrict,
    kind,
    desiredJobs: desired,
    shifts,
    experience: exp,
    needsHousing,
    needsShuttle,
    note: f.note ? String(f.note).slice(0, 500) : null,
    missing,
  };
}

/** Bài đăng tự do (Zalo/Facebook): "Em tên Lan, 25 tuổi, ở Thủ Đức, SĐT 090…, muốn làm công nhân may ca hành chính…" */
export function parseWorkerPost(text: string): ParsedWorker {
  return parseFields({}, String(text ?? '').slice(0, 4000));
}

// ---------- bảng dán (Excel / CSV / Tab) ----------
const HEADER_MAP: [keyof WorkerFields, RegExp][] = [
  ['phone', /^(sdt|so dt|so dien thoai|dien thoai|phone|tel|zalo|so zalo|lien he|mobile)/],
  ['name', /^(ho ten|ho va ten|ten|name|nguoi lao dong|ung vien|full ?name)/],
  ['birth', /^(ngay sinh|nam sinh|sinh|ns$|sn$|birth)/],
  ['gender', /^(gioi tinh|gioi|gt$|sex|gender)/],
  ['district', /^(quan|huyen|quan\/huyen|district)/],
  ['province', /^(tinh|thanh pho|tinh\/tp|tinh thanh|noi o|noi cu tru|khu vuc|dia chi|que quan|city|province)/],
  ['kind', /^(doi tuong|loai|nhom lao dong|kind|phan loai)/],
  ['jobs', /^(viec|cong viec|nganh|nhom viec|nghe|nguyen vong|mong muon|job|vi tri)/],
  ['shifts', /^(ca|ca lam|gio lam|lich)/],
  ['exp', /^(kinh nghiem|kn$|exp)/],
  ['housing', /^(ktx|cho o|can o|ky tuc)/],
  ['note', /^(ghi chu|note|luu y|mo ta)/],
];

export function splitRows(text: string): string[][] {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const sample = lines.slice(0, 5).join('\n');
  const semi = (sample.match(/;/g) ?? []).length;
  const comma = (sample.match(/,/g) ?? []).length;
  const delim = sample.includes('\t') ? '\t' : semi > 0 && semi >= comma ? ';' : sample.includes('|') && comma === 0 ? '|' : ',';
  return lines.map((l) => {
    if (delim !== ',' || !l.includes('"')) return l.split(delim).map((c) => c.trim());
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  });
}

export interface ParsedRow extends ParsedWorker {
  row: number;
  raw: string;
}

export function parseWorkerTable(text: string): { rows: ParsedRow[]; headerDetected: boolean; columns: Record<string, number> } {
  const cells = splitRows(text).slice(0, 501);
  if (!cells.length) return { rows: [], headerDetected: false, columns: {} };
  const head = cells[0].map((c) => fold(c).replace(/[^a-z0-9\/ ]/g, '').trim());
  const colOf: Partial<Record<keyof WorkerFields, number>> = {};
  head.forEach((h, i) => {
    for (const [k, re] of HEADER_MAP) {
      if (re.test(h) && colOf[k] === undefined) {
        colOf[k] = i;
        break;
      }
    }
  });
  const headerDetected = Object.keys(colOf).length >= 2 && !cells[0].some((c) => toPhone(c) && /^[\d\s.+\-()]+$/.test(c));
  const body = headerDetected ? cells.slice(1) : cells;
  const rows: ParsedRow[] = body.map((r, i) => {
    const f: WorkerFields = {};
    const used = new Set<number>();
    if (headerDetected) {
      for (const [k, idx] of Object.entries(colOf) as [keyof WorkerFields, number][]) {
        f[k] = r[idx] ?? null;
        used.add(idx);
      }
    }
    // ô chưa gán cột (bảng không có tiêu đề) → tự nhận từng ô
    r.forEach((c, idx) => {
      if (used.has(idx) || !c) return;
      if (!f.phone && /^[\d\s.+\-()]+$/.test(c) && toPhone(c)) f.phone = c;
      else if (!f.birth && /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}|(19|20)\d{2})$/.test(c.trim())) f.birth = c;
      else if (!f.gender && /^(nam|nữ|nu|male|female)$/i.test(c.trim())) f.gender = c;
      else if (!f.province && guessProvince(c)) f.province = c;
      else if (!f.name && /^[A-ZÀ-Ỵa-zà-ỹ ]{3,45}$/.test(c.trim()) && !detectGroups(c, 'worker').length) f.name = c;
      else f.note = [f.note, c].filter(Boolean).join(' · ');
    });
    const p = parseFields(f);
    return { ...p, row: i + 1 + (headerDetected ? 1 : 0), raw: r.join(' | ').slice(0, 300) };
  });
  const columns: Record<string, number> = {};
  for (const [k, v] of Object.entries(colOf)) columns[k] = v as number;
  return { rows: rows.filter((r) => r.phone || r.fullName), headerDetected, columns };
}
