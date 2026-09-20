'use client';

// Đợt 12e (21/09/2026) — "Kết nối Fanpage Facebook" (tự động đăng tin mới lên Fanpage công ty).
// Đây là 1 trong 2 cách chia sẻ Facebook mà người dùng chọn ("Cả hai, để NTD tự chọn", 18/09/2026).
// Cách còn lại (nút "Chia sẻ Facebook" ở trang Quản lý tin đăng) đã hoạt động thật ngay, không cần
// gì thêm. Cách NÀY — tự động đăng lên Fanpage qua Facebook Graph API (quyền pages_manage_posts —
// khác quyền "chia sẻ hộ cá nhân" đã bị chặn từ 2018) — về mặt kỹ thuật khả thi, NHƯNG bắt buộc:
//   1) Một Facebook App thật (App ID + App Secret) do chủ sở hữu tự tạo tại developers.facebook.com
//   2) App đó phải qua App Review của Meta để được cấp quyền pages_manage_posts cho người dùng thật
//      (không phải chỉ người test) — Meta thường yêu cầu xác minh doanh nghiệp + xem chính sách bảo
//      mật thật (đã có ở đợt 12a) + video demo luồng hoạt động, thời gian duyệt vài ngày đến vài tuần
// → Không thể "bật cho chạy" chỉ bằng code — cần bạn quyết định có muốn đầu tư bước đó không, giống
// hệt tình huống VNPay/MoMo/ZaloPay (Nhóm 4, đã ghi trong claude/00-quyet-dinh-yeu-cau.md). Card này
// hiển thị đúng thực trạng thay vì giả vờ đã kết nối được, để NTD không hiểu lầm.
export default function FacebookConnectCard() {
  return (
    <div className="rounded-xl border border-border bg-white p-[18px] flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <h2 className="font-extrabold text-[15px]">Kết nối Fanpage Facebook</h2>
        <span className="text-[11px] font-semibold text-ink-faint bg-surface-alt px-2 py-0.5 rounded-full">
          Chưa khả dụng
        </span>
      </div>
      <p className="text-xs text-ink-muted leading-relaxed">
        Tự động đăng tin tuyển dụng mới lên Fanpage Facebook của công ty ngay khi được duyệt. Tính
        năng này cần công ty có sẵn 1 Facebook App đã được Meta duyệt quyền đăng bài Trang (
        <span className="font-mono text-[11px]">pages_manage_posts</span>) — một quy trình do Meta
        yêu cầu (xác minh doanh nghiệp, xem xét thủ công), không thể tự bật trong vài phút.
      </p>
      <p className="text-xs text-ink-muted leading-relaxed">
        Trong lúc chờ, bạn vẫn có thể chia sẻ từng tin lên Facebook cá nhân chỉ với 1 cú nhấp tại
        trang <span className="font-semibold">Quản lý tin đăng</span> (đã hoạt động ngay, không cần
        thiết lập gì thêm).
      </p>
      <button
        disabled
        className="tvl-btn-ghost !w-auto px-4 self-start opacity-50 cursor-not-allowed"
        title="Cần Facebook App đã qua App Review của Meta — liên hệ đội kỹ thuật nếu muốn triển khai"
      >
        Kết nối Fanpage (sắp có)
      </button>
    </div>
  );
}
