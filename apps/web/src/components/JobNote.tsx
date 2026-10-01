'use client';

import { useEffect, useState } from 'react';

// Đợt 105 — ghim tin + ghi chú riêng (vd "gọi lại thứ Hai"). Lưu ở MÁY của bạn (không gửi lên máy chủ). Tin ghim được xếp lên đầu danh sách tìm việc.
const KEY = 'tvl_job_notes';
export type JobNotes = Record<string, { note: string; pinned: boolean }>;
export function readNotes(): JobNotes {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
export function writeNote(id: string, v: { note: string; pinned: boolean } | null) {
  try {
    const all = readNotes();
    if (!v || (!v.note.trim() && !v.pinned)) delete all[id];
    else all[id] = { note: v.note.slice(0, 200), pinned: v.pinned };
    // giữ tối đa 100 mục gần nhất
    const keys = Object.keys(all);
    if (keys.length > 100) delete all[keys[0]];
    localStorage.setItem(KEY, JSON.stringify(all));
    window.dispatchEvent(new Event('tvl-notes'));
  } catch {
    /* bỏ qua */
  }
}
export function useJobNotes(): JobNotes {
  const [n, setN] = useState<JobNotes>({});
  useEffect(() => {
    const f = () => setN(readNotes());
    f();
    window.addEventListener('tvl-notes', f);
    return () => window.removeEventListener('tvl-notes', f);
  }, []);
  return n;
}

export function JobNoteButton({ jobId, light = false }: { jobId: string; light?: boolean }) {
  const notes = useJobNotes();
  const cur = notes[jobId] ?? { note: '', pinned: false };
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  useEffect(() => setText(cur.note), [cur.note]);
  const btn = 'inline-flex items-center justify-center gap-1 h-10 flex-1 basis-0 min-w-[68px] px-2 rounded-full text-[13px] font-bold border whitespace-nowrap ' + (light ? 'bg-surface-alt text-ink border-border' : 'bg-white/15 text-white border-white/30');
  return (
    <>
      <button type="button" onClick={() => setOpen((o) => !o)} className={btn} aria-pressed={cur.pinned}>
        {cur.pinned ? '📌 Đã ghim' : '📌 Ghim'}
      </button>
      {open && (
        <div className={`basis-full rounded-xl bg-white text-ink p-3 flex flex-col gap-2 ${light ? 'border border-border' : ''}`}>
          <textarea id="job-note" className="tvl-input" rows={2} maxLength={200} placeholder="Ghi chú riêng, vd: gọi lại thứ Hai" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" className="tvl-btn-primary !w-auto px-4" onClick={() => { writeNote(jobId, { note: text, pinned: true }); setOpen(false); }}>Ghim & lưu</button>
            {(cur.pinned || cur.note) && <button type="button" className="tvl-btn-ghost !w-auto px-4" onClick={() => { writeNote(jobId, null); setText(''); setOpen(false); }}>Bỏ ghim</button>}
            <button type="button" className="tvl-btn-ghost !w-auto px-4" onClick={() => setOpen(false)}>Đóng</button>
          </div>
        </div>
      )}
    </>
  );
}
