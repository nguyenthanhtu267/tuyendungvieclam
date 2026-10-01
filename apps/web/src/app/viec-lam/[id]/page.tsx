import JobDetailClient from './JobDetailClient';
import type { JobPosting } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Đợt 90 — dựng sẵn nội dung tin ở máy chủ web: người xem thấy tiêu đề/lương/mô tả ngay khi trang mở (không còn
// màn hình trống chờ gọi API), Google đọc được toàn bộ nội dung. Lưu đệm 60 giây. Máy chủ API chậm quá 3,5 giây
// (đang thức dậy) → bỏ qua, để trình duyệt tự tải như trước — không bao giờ làm treo trang.
export default async function JobDetailPage({ params }: { params: { id: string } }) {
  let initial: { job: JobPosting; related: JobPosting[] } | null = null;
  try {
    const res = await fetch(`${API}/jobs/${encodeURIComponent(params.id)}?noview=1`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) initial = await res.json();
  } catch {
    initial = null;
  }
  return <JobDetailClient initial={initial} />;
}
