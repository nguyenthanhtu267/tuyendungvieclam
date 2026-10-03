// Đợt 153 — các nền vector mẫu cho ảnh chia sẻ tin tuyển dụng (1200×630). Mã p1..p8 trùng với API (admin/share-bg.service.ts).
// Mọi nền đều đủ tối để chữ trắng đọc rõ. Dùng cả cho ảnh chia sẻ (máy chủ) lẫn bản xem thử trong Admin.
const W = 1200;
const H = 630;
const wrap = (defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`;
const grad = (id: string, a: string, b: string, x2 = 1, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

const OLD: { id: string; name: string; svg: string }[] = [
  {
    id: 'p1',
    name: 'Xanh biển – sóng',
    svg: wrap(grad('g', '#10306F', '#1F63C4'), `<rect width="${W}" height="${H}" fill="url(#g)"/><path d="M0 470 C200 410 380 540 600 480 S1000 400 1200 460 V630 H0Z" fill="#fff" fill-opacity=".08"/><path d="M0 530 C220 480 420 590 640 540 S1020 470 1200 520 V630 H0Z" fill="#fff" fill-opacity=".09"/><circle cx="1040" cy="120" r="150" fill="#fff" fill-opacity=".06"/><circle cx="1110" cy="60" r="70" fill="#fff" fill-opacity=".07"/>`),
  },
  {
    id: 'p2',
    name: 'Xanh ngọc – vòng tròn',
    svg: wrap(grad('g', '#0B4A52', '#14919B'), `<rect width="${W}" height="${H}" fill="url(#g)"/><circle cx="1080" cy="520" r="260" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="28"/><circle cx="1080" cy="520" r="170" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="20"/><circle cx="120" cy="90" r="90" fill="#fff" fill-opacity=".07"/>`),
  },
  {
    id: 'p3',
    name: 'Tím – dải chéo',
    svg: wrap(grad('g', '#2B1B6B', '#5B3FC4'), `<rect width="${W}" height="${H}" fill="url(#g)"/><polygon points="760,0 960,0 560,630 360,630" fill="#fff" fill-opacity=".07"/><polygon points="1000,0 1200,0 1200,200 800,630 700,630" fill="#fff" fill-opacity=".06"/>`),
  },
  {
    id: 'p4',
    name: 'Cam đất – hoàng hôn',
    svg: wrap(grad('g', '#5B1F0F', '#C4511F'), `<rect width="${W}" height="${H}" fill="url(#g)"/><circle cx="1010" cy="470" r="190" fill="#FFB36B" fill-opacity=".22"/><circle cx="1010" cy="470" r="120" fill="#FFD39B" fill-opacity=".22"/><path d="M0 560 L220 450 L380 540 L620 400 L820 530 L1200 380 V630 H0Z" fill="#000" fill-opacity=".16"/>`),
  },
  {
    id: 'p5',
    name: 'Xanh lá – tán lá',
    svg: wrap(grad('g', '#0B4A3A', '#1E8F6B'), `<rect width="${W}" height="${H}" fill="url(#g)"/><ellipse cx="1080" cy="140" rx="190" ry="90" transform="rotate(-35 1080 140)" fill="#fff" fill-opacity=".09"/><ellipse cx="960" cy="260" rx="150" ry="70" transform="rotate(-20 960 260)" fill="#fff" fill-opacity=".07"/><ellipse cx="1110" cy="330" rx="130" ry="60" transform="rotate(-55 1110 330)" fill="#fff" fill-opacity=".07"/><ellipse cx="120" cy="560" rx="200" ry="80" transform="rotate(-20 120 560)" fill="#fff" fill-opacity=".06"/>`),
  },
  {
    id: 'p6',
    name: 'Xanh đêm – lưới',
    svg: wrap(`${grad('g', '#0B1220', '#1B2B52')}<radialGradient id="r" cx=".85" cy=".15" r=".6"><stop offset="0" stop-color="#4F8CFF" stop-opacity=".45"/><stop offset="1" stop-color="#4F8CFF" stop-opacity="0"/></radialGradient><pattern id="p" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="2"/></pattern>`, `<rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#p)"/><rect width="${W}" height="${H}" fill="url(#r)"/>`),
  },
  {
    id: 'p7',
    name: 'Hồng đậm – chấm bi',
    svg: wrap(`${grad('g', '#5E1040', '#BE2F6D')}<pattern id="p" width="44" height="44" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="3.5" fill="#fff" fill-opacity=".12"/></pattern>`, `<rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#p)"/><circle cx="1090" cy="110" r="130" fill="#fff" fill-opacity=".07"/>`),
  },
  {
    id: 'p8',
    name: 'Xám xanh – tam giác',
    svg: wrap(grad('g', '#1E2A3A', '#3B5775'), `<rect width="${W}" height="${H}" fill="url(#g)"/><polygon points="1200,0 1200,330 880,0" fill="#fff" fill-opacity=".07"/><polygon points="0,630 420,630 0,300" fill="#fff" fill-opacity=".06"/><polygon points="1200,630 940,630 1200,400" fill="#fff" fill-opacity=".08"/>`),
  },
];


// ---- Đợt 158 — khổ ảnh theo thiết bị + 10 nền tươi sáng vẽ theo tỉ lệ (dùng được cả ngang 1200×630 lẫn vuông 1080×1080) ----
export type SharePresetDef = { id: string; name: string; tone: 'dark' | 'light'; svg: (w: number, h: number) => string };
const svgBox = (w: number, h: number, defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;
const lg = (id: string, a: string, b: string, x2 = 1, y2 = 1) => grad(id, a, b, x2, y2);
const fit = (w: number, h: number) => ({ X: (f: number) => Math.round(w * f), Y: (f: number) => Math.round(h * f), R: Math.min(w, h) });

const NEW: SharePresetDef[] = [
  {
    id: 'p9', name: 'Bình minh – cam vàng', tone: 'light',
    svg: (w, h) => { const { X, Y, R } = fit(w, h); return svgBox(w, h, lg('g', '#FFE9A8', '#FFB27A'), `<rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${X(0.84)}" cy="${Y(0.26)}" r="${Math.round(R * 0.3)}" fill="#FFF6CF" fill-opacity=".55"/><circle cx="${X(0.84)}" cy="${Y(0.26)}" r="${Math.round(R * 0.19)}" fill="#FFF3B8" fill-opacity=".9"/><path d="M0 ${Y(0.78)} C${X(0.25)} ${Y(0.66)} ${X(0.5)} ${Y(0.9)} ${X(0.75)} ${Y(0.74)} S${X(0.95)} ${Y(0.7)} ${w} ${Y(0.76)} V${h} H0Z" fill="#FF9A5A" fill-opacity=".35"/><path d="M0 ${Y(0.9)} C${X(0.3)} ${Y(0.8)} ${X(0.6)} ${Y(1)} ${w} ${Y(0.86)} V${h} H0Z" fill="#FF7A59" fill-opacity=".3"/>`); },
  },
  {
    id: 'p10', name: 'Bạc hà – bong bóng', tone: 'light',
    svg: (w, h) => { const { X, Y, R } = fit(w, h); return svgBox(w, h, lg('g', '#DDFBEF', '#8FE3CB'), `<rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${X(0.9)}" cy="${Y(0.2)}" r="${Math.round(R * 0.26)}" fill="#fff" fill-opacity=".4"/><circle cx="${X(0.82)}" cy="${Y(0.78)}" r="${Math.round(R * 0.14)}" fill="#2BB59A" fill-opacity=".25"/><circle cx="${X(0.06)}" cy="${Y(0.88)}" r="${Math.round(R * 0.22)}" fill="#fff" fill-opacity=".35"/><circle cx="${X(0.52)}" cy="${Y(0.93)}" r="${Math.round(R * 0.07)}" fill="#2BB59A" fill-opacity=".22"/><circle cx="${X(0.96)}" cy="${Y(0.52)}" r="${Math.round(R * 0.05)}" fill="#fff" fill-opacity=".6"/>`); },
  },
  {
    id: 'p11', name: 'Hồng đào – sóng', tone: 'light',
    svg: (w, h) => { const { X, Y, R } = fit(w, h); return svgBox(w, h, lg('g', '#FFE3EA', '#FFC8AE'), `<rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${X(0.88)}" cy="${Y(0.22)}" r="${Math.round(R * 0.2)}" fill="#fff" fill-opacity=".45"/><path d="M0 ${Y(0.74)} C${X(0.2)} ${Y(0.64)} ${X(0.4)} ${Y(0.86)} ${X(0.62)} ${Y(0.74)} S${X(0.92)} ${Y(0.64)} ${w} ${Y(0.72)} V${h} H0Z" fill="#FF8FA3" fill-opacity=".28"/><path d="M0 ${Y(0.86)} C${X(0.25)} ${Y(0.78)} ${X(0.45)} ${Y(0.96)} ${X(0.7)} ${Y(0.86)} S${X(0.95)} ${Y(0.8)} ${w} ${Y(0.84)} V${h} H0Z" fill="#FFB199" fill-opacity=".4"/>`); },
  },
  {
    id: 'p12', name: 'Xanh trời – mây', tone: 'light',
    svg: (w, h) => { const { X, Y, R } = fit(w, h); const cloud = (cx: number, cy: number, s: number) => `<g fill="#fff" fill-opacity=".85"><ellipse cx="${cx}" cy="${cy}" rx="${s}" ry="${s * 0.42}"/><ellipse cx="${cx - s * 0.5}" cy="${cy + s * 0.12}" rx="${s * 0.55}" ry="${s * 0.34}"/><ellipse cx="${cx + s * 0.55}" cy="${cy + s * 0.1}" rx="${s * 0.6}" ry="${s * 0.36}"/></g>`; return svgBox(w, h, lg('g', '#CDEBFF', '#6DB8FF', 0, 1), `<rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${X(0.86)}" cy="${Y(0.2)}" r="${Math.round(R * 0.2)}" fill="#FFF4B8" fill-opacity=".85"/>${cloud(X(0.2), Y(0.2), R * 0.2)}${cloud(X(0.72), Y(0.86), R * 0.26)}${cloud(X(0.96), Y(0.5), R * 0.14)}`); },
  },
  {
    id: 'p13', name: 'Chanh – hình học', tone: 'light',
    svg: (w, h) => { const { X, Y, R } = fit(w, h); return svgBox(w, h, lg('g', '#F8FFB8', '#C2EE63'), `<rect width="${w}" height="${h}" fill="url(#g)"/><polygon points="${w},0 ${w},${Y(0.5)} ${X(0.78)},0" fill="#7BD13B" fill-opacity=".3"/><polygon points="0,${h} ${X(0.34)},${h} 0,${Y(0.6)}" fill="#FFE14D" fill-opacity=".6"/><circle cx="${X(0.9)}" cy="${Y(0.82)}" r="${Math.round(R * 0.13)}" fill="#fff" fill-opacity=".55"/><rect x="${X(0.55)}" y="${Y(0.84)}" width="${Math.round(R * 0.16)}" height="${Math.round(R * 0.16)}" rx="12" fill="#3DBE6F" fill-opacity=".25" transform="rotate(18 ${X(0.6)} ${Y(0.9)})"/>`); },
  },
  {
    id: 'p14', name: 'Lavender – chấm bi', tone: 'light',
    svg: (w, h) => { const { X, Y, R } = fit(w, h); return svgBox(w, h, `${lg('g', '#F0E6FF', '#BDA9FB')}<pattern id="d" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="3" fill="#7C5CE0" fill-opacity=".2"/></pattern>`, `<rect width="${w}" height="${h}" fill="url(#g)"/><rect width="${w}" height="${h}" fill="url(#d)"/><circle cx="${X(0.9)}" cy="${Y(0.2)}" r="${Math.round(R * 0.2)}" fill="#fff" fill-opacity=".45"/><circle cx="${X(0.08)}" cy="${Y(0.9)}" r="${Math.round(R * 0.16)}" fill="#7C5CE0" fill-opacity=".18"/>`); },
  },
  {
    id: 'p15', name: 'San hô – lá cây', tone: 'dark',
    svg: (w, h) => { const { X, Y, R } = fit(w, h); const leaf = (cx: number, cy: number, s: number, rot: number) => `<path d="M0 0 C${s * 0.5} ${-s * 0.5} ${s} ${-s * 0.1} ${s} 0 C${s} ${s * 0.1} ${s * 0.5} ${s * 0.5} 0 0Z" transform="translate(${cx} ${cy}) rotate(${rot})" fill="#fff" fill-opacity=".16"/>`; return svgBox(w, h, lg('g', '#FF8A5C', '#E23D6B'), `<rect width="${w}" height="${h}" fill="url(#g)"/>${leaf(X(0.9), Y(0.1), R * 0.5, 120)}${leaf(X(0.98), Y(0.35), R * 0.4, 150)}${leaf(X(0.04), Y(0.95), R * 0.5, -50)}${leaf(X(0.15), Y(1), R * 0.35, -80)}<circle cx="${X(0.8)}" cy="${Y(0.9)}" r="${Math.round(R * 0.1)}" fill="#FFD27A" fill-opacity=".35"/>`); },
  },
  {
    id: 'p16', name: 'Xanh dương – tia sáng', tone: 'dark',
    svg: (w, h) => { const { X, Y } = fit(w, h); const cx = X(0.9), cy = Y(0.05); let rays = ''; for (let i = 0; i < 9; i++) { const a1 = 100 + i * 10, a2 = a1 + 4; const L = Math.max(w, h) * 1.4; const p = (a: number) => `${Math.round(cx + L * Math.cos((a * Math.PI) / 180))},${Math.round(cy + L * Math.sin((a * Math.PI) / 180))}`; rays += `<polygon points="${cx},${cy} ${p(a1)} ${p(a2)}" fill="#fff" fill-opacity="${i % 2 ? 0.07 : 0.11}"/>`; } return svgBox(w, h, lg('g', '#1757F0', '#13B5F0'), `<rect width="${w}" height="${h}" fill="url(#g)"/>${rays}<circle cx="${cx}" cy="${cy}" r="${Math.round(Math.min(w, h) * 0.12)}" fill="#fff" fill-opacity=".2"/>`); },
  },
  {
    id: 'p17', name: 'Ngọc – tổ ong', tone: 'dark',
    svg: (w, h) => { const hex = (cx: number, cy: number, r: number) => { const pts = Array.from({ length: 6 }, (_, i) => `${Math.round(cx + r * Math.cos((Math.PI / 3) * i))},${Math.round(cy + r * Math.sin((Math.PI / 3) * i))}`).join(' '); return `<polygon points="${pts}" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="3"/>`; }; let g = ''; const r = Math.round(Math.min(w, h) * 0.11); for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) { const cx = w * 0.62 + col * r * 1.75 + (row % 2) * r * 0.87; const cy = -r + row * r * 1.5; if (cx < w + r && cy < h + r) g += hex(cx, cy, r); } return svgBox(w, h, lg('g', '#0BC2A8', '#0A7490'), `<rect width="${w}" height="${h}" fill="url(#g)"/>${g}<circle cx="${Math.round(w * 0.06)}" cy="${Math.round(h * 0.92)}" r="${Math.round(Math.min(w, h) * 0.18)}" fill="#fff" fill-opacity=".1"/>`); },
  },
  {
    id: 'p18', name: 'Dải màu tươi', tone: 'light',
    svg: (w, h) => { const { X, Y } = fit(w, h); const band = (x1: number, x2: number, c: string) => `<polygon points="${X(x1)},0 ${X(x2)},0 ${X(x2 - 0.25)},${h} ${X(x1 - 0.25)},${h}" fill="${c}" fill-opacity=".85"/>`; return svgBox(w, h, '', `<rect width="${w}" height="${h}" fill="#FFFDF8"/>${band(0.55, 0.68, '#FFD6E0')}${band(0.68, 0.8, '#FFE7A8')}${band(0.8, 0.9, '#C9F2DC')}${band(0.9, 1.05, '#CFE2FF')}<circle cx="${X(0.06)}" cy="${Y(0.9)}" r="${Math.round(Math.min(w, h) * 0.12)}" fill="#FFD6E0" fill-opacity=".7"/>`); },
  },
];

const slice = (svg: string, w: number, h: number) => svg.replace('width="1200" height="630" viewBox="0 0 1200 630"', `width="${w}" height="${h}" viewBox="0 0 1200 630" preserveAspectRatio="xMidYMid slice"`);
export const SHARE_PRESETS: SharePresetDef[] = [
  ...OLD.map((p) => ({ id: p.id, name: p.name, tone: 'dark' as const, svg: (w: number, h: number) => slice(p.svg, w, h) })),
  ...NEW,
];

export const svgDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
export const presetById = (id: string) => SHARE_PRESETS.find((p) => p.id === id) ?? SHARE_PRESETS[0];
