import { monitorEventLoopDelay } from 'perf_hooks';

// Đợt 94 — "đo độ trễ vòng lặp sự kiện" của Node: khi máy chủ (Render miễn phí, CPU rất nhỏ) bị quá tải, mọi yêu cầu bị xếp hàng
// và độ trễ này tăng vọt. Dùng để TỰ BỎ QUA việc phụ (thống kê truy cập, số đo tốc độ, tín hiệu "đang online", lượt hiển thị banner)
// và giữ bộ nhớ đệm lâu hơn — dành CPU cho việc chính (xem việc làm, ứng tuyển). Không tốn thêm dịch vụ nào.
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();

let level = 0; // 0 bình thường · 1 bận · 2 quá tải
let lagMs = 0;
setInterval(() => {
  lagMs = h.percentile(95) / 1e6; // ns → ms
  h.reset();
  level = lagMs > 400 ? 2 : lagMs > 120 ? 1 : 0;
}, 1000).unref();

export const loadMonitor = {
  /** 0 = bình thường, 1 = bận (trễ >120ms), 2 = quá tải (trễ >400ms). */
  level: () => level,
  lagMs: () => Math.round(lagMs),
  /** true khi nên bỏ qua việc phụ. */
  shedding: () => level >= 1,
};
