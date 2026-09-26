'use client';

import { useState } from 'react';
import type { CvArchiveEntryDetail } from '@/lib/api';

// Đợt 18b (26/09/2026) — khối "Nội dung đọc từ file CV" (Kho CV của NTD + màn xem lại của Admin):
// thông tin hệ thống tự tách từ file PDF/DOCX + toàn văn (thu gọn được) để không sót nội dung nào.
const STATUS_TEXT: Record<string, string> = {
  empty: 'File CV không có chữ đọc được (có thể là ảnh scan) — hãy mở file để xem.',
  unsupported: 'Định dạng file (VD .doc đời cũ, ảnh) chưa đọc chữ tự động được — hãy mở file để xem.',
  error: 'Không đọc được nội dung file CV này — hãy mở file để xem.',
};

export function CvFileContent({ entry }: { entry: Pick<CvArchiveEntryDetail, 'cvTextStatus' | 'cvParsed' | 'cvText' | 'cvHasFile' | 'entrySource'> }) {
  const [open, setOpen] = useState(false);
  const status = entry.cvTextStatus;
  if (!status && !entry.cvText) return null;
  const p = entry.cvParsed;
  const facts: [string, string | undefined][] = p
    ? [
        ['Họ tên', p.fullName],
        ['Chức danh', p.headline],
        ['SĐT', p.phone],
        ['Email', p.email],
        ['Ngày sinh', p.dateOfBirth],
        ['Tỉnh/thành', p.province],
        ['Địa chỉ', p.address],
        ['Số năm KN', p.yearsOfExperience != null ? `${p.yearsOfExperience} năm` : undefined],
      ]
    : [];
  const shown = facts.filter(([, v]) => v);

  return (
    <section className="rounded-xl border border-border bg-white p-5">
      <h2 className="text-sm font-extrabold text-ink mb-1">
        {entry.entrySource === 'employer_import' ? 'Nội dung CV (nhập từ nguồn ngoài)' : 'Nội dung đọc từ file CV'}
      </h2>
      <p className="text-[11.5px] text-ink-faint mb-3">
        Hệ thống tự đọc & tách theo quy tắc — có thể chưa chính xác 100%, bản gốc luôn là file CV / toàn văn bên dưới.
      </p>
      {status && status !== 'ok' ? (
        <div className="rounded-lg bg-warning-tint text-warning text-xs font-semibold px-3.5 py-2.5">{STATUS_TEXT[status] ?? STATUS_TEXT.error}</div>
      ) : (
        <div className="flex flex-col gap-3 text-[12.5px]">
          {shown.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-x-6">
              {shown.map(([k, v]) => (
                <div key={k} className="flex gap-2 py-0.5">
                  <span className="w-[90px] shrink-0 font-semibold text-ink">{k}</span>
                  <span className="text-ink-muted break-words min-w-0">{v}</span>
                </div>
              ))}
            </div>
          )}
          {p && p.experiences.length > 0 && (
            <div>
              <div className="font-bold text-ink mb-1">Kinh nghiệm ({p.experiences.length})</div>
              <ul className="flex flex-col gap-1 text-ink-muted">
                {p.experiences.map((x, i) => (
                  <li key={i}>
                    <span className="font-semibold text-ink">{x.position}</span>
                    {x.companyName ? ` — ${x.companyName}` : ''}
                    {x.startDate ? ` (${x.startDate.slice(0, 7)} → ${x.isCurrent ? 'nay' : (x.endDate ?? '').slice(0, 7)})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p && p.educations.length > 0 && (
            <div>
              <div className="font-bold text-ink mb-1">Học vấn ({p.educations.length})</div>
              <ul className="flex flex-col gap-1 text-ink-muted">
                {p.educations.map((x, i) => (
                  <li key={i}>{[x.schoolName, x.degree, x.major].filter(Boolean).join(' · ')}</li>
                ))}
              </ul>
            </div>
          )}
          {p && (p.skills.length > 0 || p.languages.length > 0 || p.certificates.length > 0) && (
            <div className="flex flex-wrap gap-1">
              {[...p.skills, ...p.languages.map((l) => l.language), ...p.certificates].slice(0, 40).map((t, i) => (
                <span key={i} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-surface-alt text-ink-muted">
                  {t}
                </span>
              ))}
            </div>
          )}
          {entry.cvText && (
            <div>
              <button type="button" className="text-xs font-bold text-primary" onClick={() => setOpen((v) => !v)}>
                {open ? '▾ Ẩn toàn văn' : '▸ Xem toàn văn CV'} ({entry.cvText.length.toLocaleString('vi-VN')} ký tự)
              </button>
              {open && (
                <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg bg-surface-alt p-3 text-[12px] leading-relaxed text-ink-muted font-sans">
                  {entry.cvText}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
