// Đợt 17 (25/09/2026) — "Nguồn ngoài / Tin tổng hợp" (mô hình "labeled aggregator" đã thống nhất với
// người dùng): badge công khai cho MỌI nơi có tên/logo công ty do Admin tạo hộ từ nguồn ngoài mà công
// ty thật CHƯA "nhận lại" tài khoản — minh bạch với ứng viên/NTD rằng đây là tin tổng hợp, khác hẳn
// đăng tin nguyên vẹn nhưng ẩn nguồn gốc. Badge tự ẩn ngay khi company.claimedAt có giá trị.
export function isCompanyUnverified(company?: { isAdminSourced?: boolean; claimedAt?: string } | null): boolean {
  return !!company?.isAdminSourced && !company.claimedAt;
}

export function SourcedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="Tin do đội ngũ Tuyển Dụng Việc Làm tổng hợp từ nguồn khác — công ty chưa xác thực tài khoản trên hệ thống."
      className={`inline-flex items-center gap-1 text-[10px] font-extrabold rounded-full bg-warning-tint text-warning px-2 py-0.5 whitespace-nowrap ${className}`}
    >
      🏷️ Tin tổng hợp — chưa xác thực
    </span>
  );
}
