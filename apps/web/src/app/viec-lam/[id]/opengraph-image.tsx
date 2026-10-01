import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'Tin tuyển dụng';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const runtime = 'nodejs';

const font = async (n: string) => {
  const b = await readFile(join(process.cwd(), 'src', 'assets', 'fonts', `${n}.woff`));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

// Đợt 78 — ảnh chia sẻ 1200×630: chức danh, công ty, lương, địa điểm (font Inter có đủ dấu tiếng Việt).
export default async function Image({ params }: { params: { id: string } }) {
  const [b1, b2, r1, r2] = await Promise.all([font('inter-latin-700'), font('inter-vietnamese-700'), font('inter-latin-400'), font('inter-vietnamese-400')]);
  let j: { title: string; company: string; salaryMin: number | null; salaryMax: number | null; location: string; urgent: boolean } | null = null;
  try {
    const res = await fetch(`${API}/jobs/${params.id}/share-meta`, { cache: 'no-store' });
    if (res.ok) j = await res.json();
  } catch {
    j = null;
  }
  const salary = j?.salaryMax ? `${j.salaryMin ? j.salaryMin + ' – ' : ''}${j.salaryMax} triệu/tháng` : 'Lương thỏa thuận';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#173B7A', padding: 64, fontFamily: 'InterL, InterV' }}>
        <div style={{ display: 'flex', alignItems: 'center', color: 'white', fontSize: 30, fontWeight: 700 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: 'white', color: '#173B7A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>V</div>
          ĐĂNG TUYỂN <span style={{ color: '#FF7A50', marginLeft: 10 }}>MIỄN PHÍ</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {j?.urgent && <div style={{ display: 'flex', alignSelf: 'flex-start', background: '#E5484D', color: 'white', fontSize: 26, fontWeight: 700, padding: '6px 18px', borderRadius: 10, marginBottom: 20 }}>URGENT</div>}
          <div style={{ display: 'flex', color: 'white', fontSize: 68, fontWeight: 700, lineHeight: 1.12 }}>{(j?.title ?? 'Tin tuyển dụng').slice(0, 80)}</div>
          <div style={{ display: 'flex', color: '#C9D6EE', fontSize: 36, marginTop: 20 }}>{(j?.company ?? '').toUpperCase().slice(0, 70)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', background: 'white', color: '#173B7A', fontSize: 40, fontWeight: 700, padding: '12px 28px', borderRadius: 14 }}>{salary}</div>
          <div style={{ display: 'flex', color: 'white', fontSize: 34, fontWeight: 400 }}>{j?.location ?? ''}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'InterL', data: b1, weight: 700, style: 'normal' },
        { name: 'InterV', data: b2, weight: 700, style: 'normal' },
        { name: 'InterL', data: r1, weight: 400, style: 'normal' },
        { name: 'InterV', data: r2, weight: 400, style: 'normal' },
      ],
    },
  );
}
