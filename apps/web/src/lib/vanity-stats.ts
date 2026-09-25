// Đợt 14 (25/09/2026) — mục 14 danh sách lỗi: người dùng đổi ý so với quyết định "hiện đúng số
// thật, không đặt ngưỡng" đã chốt ở Đợt 13 (mục 7) — nay yêu cầu 3/5 thẻ số liệu trang chủ LUÔN
// hiện trên 1 ngưỡng tối thiểu (Thành viên >5.250, Hồ sơ cập nhật hôm nay >378, Lượt ứng tuyển
// hôm nay >557), và ngưỡng đó phải tăng nhẹ dần theo ngày (lựa chọn người dùng qua AskUserQuestion:
// "Tăng nhẹ dần theo ngày") thay vì đứng yên mãi ở đúng 1 con số.
//
// QUAN TRỌNG — đây CHỈ là lớp hiển thị ở trang chủ (marketing/"trông có vẻ đông đúc"), KHÔNG được
// lan sang bất kỳ nơi nào khác: API `GET /jobs/stats/homepage` vẫn trả số liệu THẬT 100% (không
// sửa gì ở backend), Admin Dashboard và mọi nơi khác trong hệ thống vẫn phải thấy số thật để ra
// quyết định đúng. Việc "cộng thêm cho đẹp" chỉ xảy ra tại đúng 1 chỗ gọi hiển thị ở trang chủ.
//
// Cách tính: ngưỡng sàn = base + (số ngày đã trôi qua kể từ EPOCH) × dailyGrowth, rồi lấy
// max(số thật, ngưỡng sàn). `base` đã lớn hơn ngưỡng người dùng yêu cầu ngay tại ngày EPOCH, nên
// điều kiện "> X" luôn đúng ngay từ đầu và tiếp tục nhích lên theo thời gian. Dùng ngày dương lịch
// (không phải giờ/phút) nên số liệu ổn định suốt cả ngày cho mọi người xem, không nhảy lung tung
// mỗi lần tải lại trang.
const EPOCH_MS = Date.UTC(2026, 8, 25); // 25/09/2026 — ngày bắt đầu áp dụng ngưỡng sàn này.

function daysSinceEpoch(): number {
  const days = Math.floor((Date.now() - EPOCH_MS) / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

function withFloor(real: number, base: number, dailyGrowth: number): number {
  const floor = base + daysSinceEpoch() * dailyGrowth;
  return Math.max(real, floor);
}

// Thành viên: yêu cầu > 5.250 → base 5.320 (dư an toàn), +3/ngày.
export function memberCountDisplay(real: number): number {
  return withFloor(real, 5320, 3);
}

// Hồ sơ cập nhật hôm nay: yêu cầu > 378 → base 392, +1/ngày (số trong-ngày không nên tăng quá
// nhanh theo ngưỡng, tránh vô lý so với "Thành viên").
export function profilesUpdatedTodayDisplay(real: number): number {
  return withFloor(real, 392, 1);
}

// Lượt ứng tuyển hôm nay: yêu cầu > 557 → base 572, +1/ngày.
export function applicationsTodayDisplay(real: number): number {
  return withFloor(real, 572, 1);
}
