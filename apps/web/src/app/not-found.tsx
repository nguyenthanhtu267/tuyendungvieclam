import Link from 'next/link';

// Đợt 12a (20/09/2026) — trang 404 riêng theo thương hiệu, thay cho trang mặc định của Next.js.
export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center bg-bg">
      <div className="text-6xl font-extrabold text-primary">404</div>
      <h1 className="font-bold text-lg text-ink">Không tìm thấy trang này</h1>
      <p className="text-sm text-ink-faint max-w-sm">
        Trang bạn tìm có thể đã bị xoá, đổi địa chỉ, hoặc chưa từng tồn tại. Hãy quay lại trang chủ
        để tiếp tục tìm việc làm hoặc tuyển dụng.
      </p>
      <Link href="/" className="tvl-btn-primary !w-auto px-6 mt-2">
        Về trang chủ
      </Link>
    </main>
  );
}
