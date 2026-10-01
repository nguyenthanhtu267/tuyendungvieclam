import type { Metadata } from 'next';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Đợt 78 — thẻ xem trước khi dán link tin vào Zalo/Facebook (og:title, og:description + ảnh opengraph-image).
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    // Đợt 90 — lưu đệm 5 phút + tối đa 2,5 giây: máy chủ API đang thức dậy không được làm treo cả trang.
    const res = await fetch(`${API}/jobs/${params.id}/share-meta`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(2500) });
    if (!res.ok) return {};
    const j = (await res.json()) as { title: string; company: string; salaryMin: number | null; salaryMax: number | null; location: string };
    const salary = j.salaryMax ? `${j.salaryMin ? j.salaryMin + ' – ' : ''}${j.salaryMax} triệu` : 'Lương thỏa thuận';
    const title = `${j.title} - ${j.company}`;
    const description = `${salary}${j.location ? ' · ' + j.location : ''} · Ứng tuyển miễn phí trên Tuyển Dụng Việc Làm`;
    return { title, description, openGraph: { title, description, type: 'website', locale: 'vi_VN' }, twitter: { card: 'summary_large_image', title, description } };
  } catch {
    return {};
  }
}

export default function JobLayout({ children }: { children: React.ReactNode }) {
  return children;
}
