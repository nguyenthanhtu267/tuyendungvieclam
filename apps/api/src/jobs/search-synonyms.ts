// Đợt 75 — Tìm kiếm hiểu từ đồng nghĩa (Việt ↔ Anh, có dấu ↔ không dấu) và gợi ý "Ý bạn là…".
// Thuần quy tắc: từ điển nhóm từ tương đương + khoảng cách chỉnh sửa trên từ vựng chức danh thật.

// Mỗi nhóm: các cách gọi cùng 1 nghề/vị trí. Gõ 1 từ thì tìm cả nhóm.
const GROUPS: string[][] = [
  ['kế toán', 'ke toan', 'accountant', 'accounting'],
  ['kiểm toán', 'kiem toan', 'auditor', 'audit'],
  ['bán hàng', 'ban hang', 'sales', 'sale'],
  ['kinh doanh', 'kinh doanh', 'business development', 'bd'],
  ['nhân sự', 'nhan su', 'hr', 'human resources', 'hành chính nhân sự'],
  ['tuyển dụng', 'tuyen dung', 'recruiter', 'recruitment', 'talent acquisition'],
  ['lập trình viên', 'lap trinh vien', 'developer', 'programmer', 'software engineer', 'kỹ sư phần mềm'],
  ['phần mềm', 'phan mem', 'software'],
  ['kiểm thử', 'kiem thu', 'tester', 'qa', 'qc', 'quality assurance'],
  ['thiết kế', 'thiet ke', 'designer', 'design'],
  ['đồ họa', 'đồ hoạ', 'do hoa', 'graphic'],
  ['chăm sóc khách hàng', 'cham soc khach hang', 'cskh', 'customer service', 'customer care', 'support'],
  ['tổng đài', 'tong dai', 'call center', 'telesales'],
  ['marketing', 'tiếp thị', 'tiep thi'],
  ['truyền thông', 'truyen thong', 'pr', 'communications'],
  ['biên phiên dịch', 'bien phien dich', 'phiên dịch', 'biên dịch', 'translator', 'interpreter'],
  ['thư ký', 'thu ky', 'secretary', 'assistant', 'trợ lý', 'tro ly'],
  ['giám đốc', 'giam doc', 'director', 'ceo'],
  ['quản lý', 'quan ly', 'manager', 'trưởng phòng', 'truong phong'],
  ['giám sát', 'giam sat', 'supervisor'],
  ['kho', 'thủ kho', 'thu kho', 'warehouse', 'storekeeper'],
  ['vận chuyển', 'van chuyen', 'logistics', 'giao hàng', 'giao hang', 'shipper', 'delivery'],
  ['tài xế', 'tai xe', 'lái xe', 'lai xe', 'driver'],
  ['bảo vệ', 'bao ve', 'security', 'an ninh'],
  ['thu ngân', 'thu ngan', 'cashier'],
  ['phục vụ', 'phuc vu', 'waiter', 'waitress', 'server'],
  ['đầu bếp', 'dau bep', 'bếp', 'chef', 'cook'],
  ['kỹ sư', 'ky su', 'engineer'],
  ['cơ khí', 'co khi', 'mechanical'],
  ['điện', 'dien', 'electrical'],
  ['xây dựng', 'xay dung', 'construction', 'civil'],
  ['dự toán', 'du toan', 'quantity surveyor', 'qs'],
  ['giáo viên', 'giao vien', 'teacher', 'giảng viên', 'giang vien', 'lecturer'],
  ['dược sĩ', 'duoc si', 'pharmacist'],
  ['điều dưỡng', 'dieu duong', 'nurse'],
  ['tư vấn', 'tu van', 'consultant', 'advisor'],
  ['pháp chế', 'phap che', 'legal', 'luật sư', 'luat su', 'lawyer'],
  ['phân tích dữ liệu', 'phan tich du lieu', 'data analyst', 'data analysis'],
  ['thực tập', 'thuc tap', 'intern', 'internship', 'thực tập sinh'],
  ['xuất nhập khẩu', 'xuat nhap khau', 'import export', 'xnk'],
  ['mua hàng', 'mua hang', 'thu mua', 'purchasing', 'procurement', 'buyer'],
  ['thương mại điện tử', 'thuong mai dien tu', 'ecommerce', 'e-commerce', 'tmđt'],
];

export function foldText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordIn(hay: string, needle: string): boolean {
  return new RegExp(`(^| )${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(hay);
}

// Trả về danh sách cụm cần tìm (luôn có cụm gốc đứng đầu). Tối đa 8 cụm để truy vấn không phình.
// Đợt 78 — viết tắt chức danh phổ biến ↔ dạng đầy đủ (chuẩn hoá chức danh khi tìm kiếm).
const ABBR: [string, string][] = [
  ['nv', 'nhân viên'], ['kd', 'kinh doanh'], ['tp', 'trưởng phòng'], ['gđ', 'giám đốc'], ['pgđ', 'phó giám đốc'],
  ['hcns', 'hành chính nhân sự'], ['cskh', 'chăm sóc khách hàng'], ['bđs', 'bất động sản'], ['qlcl', 'quản lý chất lượng'],
  ['tgđ', 'tổng giám đốc'], ['gv', 'giáo viên'], ['kcs', 'kiểm tra chất lượng'], ['ktv', 'kỹ thuật viên'], ['lái xe', 'tài xế'],
];

function abbrVariants(q: string): string[] {
  const out: string[] = [];
  const words = q.trim().toLowerCase().split(/\s+/);
  if (words.length > 6) return out;
  const expandedWords = words.map((w) => ABBR.find(([a]) => foldText(a) === foldText(w) && a !== 'lái xe')?.[1] ?? w);
  const expanded = expandedWords.join(' ');
  if (expanded !== words.join(' ')) out.push(expanded);
  let shortened = words.join(' ');
  for (const [a, full] of ABBR) {
    if (a === 'lái xe') continue;
    if (foldText(shortened).includes(foldText(full))) shortened = shortened.replace(new RegExp(full, 'i'), a);
  }
  if (shortened !== words.join(' ')) out.push(shortened);
  return out;
}

export function expandQuery(raw: string): string[] {
  const q = raw.trim();
  if (!q) return [];
  const out = new Set<string>([q]);
  const f = foldText(q);
  if (f.length < 2) return [q];
  for (const g of GROUPS) {
    const hit = g.find((t) => wordIn(f, foldText(t)));
    if (!hit) continue;
    // Chỉ thay đúng cụm khớp để giữ phần còn lại của truy vấn ("kế toán trưởng" → "accountant trưởng" là vô nghĩa,
    // nên chỉ mở rộng khi truy vấn CHÍNH LÀ cụm đó hoặc cụm đứng đầu/cuối một truy vấn ngắn ≤ 2 từ).
    if (f.split(' ').length > 2 && foldText(hit) !== f) continue;
    if (foldText(hit) === f) for (const t of g) if (foldText(t) === f) out.add(t);
    for (const t of g) {
      if (t.toLowerCase() === hit.toLowerCase()) continue;
      out.add(foldText(hit) === f ? t : q.replace(new RegExp(hit, 'i'), t));
    }
  }
  for (const v of abbrVariants(q)) out.add(v);
  return [...out].slice(0, 8);
}

function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export interface Vocab {
  // từ đã bỏ dấu → các dạng gốc (có dấu) kèm tần suất
  forms: Map<string, Map<string, number>>;
}

export function buildVocab(titles: string[]): Vocab {
  const forms = new Map<string, Map<string, number>>();
  for (const t of titles) {
    for (const w of t.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (w.length < 2) continue;
      const k = foldText(w);
      if (!k) continue;
      const m = forms.get(k) ?? new Map<string, number>();
      m.set(w, (m.get(w) ?? 0) + 1);
      forms.set(k, m);
    }
  }
  return { forms };
}

function bestForm(m: Map<string, number>): string {
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
function total(m: Map<string, number>): number {
  let n = 0;
  m.forEach((v) => (n += v));
  return n;
}

// "Ý bạn là": khôi phục dấu tiếng Việt (ke toan → kế toán) và sửa lỗi gõ sai ≤ 2 ký tự dựa trên từ vựng chức danh thật.
export function suggestQuery(raw: string, vocab: Vocab): string | null {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  // Cụm nằm trong nhóm đồng nghĩa → dùng đúng dạng chuẩn có dấu (nhan su → nhân sự), không đoán theo tần suất.
  const fr = foldText(raw.trim());
  for (const g of GROUPS)
    for (const t of g) {
      if (foldText(t) !== fr) continue;
      if (t.toLowerCase() === raw.trim().toLowerCase()) return null;
      const accented = g.find((x) => foldText(x) === fr && x !== foldText(x));
      if (accented && accented.toLowerCase() !== raw.trim().toLowerCase()) return accented;
    }
  let changed = false;
  const fixed = words.map((w) => {
    const k = foldText(w);
    if (k.length < 2) return w;
    const exact = vocab.forms.get(k);
    if (exact) {
      const b = bestForm(exact);
      // Người dùng đã gõ đúng 1 dạng có trong từ vựng → giữ nguyên; nếu gõ không dấu → đề xuất dạng có dấu phổ biến nhất.
      if (exact.has(w.toLowerCase())) return w;
      if (foldText(b) === k && b !== w.toLowerCase()) {
        changed = true;
        return b;
      }
      return w;
    }
    if (k.length < 4) return w;
    const max = k.length >= 7 ? 2 : 1;
    let best: { k: string; d: number; n: number } | null = null;
    vocab.forms.forEach((m, vk) => {
      if (vk.length < 3) return;
      const d = lev(k, vk, max);
      if (d > max) return;
      const n = total(m);
      if (!best || d < best.d || (d === best.d && n > best.n)) best = { k: vk, d, n };
    });
    if (best) {
      changed = true;
      return bestForm(vocab.forms.get((best as { k: string }).k)!);
    }
    return w;
  });
  return changed ? fixed.join(' ') : null;
}
