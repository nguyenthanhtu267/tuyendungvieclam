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
          <p className="text-xs text-ink-faint">Cập nhật lần cuối: 27/09/2026</p>
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

        {/* Đợt 18 (26/09/2026) — minh bạch về Kho CV và hồ sơ "Nguồn tổng hợp". */}
        <Section title="3a. CV đã nộp & hồ sơ “Nguồn tổng hợp”">
          Khi bạn ứng tuyển, nhà tuyển dụng nhận một bản lưu hồ sơ và CV tại thời điểm nộp (Kho CV) — bản lưu này
          vẫn còn kể cả khi bạn sửa hồ sơ hoặc xoá tài khoản. Đội ngũ Tuyển Dụng Việc Làm có thể đăng lại thông tin
          nghề nghiệp từ CV đã nộp hoặc từ nguồn công khai thành hồ sơ gắn nhãn “Nguồn tổng hợp” để nhà tuyển dụng
          khác tìm thấy; hồ sơ này không hiện với công ty bạn đã nộp CV và tôn trọng danh sách công ty bạn đã chặn.
          Bạn có quyền yêu cầu gỡ hoặc nhận lại hồ sơ đó bất kỳ lúc nào tại trang{' '}
          <a href="/yeu-cau-ho-so" className="text-primary font-semibold hover:underline">
            Gỡ / nhận lại hồ sơ
          </a>
          .
        </Section>

        <Section title="4. Lưu trữ & bảo mật">
          Mật khẩu được băm một chiều bằng argon2, không ai (kể cả quản trị viên) xem được mật khẩu
          gốc của bạn. Tệp CV/giấy tờ pháp lý lưu trực tiếp trong cơ sở dữ liệu có kiểm soát truy
          cập, không public trên ổ đĩa mở. Kết nối giữa trình duyệt và máy chủ được mã hoá (HTTPS).
        </Section>

        {/* Đợt 19 (26/09/2026) — minh bạch về bộ ghi truy cập (thống kê nội bộ). */}
        <Section title="5. Cookie & thống kê truy cập">
          Chúng tôi dùng thông tin phiên đăng nhập cần thiết để bạn không phải đăng nhập lại mỗi lần truy cập. Để cải
          thiện website, chúng tôi tự ghi nhận thống kê truy cập nội bộ: trang đã xem, thời gian xem, mức cuộn trang,
          vị trí các cú bấm chuột/chạm, nút đã bấm (ứng tuyển, lưu tin...), từ khoá tìm kiếm, trang giới thiệu bạn tới
          (VD Google, Facebook), loại thiết bị/trình duyệt và tỉnh/thành ước lượng. Trình duyệt của bạn được gắn một mã
          ngẫu nhiên ẩn danh (lưu trong bộ nhớ trình duyệt); nếu bạn đang đăng nhập, thống kê được gắn với tài khoản.
          Chúng tôi KHÔNG lưu địa chỉ IP, không ghi nội dung bạn gõ vào ô nhập liệu, không dùng dịch vụ quảng cáo/phân
          tích của bên thứ ba và không bán hay chia sẻ dữ liệu này. Dữ liệu chi tiết tự động xoá sau 90 ngày; chỉ giữ
          lại số tổng hợp theo ngày (không định danh). Bạn có thể xoá mã ẩn danh bất kỳ lúc nào bằng cách xoá dữ liệu
          trang web trong trình duyệt.
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
