// Đợt 83 — tiện ích web cho kênh lao động phổ thông: chi phí đi lại, danh sách chuẩn bị phỏng vấn,
// kịch bản gọi điện, file lịch (.ics).
import type { WorkerJobCard, WorkerKind } from './api';

/** Chi phí đi lại ước tính (xe máy ~ xăng + hao mòn) — đồng/km. */
export const TRAVEL_VND_PER_KM = 700;
/** Ước tính tiền đi lại mỗi tháng (triệu): đi–về × 26 ngày. Có xe đưa đón thì bằng 0. */
export function travelCostMonth(j: Pick<WorkerJobCard, 'distance' | 'perks' | 'channel'>): number | null {
  if (!j.distance) return null;
  if ((j.perks ?? []).includes('shuttle')) return 0;
  const km = j.distance.km;
  if (!(km > 0)) return null;
  const days = j.channel === 'student' ? 12 : 26;
  return Math.round(((km * 2 * days * TRAVEL_VND_PER_KM) / 1e6) * 10) / 10;
}

const COMMON = ['CCCD/CMND bản gốc để đối chiếu (chỉ đưa xem, KHÔNG để lại giấy tờ gốc)', 'Điện thoại có pin, số điện thoại đã đăng ký', 'Đến sớm 10–15 phút, hỏi rõ địa chỉ cổng vào'];
const BY_KIND: Record<WorkerKind, string[]> = {
  worker: ['Bản sao CCCD, sơ yếu lý lịch hoặc giấy xác nhận nơi cư trú (nếu công ty yêu cầu)', 'Giấy khám sức khoẻ (có thể bổ sung sau khi nhận việc)', 'Trang phục gọn gàng, giày kín mũi', 'Hỏi rõ: lương cơ bản, tăng ca, ngày trả lương, bảo hiểm, chỗ ở/xe đưa đón'],
  student: ['Thẻ sinh viên và lịch học/thi của bạn để xếp ca phù hợp', 'Hỏi rõ: lương theo giờ hay theo ca, ngày trả lương, có được nghỉ mùa thi không', 'Trang phục gọn gàng, lịch sự'],
  intern: ['CV/hồ sơ ngắn (có thể in từ hồ sơ của bạn), thẻ sinh viên', 'Giấy giới thiệu thực tập của trường (nếu có)', 'Hỏi rõ: thời gian thực tập, trợ cấp, người hướng dẫn, có cấp xác nhận/phiếu nhận xét không'],
};
const BY_GROUP: Record<string, string> = {
  'Bảo vệ': 'Hỏi ca trực và nơi nghỉ; chuẩn bị lý lịch rõ ràng.',
  'Lái xe - Giao hàng': 'Mang bằng lái đúng hạng và giấy tờ xe (chỉ đưa xem).',
  'Chế biến thực phẩm': 'Có thể cần giấy khám sức khoẻ; tóc gọn, móng tay sạch.',
  'Điện tử - Lắp ráp': 'Mắt tốt, tay khéo; hỏi rõ ca đêm và xoay ca.',
  'May mặc - Giày da': 'Có thể được thử tay nghề tại chỗ; hỏi rõ định mức sản phẩm.',
  'Phục vụ - Pha chế': 'Mặc trang phục lịch sự; hỏi rõ ca tối/cuối tuần.',
};
export function interviewChecklist(kind: WorkerKind | string | null | undefined, group?: string | null): string[] {
  const k = (['worker', 'student', 'intern'].includes(String(kind)) ? kind : 'worker') as WorkerKind;
  const g = group ? BY_GROUP[group] : undefined;
  return [...COMMON, ...BY_KIND[k], ...(g ? [g] : [])];
}

/** Kịch bản gọi điện cho nhà tuyển dụng: mở đầu, câu sàng lọc, nhắc quyền lợi, chốt lịch. */
export function callScript(kind: WorkerKind, groupHint: string | undefined, name: string, company?: string): string[] {
  const nm = name.trim().split(/\s+/).slice(-1)[0] || name;
  const job = groupHint ? ` vị trí ${groupHint.toLowerCase()}` : '';
  const out = [
    `Mở đầu: “Alo, em chào ${nm} ạ. Em gọi từ ${company ?? 'công ty'}, thấy ${nm} đang tìm việc${job} trên Tuyển Dụng Việc Làm. ${nm} nghe máy được vài phút không ạ?”`,
    kind === 'student'
      ? 'Sàng lọc: đang học trường nào, lịch học/thi thế nào, đi làm được ca nào (tối, cuối tuần), có xe đi lại không?'
      : kind === 'intern'
        ? 'Sàng lọc: ngành học, năm thứ mấy, thực tập được bao lâu, mỗi tuần được mấy buổi, có cần giấy xác nhận của trường không?'
        : 'Sàng lọc: đang ở đâu, có đi được xa không, làm được ca xoay/ca đêm không, đã có kinh nghiệm công việc này chưa, khi nào đi làm được?',
    'Nhắc quyền lợi: lương, tăng ca, ngày trả lương, bảo hiểm, ký túc xá/xe đưa đón nếu có. Nói rõ KHÔNG thu phí, KHÔNG giữ giấy tờ gốc.',
    'Chốt: hẹn ngày giờ và địa điểm phỏng vấn, xin xác nhận “mình đến được không ạ?”, rồi ghi vào Sổ gọi.',
    'Nếu không nghe máy: chọn “Chưa nghe máy”, thử lại sau 1 ngày, hoặc nhắn Zalo giới thiệu ngắn.',
  ];
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');
const icsDate = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const esc = (t: string) => t.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
/** Tải file lịch .ics cho lịch hẹn phỏng vấn (không cần email/thông báo đẩy). */
export function downloadIcs(a: { id: string; title: string; company: string | null; interviewAt: string; interviewPlace?: string | null; workPlace?: string | null }) {
  const start = new Date(a.interviewAt);
  const end = new Date(+start + 60 * 60 * 1000);
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TuyenDungViecLam//VI', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${a.id}@tuyendungvieclam`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(`Phỏng vấn: ${a.title}`)}`, `LOCATION:${esc(a.interviewPlace || a.workPlace || '')}`,
    `DESCRIPTION:${esc(`${a.company ?? ''}\nMang CCCD để đối chiếu, đến sớm 10–15 phút.`)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Sắp đến giờ phỏng vấn', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
  const el = document.createElement('a');
  el.href = url;
  el.download = 'phong-van.ics';
  document.body.appendChild(el);
  el.click();
  el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------- Đợt 84 ----------------
import type { ProfileExtra } from './api';
import { ageOfBirth } from './labor';

/** Cảnh báo nhẹ khi điền hồ sơ (không chặn lưu) — khớp apps/api/src/workers/labor-extra.ts. */
export function profileWarnings(kind: WorkerKind, birthDate: string, extra: ProfileExtra, availability: string[]): string[] {
  const out: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return out;
  const age = ageOfBirth(birthDate);
  if (kind === 'intern' && age > 28) out.push(`Bạn ${age} tuổi — thực tập sinh thường là sinh viên dưới 28 tuổi, kiểm tra lại ngày sinh hoặc nhóm hồ sơ.`);
  if (kind === 'student' && age > 30) out.push(`Bạn ${age} tuổi — nhóm “Sinh viên” thường dưới 30 tuổi, kiểm tra lại ngày sinh.`);
  if (age < 18) out.push('Bạn chưa đủ 18 tuổi: web sẽ ẩn các việc ca đêm/nặng nhọc, và bạn cần người giám hộ đồng ý khi đi làm.');
  if (kind === 'worker' && extra.certs?.length && extra.experience === 'none') out.push('Bạn có chứng chỉ nghề nhưng chọn “chưa có kinh nghiệm” — kiểm tra lại cho đúng.');
  if (kind === 'student' && extra.hours === 'gt25' && availability.length > 0 && availability.length < 8) out.push('Bạn chọn làm trên 25 giờ/tuần nhưng lịch rảnh còn ít — kiểm tra lại.');
  if (kind === 'intern' && extra.sessions && availability.length > 0 && extra.sessions > availability.length / 2 + 0.5) out.push('Số buổi/tuần bạn muốn thực tập nhiều hơn số buổi rảnh đã chọn.');
  return out;
}

/** Gợi ý trả lời phỏng vấn theo nhóm — câu hỏi hay gặp và cách trả lời thật, ngắn gọn. */
export const ANSWER_TIPS: Record<WorkerKind, { q: string; a: string }[]> = {
  worker: [
    { q: 'Bạn có thể đi làm từ ngày nào?', a: 'Nói ngày cụ thể và thật; nếu đang làm nơi khác, nói rõ thời gian báo nghỉ.' },
    { q: 'Bạn làm được ca đêm / tăng ca không?', a: 'Trả lời đúng khả năng. Hỏi lại tăng ca tối đa mấy giờ và tính lương thế nào.' },
    { q: 'Bạn đã làm ở đâu rồi, vì sao nghỉ?', a: 'Nói ngắn, tránh chê chỗ cũ; nêu lý do như xa nhà, hết hợp đồng, muốn thu nhập ổn định.' },
    { q: 'Bạn ở đâu, đi lại bằng gì?', a: 'Nói rõ khoảng cách; nếu cần xe đưa đón/ký túc xá thì hỏi ngay.' },
  ],
  student: [
    { q: 'Lịch học của bạn thế nào?', a: 'Đưa thời khoá biểu, nói rõ buổi trống và tuần thi để được xếp ca hợp lý.' },
    { q: 'Bạn làm được bao nhiêu giờ mỗi tuần?', a: 'Đừng nhận quá sức; nói số giờ chắc chắn giữ được, kể cả mùa thi.' },
    { q: 'Bạn có thể làm lâu dài không?', a: 'Nói thời gian dự kiến (vd đến hết học kỳ/năm) và báo trước khi nghỉ.' },
    { q: 'Lương theo giờ hay theo ca, trả khi nào?', a: 'Hỏi rõ mức/giờ, ngày trả lương, phụ cấp cuối tuần, có được nghỉ mùa thi không.' },
  ],
  intern: [
    { q: 'Vì sao bạn chọn vị trí/ngành này?', a: 'Gắn với môn học hoặc dự án bạn đã làm; nêu 1 điều muốn học được.' },
    { q: 'Bạn thực tập được mấy tháng, mấy buổi/tuần?', a: 'Trả lời đúng theo yêu cầu của trường và lịch học; nói rõ ngày bắt đầu.' },
    { q: 'Bạn biết và làm được gì?', a: 'Kể 2–3 kỹ năng/công cụ cụ thể kèm ví dụ ngắn, không nói chung chung.' },
    { q: 'Công ty có xác nhận thực tập, phiếu nhận xét, trợ cấp không?', a: 'Hỏi lịch sự ở cuối buổi; nếu trường bắt buộc, đưa mẫu của trường.' },
  ],
};
