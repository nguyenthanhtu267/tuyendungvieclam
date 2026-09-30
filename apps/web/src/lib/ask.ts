import { fold } from './nl-search';

// Đợt 65 — "Hỏi nhanh": trả lời các câu hỏi thường gặp về cách dùng web, theo quy tắc (không gọi AI trả phí).
// Chỉ khớp được các chủ đề đã định nghĩa; không khớp thì trả null để người dùng tìm việc như bình thường.
export interface AskAnswer {
  answer: string;
  link?: { href: string; label: string };
}
const FAQ: { test: RegExp; a: AskAnswer }[] = [
  { test: /quen mat khau|doi mat khau|reset mat khau/, a: { answer: 'Ở trang Đăng nhập, chọn “Quên mật khẩu”, nhập email. Hệ thống gửi liên kết đặt lại mật khẩu (có hạn dùng).', link: { href: '/dang-nhap', label: 'Đến trang đăng nhập' } } },
  { test: /(nop|ung tuyen|apply).*(cv|don|ho so|viec)|cach nop|nop don/, a: { answer: 'Mở tin tuyển dụng, bấm “Ứng tuyển”. Bạn có thể nộp bằng CV đã lưu hoặc tải CV mới, và nộp không cần đăng nhập (nhập họ tên, email, SĐT). Lịch sử đơn xem ở mục Hồ sơ.', link: { href: '/viec-lam', label: 'Tìm việc' } } },
  { test: /(dang|tao).*(tin|tuyen dung)|nha tuyen dung.*dang|tuyen nhan vien/, a: { answer: 'Đăng nhập tài khoản Nhà tuyển dụng, chọn “Đăng tin mới” và điền 4 bước. Tin được kiểm duyệt trước khi hiển thị. Mục “Gợi ý nội dung từ chức danh” giúp viết nhanh.', link: { href: '/nha-tuyen-dung/dashboard', label: 'Khu vực nhà tuyển dụng' } } },
  { test: /lua dao|scam|bi lua|phi ung vien|dat coc/, a: { answer: 'Không nộp tiền đặt cọc/phí hồ sơ cho nhà tuyển dụng. Bấm “Báo cáo tin này” ở cuối phần chi tiết tin nếu thấy dấu hiệu bất thường; quản trị viên sẽ xem xét.', link: { href: '/chinh-sach-bao-mat', label: 'Chính sách bảo mật' } } },
  { test: /(cv|ho so).*(chia se|gui link)|chia se ho so/, a: { answer: 'Vào Hồ sơ → “Chia sẻ hồ sơ tóm tắt” để tạo liên kết xem nhanh (không kèm SĐT/email, hết hạn 14 ngày).', link: { href: '/ho-so', label: 'Đến hồ sơ của tôi' } } },
  { test: /don cua toi|da nop|theo doi don|trang thai don/, a: { answer: 'Mục Hồ sơ có bảng theo dõi đơn ứng tuyển theo 4 cột: Đã nộp, NTD đã xem, Phù hợp/Phỏng vấn, Kết quả.', link: { href: '/ho-so', label: 'Xem đơn của tôi' } } },
  { test: /xoa (tai khoan|du lieu)|quyen rieng tu|du lieu ca nhan/, a: { answer: 'Bạn có thể xem cách chúng tôi xử lý dữ liệu cá nhân và các quyền của bạn (truy cập, sửa, xoá) trong Chính sách bảo mật.', link: { href: '/chinh-sach-bao-mat', label: 'Chính sách bảo mật' } } },
];
export function askQuestion(q: string): AskAnswer | null {
  const f = fold(q);
  if (f.length < 6) return null;
  const isQ = /\?|^(lam sao|cach|the nao|o dau|co the|toi muon|how)/.test(f);
  if (!isQ) return null;
  return FAQ.find((x) => x.test.test(f))?.a ?? null;
}
