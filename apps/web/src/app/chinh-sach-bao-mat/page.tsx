import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật | Tuyển Dụng Việc Làm',
};

// Đợt 12a (20/09/2026) — nội dung phản ánh đúng thực tế lưu trữ dữ liệu hiện tại: mật khẩu băm
// bằng argon2 (không lưu dạng thô), CV/giấy tờ pháp lý lưu trong CSDL PostgreSQL (không phải ổ đĩa
// máy chủ), không dùng cookie quảng cáo/theo dõi bên thứ ba, không gửi email/SMS marketing.
export default function ChinhSachBaoMatPage() {
  return (
    <main className="min-h-screen bg-bg">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-10 flex flex-col gap-5 text-sm text-ink-muted">
        <div>
          <h1 className="font-extrabold text-2xl text-ink mb-1">Chính sách bảo mật</h1>
          <p className="text-xs text-ink-faint">Cập nhật lần cuối: 20/09/2026</p>
        </div>

        <Section title="1. Dữ liệu chúng tôi thu thập">
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Thông tin tài khoản: email, mật khẩu (được băm bằng argon2, không lưu dạng đọc được), họ tên, số điện thoại.</li>
            <li>Hồ sơ ứng viên: vị trí/mức lương mong muốn, kinh nghiệm, học vấn, kỹ năng, CV (tệp tải lên hoặc link Google Drive tự dán).</li>
            <li>Thông tin công ty (nhà tuyển dụng): tên công ty, mã số thuế, quy mô, ngành nghề, giấy tờ pháp lý xác thực.</li>
            <li>Lịch sử sử dụng: tin đã đăng, đơn ứng tuyển, hồ sơ đã mở khoá, đơn hàng gói dịch vụ.</li>
            <li>Dữ liệu kỹ thuật ẩn danh: số phiên đang mở trang (để hiển thị số người đang truy cập), không gắn với danh tính cá nhân.</li>
          </ul>
        </Section>

        <Section title="2. Mục đích sử dụng">
          Dữ liệu được dùng để vận hành các chức năng cốt lõi: hiển thị hồ sơ/tin tuyển dụng, kết
          nối ứng viên với nhà tuyển dụng, xác thực tài khoản, xử lý đơn hàng gói dịch vụ, và hỗ trợ
          khi người dùng cần trợ giúp (ví dụ đặt lại mật khẩu). Chúng tôi không bán, cho thuê dữ liệu
          cá nhân cho bên thứ ba ngoài mục đích trên.
        </Section>

        <Section title="3. Ai có thể xem dữ liệu của bạn">
          Hồ sơ ứng viên ở chế độ "Công khai" hoặc "Khẩn cấp" hiển thị cho nhà tuyển dụng tìm kiếm;
          chế độ "Khoá" ẩn hoàn toàn khỏi tìm kiếm. Ứng viên có thể chặn từng công ty cụ thể xem hồ
          sơ của mình. Thông tin liên hệ (số điện thoại, email) chỉ hiển thị cho nhà tuyển dụng đã
          thực hiện "mở khoá hồ sơ" theo gói dịch vụ, trừ khi bạn chọn ẩn hẳn trong phần cài đặt.
        </Section>

        <Section title="4. Lưu trữ & bảo mật">
          Mật khẩu được băm một chiều bằng argon2, không ai (kể cả quản trị viên) xem được mật khẩu
          gốc của bạn. Tệp CV/giấy tờ pháp lý lưu trực tiếp trong cơ sở dữ liệu có kiểm soát truy
          cập, không public trên ổ đĩa mở. Kết nối giữa trình duyệt và máy chủ được mã hoá (HTTPS).
        </Section>

        <Section title="5. Cookie & theo dõi">
          Chúng tôi chỉ dùng thông tin phiên đăng nhập cần thiết để bạn không phải đăng nhập lại mỗi
          lần truy cập. Chúng tôi không đặt cookie quảng cáo hoặc chia sẻ dữ liệu duyệt web với các
          nền tảng quảng cáo bên thứ ba.
        </Section>

        <Section title="6. Quyền của bạn">
          Bạn có thể tự sửa, cập nhật hồ sơ, xoá CV, hoặc ẩn hồ sơ khỏi tìm kiếm bất kỳ lúc nào trong
          phần Cài đặt tài khoản. Nếu muốn xoá hoàn toàn tài khoản, vui lòng liên hệ quản trị viên
          qua kênh hỗ trợ (Giai đoạn 1 chưa có luồng tự xoá tài khoản trong giao diện).
        </Section>

        <Section title="7. Thay đổi chính sách">
          Khi chính sách bảo mật được cập nhật, phiên bản mới nhất sẽ luôn được đăng tại trang này
          kèm ngày cập nhật ở đầu trang.
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="font-bold text-ink text-[15px]">{title}</h2>
      <div className="leading-relaxed">{children}</div>
    </section>
  );
}
