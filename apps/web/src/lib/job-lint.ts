// Đợt 65 — "Kiểm tra tin trước khi đăng": bắt lỗi ngôn từ phổ biến (phân biệt đối xử, thu phí, quá ngắn, VIẾT HOA...).
// Thuần quy tắc, chạy trên trình duyệt. Chỉ là gợi ý — NTD quyết định cuối cùng.
export interface LintIssue {
  level: 'high' | 'warn';
  text: string;
}
const strip = (h: string) => (h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function lintJob(f: { title: string; description: string; requirements: string; benefits: string }): LintIssue[] {
  const out: LintIssue[] = [];
  const title = f.title || '';
  const all = `${title} ${strip(f.description)} ${strip(f.requirements)} ${strip(f.benefits)}`.toLowerCase();

  if (/(chỉ tuyển|chỉ nhận|ưu tiên)\s*(nam|nữ)\b|\b(nam|nữ)\s*(dưới|trên|từ)\s*\d{2}\s*tuổi|ngoại hình|ưa nhìn|không nhận\s+(nam|nữ)/i.test(all))
    out.push({ level: 'high', text: 'Có nội dung dễ bị coi là phân biệt giới tính/tuổi/ngoại hình. Chỉ nêu yêu cầu này nếu tính chất công việc bắt buộc, và nên diễn đạt theo năng lực.' });
  if (/đặt cọc|nộp phí|phí (hồ sơ|đào tạo|giữ chỗ)|mua (đồng phục|hàng) trước|chuyển khoản trước/i.test(all))
    out.push({ level: 'high', text: 'Có cụm từ liên quan thu phí ứng viên. Tin kiểu này dễ bị báo cáo lừa đảo và có thể bị ẩn.' });
  if (/thu nhập\s*(lên tới|trên)?\s*\d+\s*(tr|triệu)?\s*\/?\s*(ngày|tuần)|việc nhẹ lương cao|không cần kinh nghiệm.*lương\s*(cao|\d{2})/i.test(all))
    out.push({ level: 'warn', text: 'Cách nói "việc nhẹ lương cao" thường khiến ứng viên nghi ngờ. Hãy nêu rõ mức lương thật và điều kiện nhận.' });
  const letters = title.replace(/[^A-Za-zÀ-ỹ]/g, '');
  if (letters.length > 6 && title === title.toUpperCase()) out.push({ level: 'warn', text: 'Chức danh viết HOA toàn bộ, nên viết thường để dễ đọc và không bị coi là spam.' });
  if (/[!]{2,}|[$]{2,}|🔥{2,}/.test(title)) out.push({ level: 'warn', text: 'Chức danh có nhiều dấu chấm than/ký hiệu, nên bỏ.' });
  if (strip(f.description).length < 80) out.push({ level: 'warn', text: 'Mô tả công việc còn ngắn (dưới 80 ký tự), ứng viên khó hình dung công việc.' });
  if (strip(f.requirements).length < 40) out.push({ level: 'warn', text: 'Yêu cầu ứng viên còn ngắn hoặc để trống.' });
  if (/(\+?84|0)\s?\d{2,3}[\s.]?\d{3}[\s.]?\d{3,4}/.test(strip(f.description)) || /\bzalo\b|@\w+\.\w+/i.test(strip(f.description)))
    out.push({ level: 'warn', text: 'Mô tả đang chứa số điện thoại/email/Zalo. Hãy điền vào mục "Thông tin liên hệ" để không trùng và dễ ẩn/hiện.' });
  if (strip(f.benefits).length < 20) out.push({ level: 'warn', text: 'Chưa có quyền lợi rõ ràng, tin có quyền lợi thường nhận nhiều đơn hơn.' });
  return out;
}
