// Đợt 65 — "Kiểm tra tin trước khi đăng": bắt lỗi ngôn từ phổ biến (phân biệt đối xử, thu phí, quá ngắn, VIẾT HOA...).
// Thuần quy tắc, chạy trên trình duyệt. Chỉ là gợi ý — NTD quyết định cuối cùng.
export interface LintIssue {
  level: 'high' | 'warn';
  text: string;
}
const strip = (h: string) => (h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export interface LintForm {
  title: string; description: string; requirements: string; benefits: string;
  level?: string; experienceLevel?: string; salaryMin?: string; salaryMax?: string; negotiable?: boolean; channel?: string;
}
const LOW_EXP = ['Không yêu cầu kinh nghiệm', 'Chưa có kinh nghiệm', 'Đến dưới 1 năm'];
const HIGH_EXP = ['Từ 5 đến 7 năm', 'Từ 7 đến 10 năm', 'Từ 11 năm'];

export function lintJob(f: LintForm): LintIssue[] {
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
  // Đợt 87 — kiểm tra mâu thuẫn giữa các trường (chỉ với tin văn phòng/chuyên môn)
  if (!f.channel || f.channel === 'office') {
    const lvl = f.level ?? '';
    const exp = f.experienceLevel ?? '';
    const isMgr = /quản lý|điều hành|trưởng/i.test(lvl);
    if (isMgr && LOW_EXP.includes(exp)) out.push({ level: 'warn', text: `Cấp bậc “${lvl}” nhưng kinh nghiệm “${exp}” — thường không khớp, ứng viên sẽ nghi ngờ hoặc nộp sai đối tượng.` });
    if (/sinh viên|thực tập/i.test(lvl) && HIGH_EXP.includes(exp)) out.push({ level: 'warn', text: `Cấp bậc “${lvl}” nhưng yêu cầu “${exp}” — hai thông tin mâu thuẫn.` });
    if (/không (cần|yêu cầu) kinh nghiệm|chưa có kinh nghiệm cũng/i.test(all) && HIGH_EXP.includes(exp)) out.push({ level: 'warn', text: 'Mô tả nói “không cần kinh nghiệm” nhưng mục Kinh nghiệm lại yêu cầu nhiều năm.' });
    const mn = Number(f.salaryMin) || 0;
    const mx = Number(f.salaryMax) || 0;
    if (!f.negotiable && mn && mx && mn > mx) out.push({ level: 'high', text: 'Lương tối thiểu đang lớn hơn lương tối đa.' });
    if (!f.negotiable && mn && mx && mx / mn > 3) out.push({ level: 'warn', text: `Khung lương quá rộng (${mn}–${mx} triệu), ứng viên khó tin — nên thu hẹp.` });
    if (!f.negotiable && (mx || mn) && isMgr && (mx || mn) < 12) out.push({ level: 'warn', text: 'Mức lương khá thấp so với cấp bậc quản lý — dễ ít người nộp.' });
    if (f.negotiable && /quản lý|điều hành/i.test(lvl) === false && !mn && !mx) out.push({ level: 'warn', text: 'Chọn “Thoả thuận” — tin ghi rõ lương thường nhận nhiều đơn hơn.' });
  }
  return out;
}
