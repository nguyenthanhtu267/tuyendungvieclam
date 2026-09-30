// Đợt 64 — Chuẩn bị phỏng vấn: từ tin + hồ sơ, gợi ý câu hỏi có thể gặp và ý trả lời dựa trên kinh nghiệm của ứng viên.
import { toItems } from './job-insights';

export interface PrepProfile {
  fullName?: string | null;
  yearsOfExperience?: number | null;
  desiredPosition?: string | null;
  profileTitle?: string | null;
  skillNames?: string[];
  lastCompany?: string | null;
  lastPosition?: string | null;
}
export interface PrepJob {
  title: string;
  requirements?: string | null;
  description?: string | null;
  tags?: string[] | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  company?: { name: string } | null;
}
export interface PrepItem {
  q: string;
  hint: string;
}
const low1 = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const clip = (t: string, n = 90) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);

export function interviewPrep(job: PrepJob, p: PrepProfile | null): PrepItem[] {
  const company = job.company?.name ?? 'công ty';
  const yrs = p?.yearsOfExperience;
  const have = new Set((p?.skillNames ?? []).map((s) => s.toLowerCase()));
  const tags = (job.tags ?? []).filter(Boolean);
  const matched = tags.filter((t) => have.has(t.toLowerCase()));
  const missing = tags.filter((t) => !have.has(t.toLowerCase()));
  const req = toItems(job.requirements);
  const items: PrepItem[] = [];

  items.push({
    q: 'Hãy giới thiệu ngắn về bản thân.',
    hint: `Nói 3 ý trong ~1 phút: bạn là ai${p?.profileTitle || p?.desiredPosition ? ` (${low1(p.profileTitle || p.desiredPosition || '')})` : ''}${yrs != null ? `, ${yrs} năm kinh nghiệm` : ''}; thành tích nổi bật nhất${p?.lastCompany ? ` tại ${p.lastCompany}` : ''}; vì sao muốn làm "${clip(job.title, 50)}".`,
  });
  items.push({
    q: `Vì sao bạn muốn làm việc tại ${company}?`,
    hint: `Tìm hiểu trước sản phẩm/dịch vụ của ${company} và nêu 1 điều bạn thích cụ thể, gắn với vị trí này. Tránh nói chỉ vì lương hay gần nhà.`,
  });
  if (matched.length)
    items.push({
      q: `Bạn đã dùng ${matched.slice(0, 2).join(' / ')} vào việc gì?`,
      hint: `Chuẩn bị 1 ví dụ thật: bài toán, cách bạn làm với ${matched[0]}, kết quả đo được (con số, thời gian tiết kiệm).${p?.lastPosition ? ` Có thể lấy từ vị trí ${p.lastPosition}.` : ''}`,
    });
  if (missing.length)
    items.push({
      q: `Tin yêu cầu ${missing.slice(0, 2).join(', ')} — bạn đã có kinh nghiệm chưa?`,
      hint: 'Nếu chưa: nói thẳng, kèm kỹ năng gần nhất bạn có và kế hoạch học (thời gian, nguồn học). Nhà tuyển dụng đánh giá cao sự trung thực và khả năng học nhanh.',
    });
  if (req[0])
    items.push({
      q: `Yêu cầu "${clip(req[0], 70)}" — bạn đáp ứng thế nào?`,
      hint: 'Trả lời theo mẫu: tình huống → việc bạn làm → kết quả. Chọn ví dụ gần nhất trong 2 năm.',
    });
  items.push({
    q: 'Điểm mạnh và điểm yếu của bạn là gì?',
    hint: 'Điểm mạnh: chọn cái liên quan trực tiếp tới tin, kèm ví dụ. Điểm yếu: một điểm thật, không quan trọng với vị trí, và cách bạn đang cải thiện.',
  });
  items.push({
    q: 'Mức lương bạn mong muốn?',
    hint: job.salaryMax
      ? `Tin ghi ${job.salaryMin ?? ''}${job.salaryMin ? '–' : ''}${job.salaryMax} triệu. Nêu khoảng (không phải 1 con số) và lý do dựa trên kinh nghiệm; xem khối "Lương thương lượng" ở cột phải.`
      : 'Tin ghi "Thoả thuận": nêu một khoảng dựa trên mặt bằng thị trường (xem khối "Lương thương lượng" ở cột phải) và kinh nghiệm của bạn.',
  });
  items.push({
    q: 'Bạn có câu hỏi nào cho chúng tôi không?',
    hint: 'Luôn hỏi 2 câu: kỳ vọng ở 3 tháng đầu, và cách đánh giá hiệu quả công việc. Đừng hỏi lương/nghỉ phép đầu tiên.',
  });
  return items.slice(0, 8);
}
