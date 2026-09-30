// Đợt 64 — cảnh báo tin đáng ngờ cho ứng viên (chạy trên trình duyệt, cùng tinh thần bộ chấm rủi ro của Admin).
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const strip = (h?: string | null) => (h ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');

const PATTERNS: [RegExp, string][] = [
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
  const text = fold(`${job.title} ${strip(job.description)} ${strip(job.requirements)}`);
  for (const [re, why] of PATTERNS) if (re.test(text)) out.push(why);
  const max = job.salaryMax ?? job.salaryMin ?? 0;
  if (max >= 150) out.push(`Mức lương bất thường (${max} triệu)`);
  else if (max >= 80 && /nhan vien|thuc tap|cong tac vien|lao dong/.test(fold(job.title))) out.push('Lương quá cao so với vị trí');
  return out;
}
