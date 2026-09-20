import { Injectable } from '@nestjs/common';

// Đợt 12d (20/09/2026) — banner "X người đang online" ở trang chủ, theo yêu cầu của người dùng:
// số THẬT (phiên đang mở web, heartbeat mỗi ~20s từ frontend) cộng với 1 nền "ảo" dao động theo
// giờ trong ngày (giờ Việt Nam) để trông sống động — trung bình ~500, cao điểm buổi tối >1000.
// Không dùng CSDL/Redis cho phần đếm thật — Render free tier chỉ chạy 1 instance, Map trong bộ
// nhớ là đủ và không tốn thêm hạ tầng; phần "ảo" hoàn toàn là hàm thuần theo thời gian, không cần
// lưu trạng thái, nên vẫn đúng ngay cả sau khi server "ngủ" rồi khởi động lại.

const HEARTBEAT_WINDOW_MS = 90_000; // 1 phiên coi là "đang online" nếu ping trong 90s gần nhất

// Baseline theo từng giờ trong ngày (giờ VN, 0-23h) — khuya thấp nhất, tăng dần buổi sáng/trưa,
// cao điểm rõ rệt buổi tối (>1000 theo đúng yêu cầu), giảm dần về khuya. Trung bình cả ngày ~500.
const HOURLY_BASELINE: number[] = [
  180, 140, 110, 95, 90, 100, // 0h-5h: đêm khuya, thấp nhất
  160, 260, 380, 430, 470, 500, // 6h-11h: sáng đi làm → giờ hành chính
  560, 520, 480, 470, 500, 560, // 12h-17h: trưa/chiều, nhích lên cuối giờ chiều
  780, 1050, 1220, 1180, 950, 620, // 18h-23h: cao điểm buổi tối (sau giờ làm), đỉnh ~21h rồi giảm dần
];

function pseudoRandom01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

@Injectable()
export class PresenceService {
  private readonly lastSeen = new Map<string, number>();

  ping(sessionId: string) {
    this.lastSeen.set(sessionId, Date.now());
    return { success: true };
  }

  private countRealOnline(): number {
    const cutoff = Date.now() - HEARTBEAT_WINDOW_MS;
    let count = 0;
    for (const [id, ts] of this.lastSeen) {
      if (ts < cutoff) this.lastSeen.delete(id);
      else count++;
    }
    return count;
  }

  // Nội suy tuyến tính giữa baseline của giờ hiện tại và giờ kế tiếp theo phút, để số liệu đổi mượt
  // thay vì nhảy bậc mỗi khi sang giờ mới. Nhận sẵn giờ/phút theo giờ Việt Nam (đã quy đổi ở
  // getCount(), dùng getUTC* để không phụ thuộc múi giờ hệ điều hành của server).
  private fakeBaseline(hour: number, minuteFrac: number, epochMs: number): number {
    const current = HOURLY_BASELINE[hour];
    const next = HOURLY_BASELINE[(hour + 1) % 24];
    const interpolated = current + (next - current) * minuteFrac;

    // Dao động nhẹ ±6%, đổi mỗi 2 phút (không đổi liên tục từng request) để trông "sống" mà vẫn
    // ổn định trong thời gian ngắn — thuần theo thời gian hiện tại, không cần lưu trạng thái.
    const bucket = Math.floor(epochMs / (2 * 60_000));
    const jitter = (pseudoRandom01(bucket) - 0.5) * 0.12;
    return Math.round(interpolated * (1 + jitter));
  }

  getCount() {
    const real = this.countRealOnline();
    // Giờ Việt Nam (UTC+7) — server có thể chạy ở múi giờ khác (Render mặc định UTC). Dịch epoch
    // +7h rồi đọc bằng getUTC* để tránh phụ thuộc múi giờ cục bộ của máy chủ.
    const nowMs = Date.now();
    const vnShifted = new Date(nowMs + 7 * 60 * 60 * 1000);
    const hour = vnShifted.getUTCHours();
    const minuteFrac = vnShifted.getUTCMinutes() / 60;
    const fake = this.fakeBaseline(hour, minuteFrac, nowMs);
    return { displayed: real + fake };
  }
}
