// Đợt 46 — "Trợ lý tin tuyển dụng" chạy trên trình duyệt, không gọi dịch vụ AI trả phí:
//  • summarizeJob: tóm tắt 3 dòng + câu nên hỏi khi phỏng vấn
//  • draftCoverLetter: gợi ý thư ứng tuyển từ hồ sơ + tin
//  • scoreJobQuality: chấm điểm chất lượng tin khi NTD đăng
import type { CompatibilityChecklistItem } from './api';

const decode = (s: string) =>
  s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// Tách HTML/văn bản thành các ý (theo <li>, <p>, xuống dòng, gạch đầu dòng, dấu chấm).
export function toItems(html?: string | null): string[] {
  if (!html) return [];
  const withBreaks = html.replace(/<\s*(li|p|br|div|h\d)[^>]*>/gi, '\n').replace(/<[^>]*>/g, ' ');
  return decode(withBreaks)
    .split(/\n|•|·|;|(?<=[.!?])\s+(?=[A-ZÀ-Ỹ0-9])|\s-\s(?=[A-ZÀ-Ỹ])/)
    .map((t) => t.replace(/^[\s\-–*+•\d.)]+/, '').replace(/\s+/g, ' ').replace(/[.;,:\s]+$/, '').trim())
    .filter((t) => t.length >= 6);
}

const clip = (t: string, n = 110) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);
const lower1 = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

export interface JobLike {
  title: string;
  description?: string | null;
  requirements?: string | null;
  benefits?: string | null;
  experienceLevel?: string | null;
  level?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  employmentType?: string | null;
  workSchedule?: string | null;
  tags?: string[] | null;
  provinces?: string[] | null;
  location?: string | null;
  headcount?: number | null;
  deadline?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  industry?: string | null;
  company?: { name: string } | null;
}

export interface JobSummary {
  lines: { label: string; text: string }[];
  questions: string[];
}

export function summarizeJob(job: JobLike): JobSummary {
  const desc = toItems(job.description);
  const req = toItems(job.requirements);
  const ben = toItems(job.benefits);
  const lines: JobSummary['lines'] = [];
  if (desc.length) lines.push({ label: 'Việc chính', text: clip(desc.slice(0, 2).join('; ')) });
  const exp = job.experienceLevel ? (/kinh nghiệm/i.test(job.experienceLevel) ? job.experienceLevel : `Kinh nghiệm ${lower1(job.experienceLevel)}`) : null;
  const reqBits = [exp, ...req.slice(0, 2)].filter(Boolean) as string[];
  if (reqBits.length) lines.push({ label: 'Cần có', text: clip(reqBits.join('; ')) });
  if (ben.length) lines.push({ label: 'Quyền lợi', text: clip(ben.slice(0, 3).join('; ')) });

  const questions: string[] = [];
  const all = `${job.description ?? ''} ${job.requirements ?? ''} ${job.benefits ?? ''}`.toLowerCase();
  if (!job.salaryMin && !job.salaryMax) questions.push('Mức lương cụ thể cho vị trí này là bao nhiêu và cách tính thưởng?');
  if (!/thử việc/.test(all)) questions.push('Thời gian thử việc bao lâu, lương thử việc bao nhiêu %?');
  if (!/bảo hiểm|bhxh/.test(all)) questions.push('Công ty có đóng BHXH, BHYT trên toàn bộ lương không?');
  if (!job.workSchedule && !/giờ|ca làm|thứ 7|thứ bảy/.test(all)) questions.push('Giờ làm việc và lịch làm thứ Bảy như thế nào?');
  if (desc.length) questions.push(`Một ngày làm việc điển hình ở vị trí "${clip(job.title, 60)}" gồm những việc gì?`);
  if (/doanh số|kpi|chỉ tiêu/.test(all)) questions.push('KPI/doanh số được đặt ra thế nào và bao nhiêu người đạt được?');
  questions.push('Ai sẽ là quản lý trực tiếp và đội ngũ hiện có bao nhiêu người?');
  questions.push('Lộ trình thăng tiến và đánh giá tăng lương diễn ra khi nào?');
  return { lines, questions: questions.slice(0, 5) };
}

export interface LetterProfile {
  fullName?: string | null;
  yearsOfExperience?: number | null;
  profileTitle?: string | null;
  desiredPosition?: string | null;
}

export function draftCoverLetter(job: JobLike, p: LetterProfile | null, checklist?: CompatibilityChecklistItem[]): string {
  const company = job.company?.name ?? 'Quý công ty';
  const name = p?.fullName?.trim() || '[Họ tên của bạn]';
  const years = p?.yearsOfExperience;
  const title = p?.profileTitle || p?.desiredPosition;
  const strengths = (checklist ?? []).filter((c) => c.matched).map((c) => lower1(c.detail || c.label)).slice(0, 3);
  const req = toItems(job.requirements).slice(0, 2).map(lower1);
  const intro = [
    `Kính gửi Bộ phận Tuyển dụng ${company},`,
    '',
    `Tôi là ${name}${title ? `, ${lower1(title)}` : ''}${years ? ` với ${years} năm kinh nghiệm` : ''}. Tôi rất quan tâm đến vị trí "${job.title}" mà công ty đang tuyển.`,
  ];
  const body: string[] = [];
  if (strengths.length) body.push(`Tôi tin mình phù hợp vì: ${strengths.join('; ')}.`);
  else if (req.length) body.push(`Tôi đáp ứng các yêu cầu chính của vị trí như ${req.join('; ')}, và sẵn sàng học hỏi thêm để làm tốt công việc.`);
  else body.push('Tôi có tinh thần trách nhiệm, chủ động trong công việc và sẵn sàng học hỏi để đóng góp cho công ty.');
  body.push(`Tôi mong có cơ hội trao đổi trực tiếp để trình bày rõ hơn về kinh nghiệm và mong muốn gắn bó lâu dài với ${company}.`);
  return [...intro, '', ...body, '', 'Trân trọng,', name].join('\n');
}

export interface QualityCheck {
  ok: boolean;
  label: string;
  tip: string;
  weight: number;
}
export interface QualityResult {
  score: number;
  checks: QualityCheck[];
}

export function scoreJobQuality(job: JobLike): QualityResult {
  const plain = (h?: string | null) => (h ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const checks: QualityCheck[] = [
    { weight: 15, ok: job.title.trim().length >= 8 && job.title.length <= 90, label: 'Tiêu đề rõ ràng (8–90 ký tự)', tip: 'Ghi đúng chức danh, tránh viết hoa toàn bộ hoặc quá dài.' },
    { weight: 20, ok: !!(job.salaryMin || job.salaryMax), label: 'Có mức lương cụ thể', tip: 'Tin ghi rõ lương thường nhận nhiều hồ sơ hơn tin ghi "Cạnh tranh".' },
    { weight: 20, ok: plain(job.description).length >= 200, label: 'Mô tả công việc đủ chi tiết (≥ 200 ký tự)', tip: 'Liệt kê 4–6 đầu việc chính hằng ngày.' },
    { weight: 15, ok: toItems(job.requirements).length >= 2, label: 'Có ít nhất 2 yêu cầu ứng viên', tip: 'Ghi kỹ năng, bằng cấp, kinh nghiệm cần có.' },
    { weight: 15, ok: toItems(job.benefits).length >= 3, label: 'Có ít nhất 3 quyền lợi', tip: 'Nêu BHXH, thưởng, đào tạo, chế độ nghỉ… giúp tin hấp dẫn hơn.' },
    { weight: 5, ok: !!(job.experienceLevel && job.level), label: 'Có kinh nghiệm & cấp bậc', tip: 'Giúp hệ thống gợi ý đúng ứng viên.' },
    { weight: 5, ok: (job.tags?.length ?? 0) >= 2, label: 'Có ít nhất 2 từ khoá (Job tags)', tip: 'Từ khoá giúp tin xuất hiện khi ứng viên tìm kiếm.' },
    { weight: 5, ok: !!(job.contactEmail || job.contactPhone), label: 'Có thông tin liên hệ', tip: 'Ứng viên tin tưởng hơn khi thấy email/số điện thoại.' },
  ];
  const score = checks.reduce((s, c) => s + (c.ok ? c.weight : 0), 0);
  return { score, checks };
}
