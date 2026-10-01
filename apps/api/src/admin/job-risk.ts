// Đợt 42 — chấm điểm "rủi ro" của tin tuyển dụng bằng quy tắc (không gọi dịch vụ ngoài) để Admin thấy
// ngay tin khả nghi/trùng lặp trong hàng chờ duyệt. Điểm ≥ RISK_THRESHOLD: không được tự động duyệt.
export const RISK_THRESHOLD = 40;

export interface RiskJob {
  id: string;
  companyId: string;
  title: string;
  description?: string | null;
  requirements?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactName?: string | null;
}
export interface RiskContext {
  // Tin khác (đang chờ/đã duyệt) để so trùng
  others: RiskJob[];
}
export interface RiskResult {
  score: number;
  level: 'low' | 'medium' | 'high';
  reasons: string[];
}

const strip = (h?: string | null) => (h ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
export const fold = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Đợt 80 — bỏ các cụm phủ định ("không thu phí", "không giữ giấy tờ"...) trước khi dò để tránh báo nhầm.
export const dropNegations = (t: string) => t.replace(/\bkhong (?:thu|nop|dong|giu|dat|yeu cau|mat|lay)\b[a-z ]{0,12}/g, ' ');

const SCAM_PATTERNS: [RegExp, string][] = [
  // Đợt 80 — dấu hiệu lừa đảo hay gặp ở tin lao động phổ thông
  [/giu (?:cccd|can cuoc|cmnd|chung minh|bang goc|giay to goc|so ho khau)|nop (?:cccd|can cuoc|cmnd) (?:ban )?goc/, 'Yêu cầu giữ CCCD / giấy tờ gốc'],
  [/(?:phi|tien|coc) dong phuc|dong phuc .{0,12}(?:tu tra|tru luong truoc)|phi gioi thieu|phi moi gioi|phi xuat (?:khau|canh)|phi giu cho/, 'Thu tiền đồng phục / phí giới thiệu, môi giới'],
  [/dat coc|nop phi|phi nhan viec|dong phi|thu phi (?:dao tao|ho so)|phi ho so|mua bo ho so/, 'Yêu cầu đặt cọc / nộp phí'],
  [/viec nhe luong cao|luong cao (?:khong can|de dang)|khong can (?:bang cap|kinh nghiem).{0,30}luong .{0,10}(?:trieu|tr)/, 'Cam kết "việc nhẹ lương cao"'],
  [/kiem tien online|lam giau nhanh|nap tien|dau tu sinh loi|da cap|chot don online tai nha thu nhap/, 'Dấu hiệu lừa đảo / đa cấp'],
  [/telegram|t\.me\/|zalo group|nhom kin/, 'Yêu cầu liên hệ qua nhóm kín (Telegram/Zalo)'],
];

export function assessJobRisk(job: RiskJob, ctx: RiskContext): RiskResult {
  let score = 0;
  const reasons: string[] = [];
  const add = (n: number, why: string) => {
    score += n;
    reasons.push(why);
  };

  const text = dropNegations(fold(`${job.title} ${strip(job.description)} ${strip(job.requirements)}`));
  for (const [re, why] of SCAM_PATTERNS) if (re.test(text)) add(re.source.includes('dat coc') ? 45 : 35, why);

  const max = job.salaryMax ?? job.salaryMin ?? 0;
  if (job.salaryMin && job.salaryMax && job.salaryMin > job.salaryMax) add(15, 'Lương tối thiểu lớn hơn lương tối đa');
  if (max >= 150) add(35, `Mức lương bất thường (${max} triệu)`);
  else if (max >= 80 && /nhan vien|thuc tap|cong tac vien|phu|lao dong/.test(fold(job.title))) add(25, `Lương ${max} triệu quá cao so với vị trí`);

  if (!job.contactEmail && !job.contactPhone) add(10, 'Không có thông tin liên hệ');
  const descLen = strip(job.description).trim().length;
  if (descLen < 60) add(15, 'Mô tả công việc quá ngắn');

  const ft = fold(job.title);
  const fd = fold(strip(job.description)).slice(0, 240);
  const dupSame = ctx.others.find((o) => o.id !== job.id && o.companyId === job.companyId && fold(o.title) === ft);
  if (dupSame) add(20, 'Trùng tiêu đề với tin khác của cùng công ty');
  if (fd.length >= 120) {
    const copied = ctx.others.find((o) => o.id !== job.id && o.companyId !== job.companyId && fold(strip(o.description)).slice(0, 240) === fd);
    if (copied) add(40, 'Nội dung mô tả trùng với tin của công ty khác');
    else if (ctx.others.some((o) => o.id !== job.id && o.companyId === job.companyId && fold(strip(o.description)).slice(0, 240) === fd))
      add(15, 'Nội dung mô tả trùng với tin khác cùng công ty');
  }

  score = Math.min(100, score);
  return { score, level: score >= 60 ? 'high' : score >= RISK_THRESHOLD ? 'medium' : 'low', reasons };
}
