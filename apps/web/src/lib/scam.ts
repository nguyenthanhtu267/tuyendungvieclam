// Đợt 64 — cảnh báo tin đáng ngờ cho ứng viên (chạy trên trình duyệt, cùng tinh thần bộ chấm rủi ro của Admin).
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const strip = (h?: string | null) => (h ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');

// Đợt 80 — bỏ các cụm phủ định ("không thu phí", "không giữ giấy tờ"...) trước khi dò để tránh báo nhầm.
export const dropNegations = (t: string) => t.replace(/\bkhong (?:thu|nop|dong|giu|dat|yeu cau|mat|lay)\b[a-z ]{0,12}/g, ' ');

const PATTERNS: [RegExp, string][] = [
  // Đợt 80 — dấu hiệu lừa đảo hay gặp ở tin lao động phổ thông
  [/giu (?:cccd|can cuoc|cmnd|chung minh|bang goc|giay to goc|so ho khau)|nop (?:cccd|can cuoc|cmnd) (?:ban )?goc/, 'Yêu cầu giữ CCCD / giấy tờ gốc'],
  [/(?:phi|tien|coc) dong phuc|dong phuc .{0,12}(?:tu tra|tru luong truoc)|phi gioi thieu|phi moi gioi|phi xuat (?:khau|canh)|phi giu cho/, 'Thu tiền đồng phục / phí giới thiệu, môi giới'],
  [/dat coc|nop phi|phi nhan viec|dong phi|thu phi (?:dao tao|ho so)|phi ho so|mua bo ho so/, 'Yêu cầu đặt cọc hoặc nộp phí trước khi nhận việc'],
  [/viec nhe luong cao|luong cao (?:khong can|de dang)/, 'Hứa hẹn "việc nhẹ lương cao"'],
  [/kiem tien online|lam giau nhanh|nap tien|dau tu sinh loi|da cap/, 'Có dấu hiệu lừa đảo / đa cấp'],
  [/telegram|t me|zalo group|nhom kin/, 'Yêu cầu liên hệ qua nhóm kín (Telegram/Zalo)'],
];
export interface ScamJob {
  title: string;
  description?: string | null;
  requirements?: string | null;
  salaryMax?: number | null;
  salaryMin?: number | null;
}
export function scamWarnings(job: ScamJob): string[] {
  const out: string[] = [];
  const text = dropNegations(fold(`${job.title} ${strip(job.description)} ${strip(job.requirements)}`));
  for (const [re, why] of PATTERNS) if (re.test(text)) out.push(why);
  const max = job.salaryMax ?? job.salaryMin ?? 0;
  if (max >= 150) out.push(`Mức lương bất thường (${max} triệu)`);
  else if (max >= 80 && /nhan vien|thuc tap|cong tac vien|lao dong/.test(fold(job.title))) out.push('Lương quá cao so với vị trí');
  return out;
}
