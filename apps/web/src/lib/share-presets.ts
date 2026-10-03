// Đợt 153 — các nền vector mẫu cho ảnh chia sẻ tin tuyển dụng (1200×630). Mã p1..p8 trùng với API (admin/share-bg.service.ts).
// Mọi nền đều đủ tối để chữ trắng đọc rõ. Dùng cả cho ảnh chia sẻ (máy chủ) lẫn bản xem thử trong Admin.
const W = 1200;
const H = 630;
const wrap = (defs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${body}</svg>`;
const grad = (id: string, a: string, b: string, x2 = 1, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

export const SHARE_PRESETS: { id: string; name: string; svg: string }[] = [
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

export const svgDataUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
export const presetById = (id: string) => SHARE_PRESETS.find((p) => p.id === id) ?? SHARE_PRESETS[0];
