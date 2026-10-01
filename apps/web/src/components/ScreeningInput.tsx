'use client';

// Đợt 78 — câu hỏi sàng lọc Có/Không của nhà tuyển dụng, hiện trong form ứng tuyển.
export default function ScreeningInput({ questions, value, onChange }: { questions: { q: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  if (!questions.length) return null;
  return (
    <fieldset className="rounded-lg border border-border bg-surface-alt p-3 flex flex-col gap-2.5">
      <legend className="px-1 text-xs font-bold text-primary">Câu hỏi của nhà tuyển dụng (bắt buộc)</legend>
      {questions.map((x, i) => (
        <div key={i} className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[14px] text-ink flex-1 min-w-[200px]">{x.q}</span>
          <span className="flex gap-3 text-[14px] font-semibold">
            {(['yes', 'no'] as const).map((v) => (
              <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name={`screen-${i}`} checked={value[i] === v} onChange={() => onChange(questions.map((_, j) => (j === i ? v : value[j] ?? '')))} />
                {v === 'yes' ? 'Có' : 'Không'}
              </label>
            ))}
          </span>
        </div>
      ))}
    </fieldset>
  );
}
