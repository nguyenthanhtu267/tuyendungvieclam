import { formatDate } from '@/lib/format';

const STEPS = [
  { key: 'new', label: 'Đã nộp' },
  { key: 'reviewing', label: 'Đang xem xét' },
  { key: 'suitable', label: 'Phù hợp' },
  { key: 'interview', label: 'Phỏng vấn' },
];

// Đợt 43 — thanh tiến trình trạng thái ứng tuyển + nhắc chờ lâu.
export default function ApplicationStepper({ status, appliedAt }: { status: string; appliedAt: string }) {
  const idx = STEPS.findIndex((s) => s.key === status);
  const rejected = status === 'rejected';
  const waitDays = Math.floor((Date.now() - new Date(appliedAt).getTime()) / 86_400_000);
  return (
    <div className="min-w-[210px]">
      <div className="flex items-center" aria-label="Tiến trình ứng tuyển">
        {STEPS.map((s, i) => {
          const done = !rejected && i <= idx;
          return (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <span
                title={s.label}
                className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                  rejected && i === 0 ? 'bg-ink-faint border-ink-faint' : done ? 'bg-primary border-primary' : 'bg-white border-border'
                }`}
              />
              {i < STEPS.length - 1 && (
                <span className={`h-0.5 flex-1 ${!rejected && i < idx ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-ink-muted mt-1 gap-1">
        {STEPS.map((s) => (
          <span key={s.key} className={s.key === status ? 'font-bold text-ink' : ''}>
            {s.label}
          </span>
        ))}
      </div>
      {rejected && <div className="text-[12px] font-semibold text-critical mt-0.5">Không phù hợp lần này</div>}
      {status === 'new' && waitDays >= 7 && (
        <div className="text-[12px] font-semibold text-warning mt-0.5">
          Đã chờ {waitDays} ngày chưa phản hồi · nộp {formatDate(appliedAt)}
        </div>
      )}
    </div>
  );
}
