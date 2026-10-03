import { ImageResponse } from 'next/og';
import { INTER_LATIN_400, INTER_LATIN_700, INTER_VIETNAMESE_400, INTER_VIETNAMESE_700 } from '@/assets/fonts/inter-data';
import { presetById, svgDataUri } from '@/lib/share-presets';
import { peopleSvg } from '@/lib/share-people';

// Đợt 153 — ảnh xem trước khi dán link tin vào Facebook / Zalo (1200×630): tên web, tiêu đề, công ty, lương, địa điểm,
// hạn nộp và thông tin liên hệ (nếu tin có). Nền do Admin chọn (đổi theo ngày hoặc cố định) — mục "Ảnh chia sẻ" trong Admin.
// `?bg=<mã nền>` chỉ để Admin xem thử.
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const FONTS: Record<string, string> = {
  'inter-latin-400': INTER_LATIN_400, 'inter-latin-700': INTER_LATIN_700,
  'inter-vietnamese-400': INTER_VIETNAMESE_400, 'inter-vietnamese-700': INTER_VIETNAMESE_700,
};
const font = async (n: string) => {
  const bin = atob(FONTS[n]);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer as ArrayBuffer;
};

type Meta = {
  title: string; company: string; salaryMin: number | null; salaryMax: number | null; location: string; urgent: boolean;
  contactPhone?: string | null; contactEmail?: string | null; address?: string | null; deadline?: string | null;
};

const vnToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const fmtDate = (d?: string | null) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');

const iconPath = (k: 'phone' | 'mail' | 'pin') =>
  // Không dùng Fragment trong <svg>: bộ vẽ (satori) không hiểu Fragment.
  k === 'phone'
    ? [<path key="a" d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />]
    : k === 'mail'
      ? [<rect key="a" x="3" y="5" width="18" height="14" rx="2" />, <path key="b" d="m3 7 9 6 9-6" />]
      : [<path key="a" d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />, <circle key="b" cx="12" cy="10" r="2.5" />];


type ElStyle = { color: string; scale: number; bold: boolean; italic: boolean };
type Els = 'brand' | 'tagline' | 'badge' | 'title' | 'company' | 'salary' | 'meta' | 'contact';
type Style = { els: Record<Els, ElStyle>; show: { salary: boolean; location: boolean; deadline: boolean; contact: boolean }; scrim: number };
const EL_KEYS: Els[] = ['brand', 'tagline', 'badge', 'title', 'company', 'salary', 'meta', 'contact'];
const cleanStyle = (raw: unknown): Style => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { els?: Record<string, Partial<ElStyle>>; show?: Record<string, unknown>; scrim?: unknown };
  const els = {} as Record<Els, ElStyle>;
  for (const k of EL_KEYS) {
    const x = r.els?.[k] ?? {};
    els[k] = {
      color: typeof x.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(x.color) ? x.color : '',
      scale: typeof x.scale === 'number' ? Math.min(170, Math.max(60, x.scale)) : 100,
      bold: typeof x.bold === 'boolean' ? x.bold : k !== 'tagline',
      italic: x.italic === true,
    };
  }
  const b = (k: string) => (typeof r.show?.[k] === 'boolean' ? (r.show[k] as boolean) : true);
  return { els, show: { salary: b('salary'), location: b('location'), deadline: b('deadline'), contact: b('contact') }, scrim: typeof r.scrim === 'number' ? Math.min(85, Math.max(0, r.scrim)) : 55 };
};
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
type Bg = { type: 'preset' | 'image'; id: string; dataUrl?: string; texts?: { brand: string; tagline: string; urgent: string; fallback: string }; style?: unknown; people?: string; format?: string };

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    // ImageResponse vẽ ảnh lúc đọc dữ liệu → đọc hết ngay trong try để lỗi vẽ cũng rơi vào ảnh dự phòng.
    const res = await render(req, params.id.replace(/\.png$/i, ''));
    const buf = await res.arrayBuffer();
    return new Response(buf, { headers: res.headers });
  } catch (e) {
    console.error('[chia-se] lỗi vẽ ảnh:', e instanceof Error ? e.message : e);
    // Mọi lỗi (font, API...) → ảnh mặc định tĩnh, không bao giờ để khung xem trước trống.
    // (Không dùng Response.redirect: tiêu đề của nó bất biến, môi trường Edge sẽ báo lỗi.)
    return new Response(null, { status: 302, headers: { Location: new URL('/og-default.png', req.url).toString() } });
  }
}

async function render(req: Request, rawId: string) {
  const sp = new URL(req.url).searchParams;
  const only = sp.get('bg') || '';
  const preview = !!only; // chỉ khi Admin xem thử mới cho ghi đè kiểu/người/khổ qua địa chỉ
  const [b1, b2, r1, r2] = await Promise.all([font('inter-latin-700'), font('inter-vietnamese-700'), font('inter-latin-400'), font('inter-vietnamese-400')]);
  let j: Meta | null = null;
  let bg: Bg = { type: 'preset', id: 'p1' };
  const [mRes, bRes] = await Promise.allSettled([
    fetch(`${API}/jobs/${encodeURIComponent(rawId)}/share-meta`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) }),
    fetch(`${API}/public/share-bg?d=${vnToday()}${only ? `&only=${encodeURIComponent(only)}` : ''}`, { cache: 'no-store', signal: AbortSignal.timeout(6000) }),
  ]);
  try {
    if (mRes.status === 'fulfilled' && mRes.value.ok) j = await mRes.value.json();
  } catch { j = null; }
  try {
    if (bRes.status === 'fulfilled' && bRes.value.ok) bg = await bRes.value.json();
  } catch { /* nền mặc định */ }

  let pv: { style?: unknown; people?: string; format?: string } = {};
  if (preview) {
    try { pv = JSON.parse(sp.get('pv') || '{}'); } catch { pv = {}; }
  }
  const st = cleanStyle(pv.style ?? bg.style);
  const peopleSel = (pv.people ?? bg.people ?? 'none') as string;
  const people = peopleSel === 'male' || peopleSel === 'female' || peopleSel === 'both' ? peopleSel : 'none';
  const cfgFormat = (pv.format ?? bg.format ?? 'wide') as string;
  const fmtParam = preview ? sp.get('fmt') : null;
  const square = fmtParam ? fmtParam === 'square' : cfgFormat === 'square' || (cfgFormat === 'auto' && sp.get('f') === 'm');
  const W = square ? 1080 : 1200;
  const H = square ? 1080 : 630;

  const tx = { brand: 'VIỆC LÀM NGAY', tagline: 'vieclamngay.vn · Ứng tuyển miễn phí', urgent: 'TUYỂN GẤP', fallback: 'Bấm vào liên kết để xem chi tiết và ứng tuyển', ...(bg.texts ?? {}) };
  const preset = presetById(bg.id);
  const isImg = bg.type === 'image' && !!bg.dataUrl;
  const dark = isImg ? true : preset.tone === 'dark';
  const bgSrc = isImg ? (bg.dataUrl as string) : svgDataUri(preset.svg(W, H));

  const pick = (k: Els, auto: string) => st.els[k].color || auto;
  const col = {
    brand: pick('brand', dark ? '#FFFFFF' : '#12284F'),
    tagline: pick('tagline', dark ? '#D5E1F7' : '#35507F'),
    title: pick('title', dark ? '#FFFFFF' : '#12284F'),
    company: pick('company', dark ? '#D5E1F7' : '#2A4E94'),
    salaryBg: pick('salary', dark ? '#FFFFFF' : '#12284F'),
    meta: pick('meta', dark ? '#FFFFFF' : '#12284F'),
    deadline: st.els.meta.color || (dark ? '#FFD27A' : '#B45309'),
    contact: pick('contact', dark ? '#FFFFFF' : '#12284F'),
    icon: st.els.contact.color || (dark ? '#FFD27A' : '#D9480F'),
    badge: pick('badge', '#E5484D'),
  };
  const salaryTx = lum(col.salaryBg) > 0.6 ? '#12284F' : '#FFFFFF';
  const badgeTx = lum(col.badge) > 0.7 ? '#12284F' : '#FFFFFF';
  const logoBg = col.brand;
  const logoTx = lum(logoBg) > 0.6 ? '#12284F' : '#FFFFFF';

  const T = (k: Els, base: number, color: string, extra: Record<string, unknown> = {}) => ({
    display: 'flex',
    fontSize: Math.round((base * st.els[k].scale) / 100),
    fontWeight: st.els[k].bold ? 700 : 400,
    color,
    ...(st.els[k].italic ? { transform: 'skewX(-9deg)', transformOrigin: 'left center' } : {}),
    ...extra,
  });

  const title = (j?.title ?? 'Tin tuyển dụng').slice(0, square ? 120 : 110);
  const pf = people === 'none' ? 1 : 0.86;
  const tl = title.length;
  const baseTitle = square ? (tl <= 30 ? 100 : tl <= 50 ? 88 : tl <= 80 ? 76 : 64) : tl <= 34 ? 82 : tl <= 56 ? 70 : tl <= 84 ? 60 : 52;
  const titleSize = Math.round((baseTitle * pf * st.els.title.scale) / 100);
  const lines = square ? 4 : 3;
  const salary = j?.salaryMax ? `${j.salaryMin ? j.salaryMin + ' – ' : ''}${j.salaryMax} triệu/tháng` : 'Lương thỏa thuận';
  const dl = fmtDate(j?.deadline);
  const contacts: { k: 'phone' | 'mail' | 'pin'; v: string }[] = [];
  if (st.show.contact) {
    if (j?.contactPhone) contacts.push({ k: 'phone', v: j.contactPhone.slice(0, 24) });
    if (j?.contactEmail) contacts.push({ k: 'mail', v: j.contactEmail.slice(0, 40) });
    if (j?.address) contacts.push({ k: 'pin', v: j.address.slice(0, square ? 60 : 70) });
  }
  const pad = square ? 64 : 52;
  const imgW = people === 'none' ? 0 : people === 'both' ? (square ? 560 : 500) : square ? 470 : 410;
  const imgH = Math.round((imgW * 420) / 520);
  const textW = square ? W - pad * 2 : people === 'none' ? W - pad * 2 : W - pad * 2 - imgW + 40;
  const stack = people !== 'none' || square; // liên hệ xếp dọc khi có hình người hoặc khổ vuông
  const contactW = square && people !== 'none' ? 500 : textW;
  const cSize = Math.round((st.els.contact.scale * (square ? 34 : 33)) / 100);

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', position: 'relative', fontFamily: 'InterL, InterV', color: 'white' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bgSrc} width={W} height={H} style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }} alt="" />
        {isImg && <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', background: `linear-gradient(135deg, rgba(5,10,25,${st.scrim / 100}), rgba(5,10,25,${(st.scrim * 0.6) / 100}))` }} />}
        {people !== 'none' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={svgDataUri(peopleSvg(people, imgW, imgH))} width={imgW} height={imgH} style={{ position: 'absolute', right: square ? 8 : 24, bottom: 0, width: imgW, height: imgH }} alt="" />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', width: W, height: H, padding: `${square ? 56 : 40}px ${pad}px ${square ? 56 : 38}px` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: W - pad * 2 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: square ? 76 : 66, height: square ? 76 : 66, borderRadius: 16, background: logoBg, color: logoTx, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 18, fontSize: square ? 44 : 38, fontWeight: 700 }}>V</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={T('brand', square ? 46 : 42, col.brand, { letterSpacing: 1 })}>{tx.brand}</div>
                <div style={T('tagline', square ? 27 : 25, col.tagline)}>{tx.tagline}</div>
              </div>
            </div>
            {j?.urgent && <div style={{ ...T('badge', square ? 36 : 32, badgeTx), background: col.badge, padding: '8px 22px', borderRadius: 14 }}>{tx.urgent}</div>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', marginTop: square ? 44 : 26, width: textW }}>
            <div style={{ ...T('title', baseTitle, col.title, { fontSize: titleSize, lineHeight: 1.1, maxHeight: titleSize * 1.1 * lines, overflow: 'hidden', width: textW }) }}>{title}</div>
            <div style={T('company', square ? 42 : 38, col.company, { marginTop: 14, width: textW })}>{(j?.company ?? '').toUpperCase().slice(0, 64)}</div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 20, flexWrap: 'wrap', width: textW }}>
              {st.show.salary && <div style={{ ...T('salary', square ? 54 : 48, salaryTx), background: col.salaryBg, padding: '8px 26px', borderRadius: 16, marginRight: 20 }}>{salary}</div>}
              {st.show.location && j?.location ? <div style={T('meta', square ? 42 : 38, col.meta, { marginRight: 22 })}>{j.location.slice(0, 30)}</div> : null}
              {st.show.deadline && dl ? <div style={T('meta', square ? 34 : 30, col.deadline, { fontWeight: 400 })}>Hạn nộp: {dl}</div> : null}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: stack ? 'column' : 'row', flexWrap: stack ? 'nowrap' : 'wrap', alignItems: stack ? 'flex-start' : 'center', marginTop: 'auto', width: contactW }}>
            {contacts.length ? (
              contacts.map((c) => (
                <div key={c.k} style={{ display: 'flex', alignItems: 'center', marginRight: 34, marginTop: stack ? 8 : 0 }}>
                  <svg width={cSize + 6} height={cSize + 6} viewBox="0 0 24 24" fill="none" stroke={col.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
                    {iconPath(c.k)}
                  </svg>
                  <div style={T('contact', square ? 34 : 33, col.contact, { maxWidth: contactW - 60 })}>{c.v}</div>
                </div>
              ))
            ) : st.show.contact ? (
              <div style={T('contact', square ? 32 : 30, col.tagline, { fontWeight: 400, width: contactW })}>{tx.fallback}</div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: { 'Cache-Control': preview ? 'no-store' : 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' },
      fonts: [
        { name: 'InterL', data: b1, weight: 700, style: 'normal' },
        { name: 'InterV', data: b2, weight: 700, style: 'normal' },
        { name: 'InterL', data: r1, weight: 400, style: 'normal' },
        { name: 'InterV', data: r2, weight: 400, style: 'normal' },
      ],
    },
  );
}
