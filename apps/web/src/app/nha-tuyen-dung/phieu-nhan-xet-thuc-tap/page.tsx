'use client';

import { useState } from 'react';
import EmployerHeader from '@/components/EmployerHeader';

const CRITERIA = [
  'Chấp hành nội quy, giờ giấc',
  'Thái độ, tinh thần học hỏi',
  'Kiến thức chuyên môn áp dụng vào công việc',
  'Kỹ năng thực hành / tay nghề',
  'Kỹ năng giao tiếp, làm việc nhóm',
  'Mức độ hoàn thành công việc được giao',
];

// Đợt 80 — mẫu phiếu nhận xét thực tập in được (điền trên web rồi bấm In / lưu PDF), theo bố cục thường gặp
// của các trường: thông tin SV, thời gian thực tập, chấm điểm theo tiêu chí (thang 10), nhận xét, ký tên đóng dấu.
export default function InternEvaluationPage() {
  const [f, setF] = useState({ company: '', student: '', studentId: '', school: '', major: '', dept: '', mentor: '', from: '', to: '', comment: '', place: '', date: '' });
  const [scores, setScores] = useState<string[]>(CRITERIA.map(() => ''));
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const nums = scores.filter((x) => x.trim() !== '').map((x) => Number(x.replace(',', '.'))).filter((x) => x >= 0 && x <= 10 && !Number.isNaN(x));
  const avg = nums.length === CRITERIA.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
  const rank = avg == null ? '' : avg >= 9 ? 'Xuất sắc' : avg >= 8 ? 'Giỏi' : avg >= 6.5 ? 'Khá' : avg >= 5 ? 'Trung bình' : 'Chưa đạt';
  const line = 'border-0 border-b border-dotted border-ink bg-white px-1 py-0.5 text-[15px] text-ink focus:outline-none print:border-b';
  const field = (k: keyof typeof f, ph: string, w = 'w-full') => <input id={`pn-${k}`} aria-label={ph} placeholder={ph} className={`${line} ${w}`} value={f[k]} onChange={(e) => set(k, e.target.value)} />;
  return (
    <main className="min-h-screen">
      <div className="print:hidden"><EmployerHeader /></div>
      <div className="max-w-3xl mx-3 sm:mx-auto my-3 flex flex-col gap-2">
        <div className="print:hidden flex flex-wrap items-center justify-between gap-2">
          <h1 className="tvl-title font-extrabold text-[18px] text-ink">Phiếu nhận xét thực tập — điền rồi bấm In</h1>
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-primary text-white font-bold text-[14px] px-4 py-2">In / Lưu PDF</button>
        </div>
        <article id="print-area" className="rounded-xl border border-border bg-white p-6 sm:p-8 text-ink print:border-0 print:p-0">
          <div className="grid grid-cols-2 gap-4 text-center text-[13.5px]">
            <div>
              <div className="font-bold uppercase">{f.company || 'Tên cơ quan, doanh nghiệp'}</div>
              <div>———</div>
            </div>
            <div>
              <div className="font-bold uppercase">Cộng hoà xã hội chủ nghĩa Việt Nam</div>
              <div className="font-bold">Độc lập – Tự do – Hạnh phúc</div>
              <div>———</div>
            </div>
          </div>
          <h2 className="text-center font-extrabold text-[20px] uppercase mt-5">Phiếu nhận xét thực tập</h2>
          <div className="flex flex-col gap-2 mt-4 text-[15px]">
            <div className="flex gap-2 items-end"><span className="shrink-0">Đơn vị thực tập:</span>{field('company', 'Tên doanh nghiệp')}</div>
            <div className="flex gap-2 items-end"><span className="shrink-0">Họ tên sinh viên:</span>{field('student', 'Họ và tên')}<span className="shrink-0">MSSV:</span>{field('studentId', 'MSSV', 'w-32')}</div>
            <div className="flex gap-2 items-end"><span className="shrink-0">Trường:</span>{field('school', 'Tên trường')}<span className="shrink-0">Ngành:</span>{field('major', 'Ngành', 'w-48')}</div>
            <div className="flex gap-2 items-end"><span className="shrink-0">Bộ phận thực tập:</span>{field('dept', 'Phòng/ban')}<span className="shrink-0">Người hướng dẫn:</span>{field('mentor', 'Họ tên', 'w-48')}</div>
            <div className="flex gap-2 items-end"><span className="shrink-0">Thời gian: từ</span>{field('from', 'dd/mm/yyyy', 'w-36')}<span className="shrink-0">đến</span>{field('to', 'dd/mm/yyyy', 'w-36')}</div>
          </div>
          <table className="w-full mt-4 text-[14.5px] border border-ink border-collapse">
            <thead>
              <tr><th className="border border-ink p-1.5 w-10">STT</th><th className="border border-ink p-1.5 text-left">Tiêu chí đánh giá</th><th className="border border-ink p-1.5 w-28">Điểm (thang 10)</th></tr>
            </thead>
            <tbody>
              {CRITERIA.map((c, i) => (
                <tr key={c}>
                  <td className="border border-ink p-1.5 text-center">{i + 1}</td>
                  <td className="border border-ink p-1.5">{c}</td>
                  <td className="border border-ink p-1 text-center">
                    <input aria-label={`Điểm ${c}`} inputMode="decimal" className="w-16 text-center bg-white text-[15px] focus:outline-none" value={scores[i]} onChange={(e) => setScores((s) => s.map((x, j) => (j === i ? e.target.value : x)))} />
                  </td>
                </tr>
              ))}
              <tr>
                <td className="border border-ink p-1.5" />
                <td className="border border-ink p-1.5 font-bold">Điểm trung bình — Xếp loại</td>
                <td className="border border-ink p-1.5 text-center font-bold">{avg != null ? `${avg} — ${rank}` : ''}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 text-[15px]">
            <div>Nhận xét chung của đơn vị:</div>
            <textarea aria-label="Nhận xét" rows={5} className="w-full mt-1 border border-dotted border-ink bg-white p-2 text-[15px] focus:outline-none" value={f.comment} onChange={(e) => set('comment', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6 text-center text-[14.5px]">
            <div>
              <div className="font-bold">Người hướng dẫn</div>
              <div className="italic text-[13px]">(Ký, ghi rõ họ tên)</div>
              <div className="h-20" />
              <div>{f.mentor}</div>
            </div>
            <div>
              <div className="flex gap-1 justify-center items-end">{field('place', 'Địa danh', 'w-28')}<span>, ngày</span>{field('date', 'dd/mm/yyyy', 'w-32')}</div>
              <div className="font-bold mt-1">Xác nhận của đơn vị</div>
              <div className="italic text-[13px]">(Ký tên, đóng dấu)</div>
              <div className="h-20" />
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
