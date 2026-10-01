// Đợt 90 — khung xương hiện ngay khi chuyển trang (thay cho màn hình trắng) trong lúc máy chủ chuẩn bị nội dung.
export function PageSkeleton({ variant = 'list' }: { variant?: 'list' | 'detail' | 'form' | 'dashboard' }) {
  const bar = 'rounded bg-surface-alt animate-pulse motion-reduce:animate-none';
  return (
    <div className="max-w-6xl w-full mx-auto px-4 py-6 flex flex-col gap-4" aria-busy="true" aria-label="Đang tải nội dung">
      <div className={`${bar} h-12 w-full`} />
      {variant === 'form' ? (
        <div className="rounded-xl border border-border bg-white p-5 flex flex-col gap-4 max-w-3xl w-full mx-auto">
          <div className={`${bar} h-7 w-1/2`} />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className={`${bar} h-3 w-1/4`} />
              <div className={`${bar} h-11 w-full`} />
            </div>
          ))}
          <div className={`${bar} h-11 w-40`} />
        </div>
      ) : variant === 'dashboard' ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-white p-4 flex flex-col gap-2">
                <div className={`${bar} h-3 w-1/2`} />
                <div className={`${bar} h-7 w-2/3`} />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-white p-4 flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`${bar} h-8 w-full`} />
            ))}
          </div>
        </>
      ) : variant === 'detail' ? (
        <div className="rounded-xl border border-border bg-white p-5 flex flex-col gap-3">
          <div className={`${bar} h-7 w-2/3`} />
          <div className={`${bar} h-4 w-1/3`} />
          <div className={`${bar} h-5 w-1/4`} />
          <div className={`${bar} h-32 w-full`} />
          <div className={`${bar} h-24 w-full`} />
        </div>
      ) : (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-white p-4 flex gap-3">
            <div className={`${bar} w-16 h-16 shrink-0`} />
            <div className="flex-1 flex flex-col gap-2">
              <div className={`${bar} h-4 w-1/2`} />
              <div className={`${bar} h-3 w-1/3`} />
              <div className={`${bar} h-3 w-1/4`} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
