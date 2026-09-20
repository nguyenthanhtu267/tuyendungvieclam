'use client';

import { useRef } from 'react';

// Đợt 10 mục 3 — hàng chip quận/huyện kèm số lượng, cuộn ngang, nút "›" để cuộn tiếp.
export function DistrictChips({
  districts,
  selected,
  onSelect,
}: {
  districts: { district: string; count: number }[];
  selected?: string;
  onSelect: (district: string | undefined) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (districts.length === 0) return null;

  function scrollNext() {
    scrollRef.current?.scrollBy({ left: 220, behavior: 'smooth' });
  }

  return (
    <div className="flex items-center gap-1.5 mt-2.5">
      <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto scroll-smooth py-0.5 flex-1 no-scrollbar">
        {districts.map((d) => (
          <button
            key={d.district}
            type="button"
            onClick={() => onSelect(selected === d.district ? undefined : d.district)}
            className={`shrink-0 whitespace-nowrap text-[11.5px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              selected === d.district
                ? 'bg-primary text-white border-primary'
                : 'border-border-strong text-ink-muted hover:border-primary'
            }`}
          >
            {d.district} ({d.count})
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={scrollNext}
        className="shrink-0 w-6 h-6 rounded-full border border-border-strong text-ink-faint flex items-center justify-center hover:border-primary hover:text-primary"
        aria-label="Cuộn tiếp"
      >
        ›
      </button>
    </div>
  );
}
