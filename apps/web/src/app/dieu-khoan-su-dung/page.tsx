import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng | Tuyển Dụng Việc Làm',
};

// Đợt 12a (20/09/2026) — nội dung soạn riêng cho phạm vi thật của dịch vụ ở Giai đoạn 1 (không sao
// chép mẫu điều khoản từ nơi khác), phản ánh đúng những gì hệ thống thực sự làm: không có thanh
// toán online thật ngoài "Hợp đồng + hoá đơn VAT", không gửi email/SMS, dữ liệu CV/hồ sơ do người
// dùng tự nhập hoặc dán link Google Drive.
export default function DieuKhoanSuDungPage() {
  return (
    <main className="min-h-screen bg-bg">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-10 flex flex-col gap-5 text-sm text-ink-muted">
        <div>
          <h1 className="font-extrabold text-2xl text-ink mb-1">Điều khoản sử dụng</h1>
          <p className="text-xs text-ink-faint">Cập nhật lần cuối: 20/09/2026</p>
        </div>

        <Section title="1. Dịch vụ cung cấp">
          Tuyển Dụng Việc Làm (tuyendungvieclam) là cổng thông tin việc làm trực tuyến, kết nối
          ứng viên tìm việc với các doanh nghiệp có nhu cầu tuyển dụng. Dịch vụ hiện ở Giai đoạn 1:
          đăng ký tài khoản, tạo hồ sơ ứng viên, đăng tin tuyển dụng, nộp đơn ứng tuyển, tìm kiếm hồ
          sơ ứng viên (dành cho nhà tuyển dụng), và các gói dịch vụ trả phí cho nhà tuyển dụng.
        </Section>

        <Section title="2. Tài khoản người dùng">
          Người dùng chịu trách nhiệm bảo mật thông tin đăng nhập của mình. Thông tin cung cấp khi
          đăng ký (họ tên, email, số điện thoại, thông tin công ty...) phải chính xác và thuộc
          quyền sử dụng hợp pháp của người đăng ký. Chúng tôi có quyền tạm khoá hoặc từ chối tài
          khoản có dấu hiệu gian dối, mạo danh, hoặc vi phạm điều khoản này.
        </Section>

        <Section title="3. Nội dung do người dùng đăng tải">
          Ứng viên chịu trách nhiệm về tính chính xác của thông tin hồ sơ, CV (tệp tải lên hoặc link
          Google Drive tự dán). Nhà tuyển dụng chịu trách nhiệm về nội dung tin tuyển dụng và giấy
          tờ pháp lý công ty cung cấp để xác thực. Mọi tin tuyển dụng công khai đều được đội ngũ
          quản trị xét duyệt trước khi hiển thị; chúng tôi có quyền từ chối hoặc gỡ tin vi phạm pháp
          luật, sai sự thật, hoặc không đúng bản chất tuyển dụng thực tế.
        </Section>

        <Section title="4. Thanh toán gói dịch vụ">
          Nhà tuyển dụng có thể đặt mua các gói dịch vụ (đăng tin, tìm kiếm hồ sơ ứng viên...). Ở
          Giai đoạn 1, phương thức thanh toán được xử lý thật là "Hợp đồng + hoá đơn VAT" (quy trình
          thủ công: ký hợp đồng, chuyển khoản ngoài hệ thống, đội ngũ quản trị xác nhận và kích hoạt
          đơn hàng). Các phương thức thanh toán online khác hiển thị trên giao diện nhưng chưa được
          tích hợp thật, sẽ được thông báo rõ khi khả dụng.
        </Section>

        <Section title="5. Giới hạn trách nhiệm">
          Chúng tôi nỗ lực đảm bảo thông tin trên nền tảng chính xác nhưng không đảm bảo tuyệt đối
          về tính đầy đủ, cập nhật của nội dung do bên thứ ba (ứng viên, nhà tuyển dụng) đăng tải.
          Chúng tôi không chịu trách nhiệm về các thoả thuận, kết quả tuyển dụng phát sinh trực tiếp
          giữa ứng viên và nhà tuyển dụng ngoài phạm vi nền tảng.
        </Section>

        <Section title="6. Thay đổi điều khoản">
          Điều khoản này có thể được cập nhật khi dịch vụ bổ sung tính năng mới. Phiên bản mới nhất
          luôn được đăng tại trang này; việc tiếp tục sử dụng dịch vụ sau khi điều khoản được cập
          nhật đồng nghĩa với việc chấp nhận các thay đổi đó.
        </Section>

        <Section title="7. Liên hệ">
          Mọi thắc mắc về điều khoản sử dụng, vui lòng liên hệ qua thông tin hỗ trợ được cung cấp
          trong tài khoản của bạn.
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="font-bold text-ink text-[15px]">{title}</h2>
      <p className="leading-relaxed">{children}</p>
    </section>
  );
}
