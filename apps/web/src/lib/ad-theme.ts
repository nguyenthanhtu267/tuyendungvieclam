// Đợt 24 (29/09/2026) — "hiểu" câu mô tả nền banner của Admin và dựng nền bằng CSS/SVG (không cần ảnh, không tốn
// phí, không tải thêm gì): chọn BẢNG MÀU theo chủ đề (từ khoá), chọn HOẠ TIẾT theo tâm trạng, rồi TỰ TÍNH màu chữ
// và độ phủ tối/sáng sao cho chữ luôn đọc được (tương phản WCAG ≥ 4.5:1). Cùng mô tả + cùng "số mẫu" (seed) luôn
// ra cùng 1 nền; bấm "Tạo mẫu khác" = đổi seed → đổi hoạ tiết/góc chuyển màu/vị trí điểm sáng.

export type ThemeKey =
  | 'brand'
  | 'ocean'
  | 'tech'
  | 'sunset'
  | 'flash'
  | 'emerald'
  | 'health'
  | 'luxury'
  | 'tet'
  | 'berry'
  | 'sky'
  | 'sand';

interface ThemeDef {
  label: string;
  stops: [string, string, string];
  accent: string;
  keywords: string[];
  // Hoạ tiết hợp chủ đề (ưu tiên khi mô tả không nói rõ tâm trạng).
  patterns: PatternKey[];
}

export type PatternKey = 'none' | 'dots' | 'grid' | 'diagonal' | 'lines' | 'waves' | 'rings' | 'circles' | 'circuit';

export const PATTERN_LABELS: Record<PatternKey, string> = {
  none: 'trơn',
  dots: 'chấm bi',
  grid: 'lưới',
  diagonal: 'sọc chéo',
  lines: 'nét mảnh',
  waves: 'sóng',
  rings: 'vòng tròn đồng tâm',
  circles: 'hình tròn lớn',
  circuit: 'mạch điện tử',
};

export const THEMES: Record<ThemeKey, ThemeDef> = {
  brand: {
    label: 'Thương hiệu web (navy + cam)',
    stops: ['#0F2957', '#163B7A', '#2456A6'],
    accent: '#FF5A36',
    keywords: ['tuyen dung', 'viec lam', 'dang tin', 'nha tuyen dung', 'ung vien', 'ho so', 'cv'],
    patterns: ['dots', 'rings', 'diagonal'],
  },
  ocean: {
    label: 'Xanh tin cậy',
    stops: ['#0B3D91', '#1259B8', '#1E88E5'],
    accent: '#FFC53D',
    keywords: ['nhan su', 'hr', 'doanh nghiep', 'tin cay', 'chuyen nghiep', 'quan ly', 'cong ty', 'b2b', 'dich vu', 'giai phap', 'toan dien', 'cham cong', 'tinh luong'],
    patterns: ['rings', 'dots', 'lines'],
  },
  tech: {
    label: 'Công nghệ (tím than + xanh neon)',
    stops: ['#15103A', '#3730A3', '#0E7490'],
    accent: '#22D3EE',
    keywords: ['cong nghe', 'phan mem', 'ai', 'tri tue nhan tao', 'so hoa', 'chuyen doi so', 'du lieu', 'ung dung', 'app', 'it', 'lap trinh', 'saas', 'cloud', 'tu dong', 'hien dai', 'thong minh', 'online'],
    patterns: ['circuit', 'grid', 'dots'],
  },
  sunset: {
    label: 'Cam ưu đãi',
    stops: ['#B8330F', '#D9431C', '#EE6A2E'],
    accent: '#FFFFFF',
    keywords: ['uu dai', 'khuyen mai', 'qua tang', 'mien phi', 'dang ky ngay', 'hot', 'tang', 'free'],
    patterns: ['circles', 'diagonal', 'dots'],
  },
  flash: {
    label: 'Đỏ giảm giá',
    stops: ['#9F1239', '#DC2626', '#EA580C'],
    accent: '#FDE047',
    keywords: ['giam gia', 'sale', 'flash', 'xa kho', 'gio vang', 'black friday', 'thanh ly', 'chop nhoang', 'gap', 'khan cap', 'co han'],
    patterns: ['diagonal', 'circles'],
  },
  emerald: {
    label: 'Xanh lá tăng trưởng',
    stops: ['#064E3B', '#047857', '#0FA172'],
    accent: '#FDE047',
    keywords: ['giao duc', 'dao tao', 'khoa hoc', 'hoc', 'ky nang', 'phat trien', 'tang truong', 'moi truong', 'xanh', 'ben vung', 'nong nghiep', 'thien nhien', 'khoi nghiep'],
    patterns: ['waves', 'dots', 'circles'],
  },
  health: {
    label: 'Xanh ngọc sức khoẻ',
    stops: ['#0E4F5C', '#0E7490', '#0F9C8C'],
    accent: '#FFFFFF',
    keywords: ['suc khoe', 'y te', 'benh vien', 'bao hiem', 'phuc loi', 'cham soc', 'spa', 'the thao', 'gym', 'an toan', 'duoc'],
    patterns: ['waves', 'circles', 'dots'],
  },
  luxury: {
    label: 'Đen vàng sang trọng',
    stops: ['#0B0F19', '#1C2433', '#2E3A4F'],
    accent: '#D4AF37',
    keywords: ['sang trong', 'cao cap', 'premium', 'vip', 'tai chinh', 'ngan hang', 'dau tu', 'bat dong san', 'dang cap', 'doanh nhan', 'dieu hanh', 'giam doc'],
    patterns: ['lines', 'rings', 'none'],
  },
  tet: {
    label: 'Đỏ vàng lễ hội',
    stops: ['#7F1D1D', '#B91C1C', '#D42A2A'],
    accent: '#FACC15',
    keywords: ['tet nguyen dan', 'nguyen dan', 'tet am lich', 'tet', 'le hoi', 'nam moi', 'trung thu', 'giang sinh', 'noel', 'ky niem', 'su kien', 'chuc mung', 'mung', 'xuan'],
    patterns: ['circles', 'rings', 'dots'],
  },
  berry: {
    label: 'Hồng tím trẻ trung',
    stops: ['#5B21B6', '#A21CAF', '#DB2777'],
    accent: '#FDE68A',
    keywords: ['tre trung', 'nang dong', 'gen z', 'sinh vien', 'thuc tap', 'sang tao', 'thoi trang', 'my pham', 'lam dep', 'giai tri', 'am nhac', 'vui', 'tre'],
    patterns: ['circles', 'diagonal', 'waves'],
  },
  sky: {
    label: 'Xanh nhạt tối giản (nền sáng)',
    stops: ['#EEF5FF', '#DCEBFF', '#C9DEFA'],
    accent: '#163B7A',
    keywords: ['toi gian', 'nhe nhang', 'thanh lich', 'sach se', 'minimal', 'don gian', 'nen sang', 'trang'],
    patterns: ['lines', 'none', 'rings'],
  },
  sand: {
    label: 'Vàng cát ấm (nền sáng)',
    stops: ['#FFF6DC', '#FDE9B0', '#F8D98A'],
    accent: '#9A3412',
    keywords: ['am thuc', 'du lich', 'nghi duong', 'am ap', 'gan gui', 'cafe', 'nha hang', 'khach san', 'mua he', 'bien'],
    patterns: ['waves', 'dots', 'circles'],
  },
};

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];

// Tâm trạng → hoạ tiết (ghi đè gợi ý của chủ đề khi mô tả nói rõ).
const MOODS: { keywords: string[]; patterns: PatternKey[]; label: string }[] = [
  { label: 'tối giản', keywords: ['toi gian', 'minimal', 'don gian', 'thanh lich', 'tinh te', 'nhe nhang'], patterns: ['none', 'lines', 'rings'] },
  { label: 'công nghệ', keywords: ['cong nghe', 'so hoa', 'du lieu', 'ai', 'phan mem', 'thong minh'], patterns: ['circuit', 'grid', 'dots'] },
  { label: 'năng động', keywords: ['nang dong', 'soi dong', 'manh me', 'toc do', 'sale', 'khuyen mai', 'hot', 'bung no'], patterns: ['diagonal', 'circles'] },
  { label: 'mềm mại', keywords: ['mem mai', 'tu nhien', 'thien nhien', 'xanh', 'suc khoe', 'thu gian', 'bien'], patterns: ['waves', 'circles'] },
  { label: 'sang trọng', keywords: ['sang trong', 'cao cap', 'premium', 'dang cap'], patterns: ['lines', 'rings'] },
];

export function normalizeVi(s: string): string {
  return ` ${s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ màu & tương phản
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function lum([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a: string | [number, number, number], b: string | [number, number, number]): number {
  const la = lum(typeof a === 'string' ? rgb(a) : a);
  const lb = lum(typeof b === 'string' ? rgb(b) : b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function mix(c: [number, number, number], over: [number, number, number], a: number): [number, number, number] {
  return [0, 1, 2].map((i) => Math.round(c[i] * (1 - a) + over[i] * a)) as [number, number, number];
}

const WHITE = '#FFFFFF';
const INK = '#0F172A';

// Chọn màu chữ (trắng/tối) + độ phủ nhỏ nhất để MỌI điểm màu nền đạt ≥ 4.5:1 với chữ.
// Tính cả chỗ nền bị "điểm sáng" màu nhấn phủ lên (GLOW_ALPHA) để không có góc nào chữ bị chìm.
const GLOW_ALPHA = { light: 0.2, dark: 0.12 };
function solveInk(stops: string[], accent: string, force: 'auto' | 'light' | 'dark') {
  const minC = (ink: string, a: number) => {
    const over: [number, number, number] = ink === WHITE ? [0, 0, 0] : [255, 255, 255];
    const g = ink === WHITE ? GLOW_ALPHA.light : GLOW_ALPHA.dark;
    const samples = stops.flatMap((s) => [rgb(s), mix(rgb(s), rgb(accent), g)]);
    return Math.min(...samples.map((c) => contrast(ink, mix(c, over, a))));
  };
  // Tự động: nền đậm/tươi (độ sáng TB < 0.45) ưu tiên chữ trắng nếu chỉ cần phủ ≤ 45% — chữ trắng trên nền
  // màu nhìn "ra chất quảng cáo" hơn là phủ trắng làm nền bị bạc.
  if (force === 'auto') {
    const avg = stops.reduce((t, s) => t + lum(rgb(s)), 0) / stops.length;
    if (avg < 0.45) {
      for (let a = 0; a <= 0.4501; a += 0.05)
        if (minC(WHITE, a) >= 4.5) return { ink: WHITE, scrim: Math.round(a * 100) / 100 };
    }
  }
  const candidates = force === 'light' ? [WHITE] : force === 'dark' ? [INK] : [WHITE, INK];
  let best = { ink: candidates[0], scrim: 0.7 };
  let bestScore = -1;
  for (const ink of candidates) {
    for (let a = 0; a <= 0.7001; a += 0.05) {
      if (minC(ink, a) >= 4.5) {
        // Ưu tiên độ phủ nhỏ (giữ màu nền tươi); hoà thì chọn tương phản cao hơn.
        const score = 1 - a + minC(ink, a) / 100;
        if (score > bestScore) {
          bestScore = score;
          best = { ink, scrim: Math.round(a * 100) / 100 };
        }
        break;
      }
    }
  }
  return best;
}

// ------------------------------------------------------------------ hoạ tiết SVG
function svgUrl(svg: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function patternLayer(p: PatternKey, color: string, r: () => number): { image: string; size: string; position: string; repeat: string } | null {
  const o = (x: number) => x.toFixed(2);
  switch (p) {
    case 'dots': {
      const s = 16 + Math.round(r() * 10);
      return { image: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><circle cx="2" cy="2" r="1.5" fill="${color}" fill-opacity="${o(0.22 + r() * 0.1)}"/></svg>`), size: `${s}px ${s}px`, position: '0 0', repeat: 'repeat' };
    }
    case 'grid': {
      const s = 22 + Math.round(r() * 12);
      return { image: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><path d="M${s} 0H0V${s}" fill="none" stroke="${color}" stroke-opacity="0.13" stroke-width="1"/></svg>`), size: `${s}px ${s}px`, position: '0 0', repeat: 'repeat' };
    }
    case 'diagonal': {
      const s = 14 + Math.round(r() * 10);
      return { image: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><path d="M-2 ${s + 2}L${s + 2} -2" stroke="${color}" stroke-opacity="0.12" stroke-width="${o(3 + r() * 3)}"/></svg>`), size: `${s}px ${s}px`, position: '0 0', repeat: 'repeat' };
    }
    case 'lines': {
      const s = 9 + Math.round(r() * 6);
      return { image: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><path d="M0 ${s}L${s} 0" stroke="${color}" stroke-opacity="0.07" stroke-width="1"/></svg>`), size: `${s}px ${s}px`, position: '0 0', repeat: 'repeat' };
    }
    case 'waves': {
      const w = 120 + Math.round(r() * 60);
      const h = 34 + Math.round(r() * 16);
      const a = h / 2 - 4;
      return { image: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path d="M0 ${h / 2} C ${w / 4} ${h / 2 - a}, ${w / 4} ${h / 2 - a}, ${w / 2} ${h / 2} S ${(3 * w) / 4} ${h / 2 + a}, ${w} ${h / 2}" fill="none" stroke="${color}" stroke-opacity="0.16" stroke-width="2"/></svg>`), size: `${w}px ${h}px`, position: '0 0', repeat: 'repeat' };
    }
    case 'rings': {
      const n = 5 + Math.round(r() * 3);
      const rings = Array.from({ length: n }, (_, i) => `<circle cx="200" cy="200" r="${40 + i * 26}" fill="none" stroke="${color}" stroke-opacity="${o(0.16 - i * 0.012)}" stroke-width="1.5"/>`).join('');
      const x = 80 + Math.round(r() * 20);
      return { image: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">${rings}</svg>`), size: '420px 420px', position: `${x}% ${Math.round(r() * 100)}%`, repeat: 'no-repeat' };
    }
    case 'circles': {
      const cs = Array.from({ length: 3 }, () => `<circle cx="${Math.round(r() * 400)}" cy="${Math.round(r() * 200)}" r="${60 + Math.round(r() * 90)}" fill="${color}" fill-opacity="${o(0.07 + r() * 0.06)}"/>`).join('');
      return { image: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 200">${cs}</svg>`), size: 'cover', position: 'center', repeat: 'no-repeat' };
    }
    case 'circuit': {
      const s = 60;
      const y1 = 10 + Math.round(r() * 20);
      const x1 = 20 + Math.round(r() * 20);
      return { image: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><g fill="none" stroke="${color}" stroke-opacity="0.16" stroke-width="1.2"><path d="M0 ${y1}H${x1}V${s - 10}H${s}"/><path d="M${x1 + 14} 0V${y1 - 4}"/></g><g fill="${color}" fill-opacity="0.3"><circle cx="${x1}" cy="${y1}" r="2.2"/><circle cx="${x1}" cy="${s - 10}" r="2.2"/><circle cx="${x1 + 14}" cy="${y1 - 4}" r="1.8"/></g></svg>`), size: `${s}px ${s}px`, position: '0 0', repeat: 'repeat' };
    }
    default:
      return null;
  }
}

// ------------------------------------------------------------------ phân tích mô tả
export interface PromptAnalysis {
  theme: ThemeKey;
  themeMatched: string[];
  mood: string | null;
  patterns: PatternKey[];
}

export function analyzePrompt(prompt: string): PromptAnalysis {
  const text = normalizeVi(prompt || '');
  let theme: ThemeKey | null = null;
  let matched: string[] = [];
  let best = 0;
  for (const k of THEME_KEYS) {
    const hits = THEMES[k].keywords.filter((kw) => text.includes(` ${kw} `));
    // Từ khoá nhiều chữ ("phan mem") nặng hơn từ khoá 1 chữ ("it").
    const score = hits.reduce((s, kw) => s + kw.split(' ').length, 0);
    if (score > best) {
      best = score;
      theme = k;
      // Bỏ từ khoá nằm trong từ khoá dài hơn đã khớp ("tet" trong "tet nguyen dan") cho phần giải thích gọn.
      matched = hits.filter((h) => !hits.some((o) => o !== h && o.includes(h)));
    }
  }
  if (!theme) {
    // Không nhận ra chủ đề → chọn ổn định theo nội dung mô tả (mô tả khác → màu khác), rỗng = màu thương hiệu.
    theme = text.trim() ? THEME_KEYS[hash(text) % THEME_KEYS.length] : 'brand';
  }
  const mood = MOODS.find((m) => m.keywords.some((kw) => text.includes(` ${kw} `))) ?? null;
  return { theme, themeMatched: matched, mood: mood?.label ?? null, patterns: mood?.patterns ?? THEMES[theme].patterns };
}

// ------------------------------------------------------------------ dựng nền
export interface AdLook {
  theme: ThemeKey;
  pattern: PatternKey;
  background: string;
  ink: string;
  inkMuted: string;
  ctaBg: string;
  ctaFg: string;
  eyebrowBg: string;
  eyebrowFg: string;
  tagBg: string;
  scrim: number;
  explain: string;
}

export interface LookInput {
  bgMode: 'generated' | 'image';
  bgPrompt: string;
  bgTheme?: string | null;
  bgSeed: number;
  bgImageUrl?: string | null;
  bgImageTone?: 'light' | 'dark' | null;
  textColor: 'auto' | 'light' | 'dark';
}

function ctaColors(accent: string, stops: string[]) {
  // Nút bấm = màu nhấn; chữ trên nút lấy màu nào tương phản tốt nhất (trắng / tối / màu nền đậm nhất).
  const options = [WHITE, INK, stops[0]];
  const fg = options.reduce((a, b) => (contrast(accent, b) > contrast(accent, a) ? b : a));
  return { ctaBg: accent, ctaFg: fg };
}

export function buildLook(input: LookInput, apiBase = ''): AdLook {
  const r = rng(hash(`${normalizeVi(input.bgPrompt)}#${input.bgSeed}`));

  if (input.bgMode === 'image' && input.bgImageUrl) {
    const tone = input.bgImageTone ?? 'dark';
    const wantLight = input.textColor === 'light' || (input.textColor === 'auto' && tone === 'dark');
    const ink = wantLight ? WHITE : INK;
    // Ảnh: phủ lớp chuyển màu đậm ở phía chữ (trái) nhạt dần sang phải để ảnh vẫn rõ.
    const base = wantLight ? '0,0,0' : '255,255,255';
    const strong = wantLight ? (tone === 'dark' ? 0.55 : 0.7) : tone === 'light' ? 0.55 : 0.75;
    const bg = `linear-gradient(90deg, rgba(${base},${strong}) 0%, rgba(${base},${(strong * 0.75).toFixed(2)}) 45%, rgba(${base},${(strong * 0.25).toFixed(2)}) 100%), url("${/^(blob:|data:|https?:)/.test(input.bgImageUrl) ? '' : apiBase}${input.bgImageUrl}") center / cover no-repeat`;
    return {
      theme: 'brand',
      pattern: 'none',
      background: bg,
      ink,
      inkMuted: wantLight ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.78)',
      ctaBg: wantLight ? '#FF5A36' : '#163B7A',
      ctaFg: WHITE,
      eyebrowBg: wantLight ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.08)',
      eyebrowFg: ink,
      tagBg: wantLight ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.7)',
      scrim: strong,
      explain: `Ảnh ${tone === 'light' ? 'sáng' : 'tối'} → chữ ${wantLight ? 'trắng' : 'tối'} + lớp phủ ${Math.round(strong * 100)}% phía chữ.`,
    };
  }

  const a = analyzePrompt(input.bgPrompt);
  const theme: ThemeKey = input.bgTheme && input.bgTheme in THEMES ? (input.bgTheme as ThemeKey) : a.theme;
  const def = THEMES[theme];
  const pattern = a.patterns[Math.floor(r() * a.patterns.length)] ?? 'none';
  const angle = [100, 115, 125, 135, 150, 160][Math.floor(r() * 6)];
  const solved = solveInk(def.stops, def.accent, input.textColor);
  const isLightInk = solved.ink === WHITE;
  const patternColor = isLightInk ? '#FFFFFF' : '#0F2957';
  const layers: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  const repeats: string[] = [];
  if (solved.scrim > 0) {
    const over = isLightInk ? '0,0,0' : '255,255,255';
    layers.push(`linear-gradient(90deg, rgba(${over},${solved.scrim}) 0%, rgba(${over},${solved.scrim}) 55%, rgba(${over},${(solved.scrim * 0.6).toFixed(2)}) 100%)`);
    sizes.push('auto');
    positions.push('0 0');
    repeats.push('no-repeat');
  }
  const pl = patternLayer(pattern, patternColor, r);
  if (pl) {
    layers.push(pl.image);
    sizes.push(pl.size);
    positions.push(pl.position);
    repeats.push(pl.repeat);
  }
  // Điểm sáng màu nhấn (mềm) ở vị trí ngẫu nhiên phía phải — tạo chiều sâu.
  const gx = 60 + Math.round(r() * 35);
  const gy = Math.round(r() * 100);
  layers.push(`radial-gradient(circle at ${gx}% ${gy}%, ${def.accent}${isLightInk ? '33' : '1F'} 0%, transparent 55%)`);
  sizes.push('auto');
  positions.push('0 0');
  repeats.push('no-repeat');
  layers.push(`linear-gradient(${angle}deg, ${def.stops[0]} 0%, ${def.stops[1]} 55%, ${def.stops[2]} 100%)`);
  sizes.push('auto');
  positions.push('0 0');
  repeats.push('no-repeat');

  const background = layers
    .map((l, i) => `${l} ${positions[i]} / ${sizes[i]} ${repeats[i]}`)
    .join(', ');
  const cta = ctaColors(def.accent, def.stops);
  const why = a.themeMatched.length
    ? `nhận ra “${a.themeMatched.slice(0, 3).join('”, “')}”`
    : input.bgTheme
      ? 'bảng màu chọn tay'
      : input.bgPrompt.trim()
        ? 'không rõ chủ đề — chọn theo nội dung mô tả'
        : 'chưa có mô tả — dùng màu thương hiệu';
  return {
    theme,
    pattern,
    background,
    ink: solved.ink,
    inkMuted: isLightInk ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.74)',
    ...cta,
    eyebrowBg: isLightInk ? 'rgba(255,255,255,0.16)' : 'rgba(15,41,87,0.08)',
    eyebrowFg: isLightInk ? '#FFFFFF' : '#0F2957',
    tagBg: isLightInk ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.65)',
    scrim: solved.scrim,
    explain: `Bảng màu “${def.label}” (${why}) · hoạ tiết ${PATTERN_LABELS[pattern]}${a.mood ? ` (tâm trạng ${a.mood})` : ''} · chữ ${isLightInk ? 'trắng' : 'tối'}${solved.scrim ? `, phủ ${Math.round(solved.scrim * 100)}% để đủ tương phản` : ''}.`,
  };
}
