import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { presetById, svgDataUri } from '@/lib/share-presets';

// Đợt 153 — ảnh xem trước khi dán link tin vào Facebook / Zalo (1200×630): tên web, tiêu đề, công ty, lương, địa điểm,
// hạn nộp và thông tin liên hệ (nếu tin có). Nền do Admin chọn (đổi theo ngày hoặc cố định) — mục "Ảnh chia sẻ" trong Admin.
// `?bg=<mã nền>` chỉ để Admin xem thử.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const SIZE = { width: 1200, height: 630 };

const font = async (n: string) => {
  const b = await readFile(join(process.cwd(), 'src', 'assets', 'fonts', `${n}.woff`));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

type Meta = {
  title: string; company: string; salaryMin: number | null; salaryMax: number | null; location: string; urgent: boolean;
  contactPhone?: string | null; contactEmail?: string | null; address?: string | null; deadline?: string | null;
};

const vnToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const fmtDate = (d?: string | null) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');

const Icon = ({ k }: { k: 'phone' | 'mail' | 'pin' }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFD27A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 10 }}>
    {k === 'phone' && <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />}
    {k === 'mail' && (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>)}
    {k === 'pin' && (<><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>)}
  </svg>
);

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const only = new URL(req.url).searchParams.get('bg') || '';
  const [b1, b2, r1, r2] = await Promise.all([font('inter-latin-700'), font('inter-vietnamese-700'), font('inter-latin-400'), font('inter-vietnamese-400')]);
  let j: Meta | null = null;
  let bg: { type: 'preset' | 'image'; id: string; dataUrl?: string; texts?: { brand: string; tagline: string; urgent: string; fallback: string } } = { type: 'preset', id: 'p1' };
  const [mRes, bRes] = await Promise.allSettled([
    fetch(`${API}/jobs/${encodeURIComponent(params.id)}/share-meta`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) }),
    fetch(`${API}/public/share-bg?d=${vnToday()}${only ? `&only=${encodeURIComponent(only)}` : ''}`, { cache: 'no-store', signal: AbortSignal.timeout(6000) }),
  ]);
  try {
    if (mRes.status === 'fulfilled' && mRes.value.ok) j = await mRes.value.json();
  } catch { j = null; }
  try {
    if (bRes.status === 'fulfilled' && bRes.value.ok) bg = await bRes.value.json();
  } catch { /* nền mặc định */ }

  const tx = { brand: 'VIỆC LÀM NGAY', tagline: 'vieclamngay.vn · Ứng tuyển miễn phí', urgent: 'TUYỂN GẤP', fallback: 'Bấm vào liên kết để xem chi tiết và ứng tuyển', ...(bg.texts ?? {}) };
  const bgSrc = bg.type === 'image' && bg.dataUrl ? bg.dataUrl : svgDataUri(presetById(bg.id).svg);
  const title = (j?.title ?? 'Tin tuyển dụng').slice(0, 110);
  const tSize = title.length <= 38 ? 68 : title.length <= 64 ? 58 : 48;
  const salary = j?.salaryMax ? `${j.salaryMin ? j.salaryMin + ' – ' : ''}${j.salaryMax} triệu/tháng` : 'Lương thỏa thuận';
  const dl = fmtDate(j?.deadline);
  const contacts: { k: 'phone' | 'mail' | 'pin'; v: string }[] = [];
  if (j?.contactPhone) contacts.push({ k: 'phone', v: j.contactPhone.slice(0, 24) });
  if (j?.contactEmail) contacts.push({ k: 'mail', v: j.contactEmail.slice(0, 40) });
  if (j?.address) contacts.push({ k: 'pin', v: j.address.slice(0, 70) });

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', fontFamily: 'InterL, InterV', color: 'white' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bgSrc} width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630 }} alt="" />
        {bg.type === 'image' && <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex', background: 'linear-gradient(135deg, rgba(5,10,25,0.72), rgba(5,10,25,0.45))' }} />}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 1200, height: 630, padding: '48px 64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 58, height: 58, borderRadius: 14, background: 'white', color: '#173B7A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 16, fontSize: 34, fontWeight: 700 }}>V</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, letterSpacing: 1 }}>{tx.brand}</div>
                <div style={{ display: 'flex', fontSize: 21, fontWeight: 400, color: '#D5E1F7' }}>{tx.tagline}</div>
              </div>
            </div>
            {j?.urgent && <div style={{ display: 'flex', background: '#E5484D', fontSize: 26, fontWeight: 700, padding: '8px 20px', borderRadius: 12 }}>{tx.urgent}</div>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: tSize, fontWeight: 700, lineHeight: 1.14, maxHeight: tSize * 1.14 * 3, overflow: 'hidden' }}>{title}</div>
            <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, color: '#D5E1F7', marginTop: 16 }}>{(j?.company ?? '').toUpperCase().slice(0, 64)}</div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 22 }}>
              <div style={{ display: 'flex', background: 'white', color: '#173B7A', fontSize: 38, fontWeight: 700, padding: '10px 26px', borderRadius: 14, marginRight: 18 }}>{salary}</div>
              {j?.location ? <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, marginRight: 22 }}>{j.location.slice(0, 30)}</div> : null}
              {dl ? <div style={{ display: 'flex', fontSize: 26, fontWeight: 400, color: '#FFD27A' }}>Hạn nộp: {dl}</div> : null}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', minHeight: 40, flexWrap: 'wrap' }}>
            {contacts.length ? (
              contacts.map((c) => (
                <div key={c.k} style={{ display: 'flex', alignItems: 'center', fontSize: 28, fontWeight: 700, marginRight: 36 }}>
                  <Icon k={c.k} />
                  {c.v}
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', fontSize: 28, fontWeight: 400, color: '#D5E1F7' }}>{tx.fallback}</div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' },
      fonts: [
        { name: 'InterL', data: b1, weight: 700, style: 'normal' },
        { name: 'InterV', data: b2, weight: 700, style: 'normal' },
        { name: 'InterL', data: r1, weight: 400, style: 'normal' },
        { name: 'InterV', data: r2, weight: 400, style: 'normal' },
      ],
    },
  );
}
