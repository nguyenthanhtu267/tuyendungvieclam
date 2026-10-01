import HomeClient, { type HomeBundle } from './HomeClient';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Đợt 90 — trang chủ: máy chủ web lấy sẵn dữ liệu bằng 1 lệnh gộp (/jobs/home-bundle, lưu đệm 60 giây) → tin mới,
// ngành nghề, nhà tuyển dụng nổi bật hiện ngay khi mở trang. API chậm quá 3,5 giây → trình duyệt tự tải như trước.
export default async function HomePage() {
  let initial: HomeBundle | null = null;
  try {
    const res = await fetch(`${API}/jobs/home-bundle`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(3500) });
    if (res.ok) initial = await res.json();
  } catch {
    initial = null;
  }
  return <HomeClient initial={initial} />;
}
