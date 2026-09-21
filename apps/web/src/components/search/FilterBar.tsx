'use client';

import { MultiSelectPopover } from './MultiSelectPopover';
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  INDUSTRIES,
  LEVELS,
  PINNED_PROVINCES,
  POSTED_WITHIN_OPTIONS,
  PROVINCE_REGIONS,
  SALARY_TIERS,
} from '@/lib/catalogs';
import type { JobListParams } from '@/lib/api';

// Đợt 10 — thanh lọc nâng cao đầy đủ cho /viec-lam (mục 1 + 2 của đặc tả). Áp dụng lọc ngay khi
// thay đổi giá trị (không có nút "Tìm" riêng cho các ô dropdown/popover) — khớp hành vi careerviet.vn.

const PROVINCE_GROUPS = [
  { label: undefined, options: PINNED_PROVINCES },
  ...PROVINCE_REGIONS.map((r) => ({ label: r.region, options: r.provinces })),
];
const INDUSTRY_GROUPS = [{ label: undefined, options: INDUSTRIES }];

export function FilterBar({
  value,
  onChange,
  onClear,
  searchValue,
  onSearchChange,
  onSearchSubmit,
}: {
  value: JobListParams;
  onChange: (patch: Partial<JobListParams>) => void;
  onClear: () => void;
  // Đợt 12t (21/09/2026) — gộp ô tìm từ khóa + nút "Tìm" vào chung 1 dòng với 2 popover Tỉnh/Thành
  // và Ngành nghề (trước đây tách thành 2 khối trắng xếp chồng, theo yêu cầu người dùng cần 1 dòng
  // duy nhất giống ảnh mẫu). Các prop này optional để FilterBar vẫn dùng được không cần ô từ khóa.
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  onSearchSubmit?: (e: React.FormEvent) => void;
}) {
  const hasAnyFilter =
    (value.provinces?.length ?? 0) > 0 ||
    (value.industries?.length ?? 0) > 0 ||
    !!value.salaryTier ||
    !!value.level ||
    !!value.postedWithin ||
    !!value.employmentType ||
    !!value.experienceLevel ||
    !!value.urgentOnly ||
    !!value.featuredEmployerOnly;

  const showSearchField = onSearchChange !== undefined;

  return (
    <div className="rounded-xl border border-border bg-white p-3.5 flex flex-col gap-3">
      <form
        onSubmit={onSearchSubmit ?? ((e) => e.preventDefault())}
        className="flex flex-col sm:flex-row gap-2.5"
      >
        {showSearchField && (
          <input
            className="tvl-input sm:flex-[1.4] min-w-0"
            placeholder="Chức danh, kỹ năng, tên công ty"
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        )}
        <div className="sm:flex-1 min-w-0">
          <MultiSelectPopover
            label="Tỉnh, Thành Phố"
            placeholder="Tỉnh, Thành Phố"
            groups={PROVINCE_GROUPS}
            selected={value.provinces ?? []}
            onChange={(v) => onChange({ provinces: v })}
            emptyText="Chọn địa điểm"
          />
        </div>
        <div className="sm:flex-1 min-w-0">
          <MultiSelectPopover
            label="Ngành nghề"
            placeholder="Ngành nghề"
            groups={INDUSTRY_GROUPS}
            selected={value.industries ?? []}
            onChange={(v) => onChange({ industries: v })}
            emptyText="Vui lòng chọn ngành nghề"
          />
        </div>
        {showSearchField && (
          <button type="submit" className="tvl-btn-primary !w-auto px-6 shrink-0">
            🔎 Tìm
          </button>
        )}
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <select
          className="tvl-input text-[12.5px]"
          value={value.salaryTier ?? 0}
          onChange={(e) => onChange({ salaryTier: Number(e.target.value) || undefined })}
        >
          {SALARY_TIERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select className="tvl-input text-[12.5px]" value={value.level ?? ''} onChange={(e) => onChange({ level: e.target.value || undefined })}>
          <option value="">Cấp bậc</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          className="tvl-input text-[12.5px]"
          value={value.postedWithin ?? ''}
          onChange={(e) => onChange({ postedWithin: e.target.value || undefined })}
        >
          <option value="">Đăng trong vòng</option>
          {POSTED_WITHIN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="tvl-input text-[12.5px]"
          value={value.employmentType ?? ''}
          onChange={(e) => onChange({ employmentType: e.target.value || undefined })}
        >
          <option value="">Hình thức việc làm</option>
          {EMPLOYMENT_TYPES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          className="tvl-input text-[12.5px]"
          value={value.experienceLevel ?? ''}
          onChange={(e) => onChange({ experienceLevel: e.target.value || undefined })}
        >
          <option value="">Kinh nghiệm làm việc</option>
          {EXPERIENCE_LEVELS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          className="tvl-input text-[12.5px]"
          value={value.urgentOnly ? 'urgent' : ''}
          onChange={(e) => onChange({ urgentOnly: e.target.value === 'urgent' || undefined })}
        >
          <option value="">Chọn việc làm khẩn cấp</option>
          <option value="urgent">Việc làm khẩn cấp</option>
        </select>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
        <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-muted cursor-pointer">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-primary"
            checked={!!value.featuredEmployerOnly}
            onChange={(e) => onChange({ featuredEmployerOnly: e.target.checked || undefined })}
          />
          Doanh nghiệp yêu thích
        </label>
        {hasAnyFilter && (
          <button type="button" onClick={onClear} className="text-[12px] font-bold text-primary hover:underline">
            Xóa bộ lọc
          </button>
        )}
      </div>
    </div>
  );
}
