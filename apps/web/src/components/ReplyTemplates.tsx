'use client';

import { useState } from 'react';

// Đợt 89 — mẫu trả lời nhanh cho ứng viên (mời phỏng vấn / cần bổ sung / từ chối lịch sự / giữ hồ sơ).
// Điền sẵn tên + vị trí + công ty. Bấm: sao chép nội dung, hoặc mở thư (nếu có email).
type T = { id: string; label: string; subject: (v: V) => string; body: (v: V) => string };
type V = { name: string; job: string; company: string };

const TEMPLATES: T[] = [
  {
    id: 'invite',
    label: 'Mời phỏng vấn',
    subject: (v) => `Thư mời phỏng vấn vị trí ${v.job} — ${v.company}`,
    body: (v) => `Chào ${v.name},\n\nCảm ơn bạn đã ứng tuyển vị trí ${v.job} tại ${v.company}. Chúng tôi ấn tượng với hồ sơ của bạn và muốn mời bạn tham gia phỏng vấn.\n\nThời gian: [điền ngày giờ]\nĐịa điểm: [điền địa chỉ]\nMang theo: CCCD, bản CV mới nhất.\n\nVui lòng phản hồi để xác nhận lịch. Nếu không thuận tiện, bạn cho chúng tôi biết thời gian khác nhé.\n\nTrân trọng,\n${v.company}`,
  },
  {
    id: 'more',
    label: 'Cần bổ sung thông tin',
    subject: (v) => `Bổ sung thông tin hồ sơ ${v.job} — ${v.company}`,
    body: (v) => `Chào ${v.name},\n\nCảm ơn bạn đã quan tâm vị trí ${v.job} tại ${v.company}. Để xem xét hồ sơ, bạn vui lòng bổ sung: [điền nội dung: mức lương mong muốn / kinh nghiệm cụ thể / thời gian có thể đi làm].\n\nBạn phản hồi sớm giúp chúng tôi nhé.\n\nTrân trọng,\n${v.company}`,
  },
  {
    id: 'keep',
    label: 'Giữ hồ sơ, chưa phù hợp lúc này',
    subject: (v) => `Phản hồi hồ sơ ${v.job} — ${v.company}`,
    body: (v) => `Chào ${v.name},\n\nCảm ơn bạn đã dành thời gian ứng tuyển vị trí ${v.job} tại ${v.company}. Hiện hồ sơ của bạn chưa phù hợp hoàn toàn với yêu cầu của vị trí này, nhưng chúng tôi sẽ lưu lại và liên hệ khi có vị trí phù hợp hơn.\n\nChúc bạn sớm tìm được công việc như ý.\n\nTrân trọng,\n${v.company}`,
  },
  {
    id: 'reject',
    label: 'Từ chối lịch sự',
    subject: (v) => `Kết quả ứng tuyển ${v.job} — ${v.company}`,
    body: (v) => `Chào ${v.name},\n\nCảm ơn bạn đã quan tâm và ứng tuyển vị trí ${v.job} tại ${v.company}. Sau khi cân nhắc, chúng tôi chưa thể tiếp tục với hồ sơ của bạn ở vòng này.\n\nChúng tôi trân trọng thời gian bạn dành cho quy trình tuyển dụng và chúc bạn nhiều thành công.\n\nTrân trọng,\n${v.company}`,
  },
];

export function ReplyTemplates({ name, job, company, email }: { name: string; job: string; company: string; email?: string | null }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState('');
  const v: V = { name: name || 'bạn', job: job || 'đã ứng tuyển', company: company || 'chúng tôi' };

  async function copy(t: T) {
    const text = `${t.subject(v)}\n\n${t.body(v)}`;
    try {
      await navigator.clipboard.writeText(text);
      setDone(`Đã sao chép “${t.label}”`);
    } catch {
      setDone('Không sao chép được — hãy dùng nút Mở thư');
    }
    setTimeout(() => setDone(''), 2500);
  }

  return (
    <div className="mt-1 text-[11.5px]">
      <button type="button" onClick={() => setOpen(!open)} className="font-bold text-primary hover:underline">
        ✉ Mẫu trả lời {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1 rounded-md border border-border bg-white p-1.5 max-w-xs">
          {TEMPLATES.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-1">
              <span className="font-semibold text-ink">{t.label}</span>
              <span className="flex gap-1 shrink-0">
                <button type="button" onClick={() => copy(t)} className="rounded border border-border px-1.5 py-0.5 hover:border-primary">Sao chép</button>
                {email && (
                  <a href={`mailto:${email}?subject=${encodeURIComponent(t.subject(v))}&body=${encodeURIComponent(t.body(v))}`} className="rounded border border-primary text-primary px-1.5 py-0.5 hover:bg-primary-tint">Mở thư</a>
                )}
              </span>
            </div>
          ))}
          {done && <div className="text-success font-bold">{done}</div>}
        </div>
      )}
    </div>
  );
}
