import type { MetadataRoute } from 'next';

// Đợt 12a (20/09/2026) — sitemap.xml tự sinh (Next.js metadata route). Gồm các trang tĩnh công
// khai + danh sách tin tuyển dụng đang duyệt/hiển thị thật (gọi API /jobs, cùng bộ lọc mà trang
// /viec-lam dùng: approvalStatus=APPROVED, isPaused=false — xem jobs.service.ts). Giới hạn lấy
// 500 tin mới nhất (10 trang x pageSize=50, mức tối đa DTO cho phép) thay vì toàn bộ ~1245 tin sau
// khi có dữ liệu ảo đợt 12d, để tránh sitemap quá nặng và tránh dội quá nhiều truy vấn vào API mỗi
// lần Google/crawler tải lại trang này — revalidate 1 giờ nên không tính lại mỗi request.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tuyendungvieclam.vercel.app';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const revalidate = 3600;

type JobListItem = { id: string; createdAt?: string };

async function fetchJobIds(): Promise<JobListItem[]> {
  const PAGE_SIZE = 50;
  const MAX_PAGES = 10;
  const jobs: JobListItem[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const res = await fetch(`${API_URL}/jobs?page=${page}&pageSize=${PAGE_SIZE}`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;
      const data = await res.json();
      const items: JobListItem[] = data?.items ?? [];
      if (items.length === 0) break;
      jobs.push(...items);
      if (page >= (data?.totalPages ?? 1)) break;
    } catch {
      // API có thể chưa sẵn sàng (ví dụ lúc build tĩnh không có mạng nội bộ) — bỏ qua, sitemap
      // vẫn trả về các trang tĩnh bên dưới thay vì lỗi toàn bộ route.
      break;
    }
  }
  return jobs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await fetchJobIds();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/viec-lam`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/dang-nhap`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/nha-tuyen-dung/dang-ky`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/dieu-khoan-su-dung`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/chinh-sach-bao-mat`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const jobRoutes: MetadataRoute.Sitemap = jobs.map((job) => ({
    url: `${SITE_URL}/viec-lam/${job.id}`,
    lastModified: job.createdAt ? new Date(job.createdAt) : undefined,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  return [...staticRoutes, ...jobRoutes];
}
