'use client';

import { useRef, useState } from 'react';
import { cvParseApi, smartApi2, type CvParseResult } from '@/lib/api';

// Đợt 64 — ứng viên tải CV (PDF/Word) → hệ thống tách sẵn → xem lại → điền vào hồ sơ (chỉ chỗ còn trống).
export default function CvAutofill({ token, onDone }: { token: string; onDone?: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<CvParseResult | null>(null);
  const [msg, setMsg] = useState('');

  async function pick(f?: File | null) {
    if (!f) return;
    setBusy(true);
    setMsg('');
    setRes(null);
    try {
      const r = await cvParseApi.file(token, f);
      if (r.status !== 'ok' || !r.parsed) setMsg(r.warning || 'Không đọc được nội dung file này. Thử file PDF/Word có chữ (không phải ảnh chụp).');
      else setRes(r);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Không đọc được file CV.');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }
  async function apply() {
    if (!res?.parsed) return;
    setBusy(true);
    try {
      const r = await smartApi2.autofill(token, res.parsed);
      setMsg(r.filled.length ? `Đã điền: ${r.filled.join(', ')}. Các mục đã có dữ liệu được giữ nguyên.` : 'Hồ sơ của bạn đã đủ thông tin nên không có gì cần điền thêm.');
      setRes(null);
      onDone?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Không điền được hồ sơ.');
    } finally {
      setBusy(false);
    }
  }
  const p = res?.parsed;
  return (
    <div className="rounded-xl border border-dashed border-primary bg-primary-tint/40 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-extrabold text-[14px]">✨ Tự điền hồ sơ từ CV</div>
          <div className="text-[12.5px] text-ink-muted">Tải CV có sẵn (PDF/Word), hệ thống tách thông tin để bạn xem lại rồi điền vào hồ sơ. Chỉ điền vào chỗ còn trống.</div>
        </div>
        <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="tvl-btn-primary !w-auto px-4 disabled:opacity-60">
          {busy ? 'Đang xử lý…' : 'Chọn file CV'}
        </button>
        <input id="cv-autofill-file" ref={ref} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {msg && <div className="mt-2 text-[13px] font-semibold text-ink">{msg}</div>}
      {p && (
        <div className="mt-3 rounded-lg bg-white border border-border p-3 text-[13px] flex flex-col gap-1">
          <div className="font-bold">Đã đọc được từ CV:</div>
          {p.fullName && <div>Họ tên: <b>{p.fullName}</b></div>}
          {p.phone && <div>Điện thoại: {p.phone}</div>}
          {p.province && <div>Tỉnh/thành: {p.province}</div>}
          {p.yearsOfExperience != null && <div>Kinh nghiệm: {p.yearsOfExperience} năm</div>}
          {p.skills.length > 0 && <div>Kỹ năng ({p.skills.length}): {p.skills.slice(0, 10).join(', ')}</div>}
          {p.experiences.length > 0 && <div>Kinh nghiệm làm việc: {p.experiences.length} vị trí (gần nhất: {p.experiences[0].position})</div>}
          {p.educations.length > 0 && <div>Học vấn: {p.educations.length} mục</div>}
          <div className="flex gap-2 mt-2">
            <button type="button" disabled={busy} onClick={apply} className="tvl-btn-primary !w-auto px-4">Điền vào hồ sơ</button>
            <button type="button" onClick={() => setRes(null)} className="tvl-btn-ghost !w-auto px-4">Bỏ qua</button>
          </div>
        </div>
      )}
    </div>
  );
}
