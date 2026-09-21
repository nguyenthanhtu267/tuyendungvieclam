'use client';

import { useEffect, useRef } from 'react';

// Đợt 8 — thành phần dùng chung cho các popup sửa từng mục hồ sơ 13 mục (/ho-so/truc-tuyen).
// Mọi form nhập liệu nằm trong Modal (popup) để tôn trọng nguyên tắc "1 khung hình, hạn chế cuộn".

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[88vh] w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} flex-col overflow-hidden rounded-2xl bg-white shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="text-sm font-extrabold text-ink">{title}</h3>
          <button type="button" onClick={onClose} className="text-lg text-ink-faint hover:text-ink">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  // Lỗi đợt 8: KHÔNG bọc <label> quanh khối có nhiều phần tử focus được (ví dụ ChipsInput) — trình
  // duyệt sẽ gán nhãn cho phần tử focus được đầu tiên (nút xoá chip) thay vì ô nhập chính. Khi
  // htmlFor được truyền vào, dùng <label htmlFor> tách rời thay vì bọc.
  if (htmlFor) {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={htmlFor} className="text-xs font-bold text-ink">
          {label} {hint && <span className="font-normal text-ink-faint">({hint})</span>}
        </label>
        {children}
      </div>
    );
  }
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-ink">
        {label} {hint && <span className="font-normal text-ink-faint">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`tvl-input ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`tvl-input min-h-[90px] ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`tvl-input ${props.className ?? ''}`} />;
}

export function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
      <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function ChipsInput({
  value,
  onChange,
  placeholder,
  inputId,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  inputId?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function addFromInput() {
    const v = ref.current?.value.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    if (ref.current) ref.current.value = '';
  }

  return (
    <div className="tvl-input flex flex-wrap items-center gap-1.5">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-0.5 text-[11px] font-semibold text-primary">
          {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="text-primary/70 hover:text-primary">
            ✕
          </button>
        </span>
      ))}
      <input
        id={inputId}
        ref={ref}
        placeholder={placeholder}
        className="min-w-[100px] flex-1 border-none bg-transparent text-sm outline-none"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addFromInput();
          }
        }}
        onBlur={addFromInput}
      />
    </div>
  );
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`tvl-btn-primary !w-auto px-4 ${props.className ?? ''}`} />;
}

export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={`tvl-btn-ghost !w-auto px-4 ${props.className ?? ''}`} />;
}

export function StatusBadge({ status }: { status: 'completed' | 'incomplete' | 'optional' }) {
  const map = {
    completed: { label: 'Hoàn thành', cls: 'bg-success-tint text-success' },
    incomplete: { label: 'Chưa hoàn thành', cls: 'bg-warning-tint text-warning' },
    optional: { label: 'Không bắt buộc', cls: 'bg-surface-alt text-ink-faint' },
  } as const;
  const s = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${s.cls}`}>{s.label}</span>;
}

export function SectionCard({
  id,
  title,
  status,
  tip,
  onEdit,
  editLabel = 'Chỉnh sửa',
  children,
}: {
  id: string;
  title: string;
  status: 'completed' | 'incomplete' | 'optional';
  tip?: string;
  onEdit: () => void;
  editLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-extrabold text-ink">{title}</h2>
          <StatusBadge status={status} />
        </div>
        <GhostButton onClick={onEdit} className="!px-3 !py-1.5 text-xs">
          {editLabel}
        </GhostButton>
      </div>
      {tip && <p className="mt-1.5 text-[11px] text-ink-faint">💡 {tip}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function EmptyBox({ text }: { text: string }) {
  return <div className="rounded-lg bg-surface-alt px-3 py-4 text-center text-xs text-ink-faint">{text}</div>;
}

export function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="w-40 shrink-0 font-semibold text-ink">{label}</span>
      <span className="text-ink-muted">{value || <span className="text-ink-faint">Chưa cập nhật</span>}</span>
    </div>
  );
}

export function ListRow({
  title,
  subtitle,
  meta,
  onEdit,
  onRemove,
}: {
  title: string;
  subtitle?: React.ReactNode;
  meta?: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <div>
        <div className="text-sm font-semibold text-ink">{title}</div>
        {subtitle && <div className="text-xs text-ink-muted">{subtitle}</div>}
        {meta && <div className="text-[11px] text-ink-faint">{meta}</div>}
      </div>
      <div className="flex shrink-0 gap-2 text-xs font-semibold">
        <button type="button" onClick={onEdit} className="text-primary hover:underline">
          Sửa
        </button>
        <button type="button" onClick={onRemove} className="text-critical hover:underline">
          Xóa
        </button>
      </div>
    </div>
  );
}
