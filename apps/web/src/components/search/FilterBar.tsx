'use client';
import { useState } from 'react';
import { dismissKeyboard } from '@/lib/mobile-ui';
import SearchHints from '@/components/SearchHints';
import { rememberSearch } from '@/lib/search-hints';
import { nearestProvince, saveHome } from '@/lib/geo';

import { MultiSelectPopover } from './MultiSelectPopover';
import { usePins } from '@/lib/pins';
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
import { VoiceSearchButton } from '@/components/VoiceSearchButton';

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
  resultCount,
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
  resultCount?: number;
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
  // Đợt 99 — điện thoại: 6 ô lọc phụ + "Doanh nghiệp yêu thích" gom vào ngăn kéo từ đáy (nút "Bộ lọc (n)"); máy tính giữ nguyên bố cục.
  const [sheet, setSheet] = useState(false);
  const extraCount = [value.salaryTier, value.level, value.postedWithin, value.employmentType, value.experienceLevel, value.urgentOnly, value.featuredEmployerOnly].filter(Boolean).length;
  const provincePins = usePins('provinces');
  const industryPins = usePins('industries');

  return (
    <div className="rounded-xl border border-border bg-white p-3.5 flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          dismissKeyboard();
          if (showSearchField) rememberSearch(searchValue ?? '');
          (onSearchSubmit ?? ((ev: React.FormEvent) => ev.preventDefault()))(e);
        }}
        className="flex flex-col sm:flex-row gap-2.5"
      >
        {showSearchField && (
          <div className="flex gap-2 sm:flex-[1.4] min-w-0">
            <div className="relative flex-1 min-w-0">
              <input
                id="tvl-main-search"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className="tvl-input min-w-0 !pr-9 [&::-webkit-search-cancel-button]:hidden"
                placeholder="Chức danh, kỹ năng, tên công ty  ( / )"
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
              />
              {!!searchValue && (
                <button type="button" aria-label="Xóa từ khóa" onClick={() => { onSearchChange?.(''); document.getElementById('tvl-main-search')?.focus(); }} className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full text-ink-faint hover:text-ink">✕</button>
              )}
            </div>
            <VoiceSearchButton onText={(t) => onSearchChange?.(t)} />
          </div>
        )}
        <div className="sm:flex-1 min-w-0">
          <MultiSelectPopover
            label="Tỉnh, Thành Phố"
            placeholder="Tỉnh, Thành Phố"
            groups={PROVINCE_GROUPS}
            selected={value.provinces ?? []}
            onChange={(v) => onChange({ provinces: v })}
            emptyText="Chọn địa điểm"
            pins={provincePins}
            topAction={{
              label: 'Dùng vị trí của tôi',
              onClick: () =>
                new Promise<string | void>((resolve) => {
                  if (!navigator.geolocation) return resolve('Trình duyệt không hỗ trợ định vị');
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const lat = Math.round(pos.coords.latitude * 100) / 100;
                      const lon = Math.round(pos.coords.longitude * 100) / 100;
                      saveHome({ lat, lon });
                      onChange({ provinces: [nearestProvince(lat, lon)] });
                      resolve();
                    },
                    () => resolve('Không lấy được vị trí, hãy chọn tỉnh thủ công'),
                    { timeout: 8000 },
                  );
                }),
            }}
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
            pins={industryPins}
          />
        </div>
        {showSearchField && (
          <button type="submit" className="tvl-btn-primary !w-auto px-7 max-sm:px-8 shrink-0 self-stretch min-h-[48px] text-[15px]">
            🔎 Tìm
          </button>
        )}
      </form>
      {showSearchField && <SearchHints q={searchValue ?? ''} onPick={(v) => { onSearchChange?.(v); rememberSearch(v); }} onPickIndustry={(i) => { onSearchChange?.(''); onChange({ industries: [i], q: '' }); }} />}

      {extraCount > 0 && (
        <div className="flex flex-wrap gap-1.5 -mt-1" aria-label="Bộ lọc đang dùng">
          {[
            value.salaryTier ? { k: 'sal', t: SALARY_TIERS.find((t) => t.value === value.salaryTier)?.label ?? 'Mức lương', off: () => onChange({ salaryTier: undefined }) } : null,
            value.level ? { k: 'lv', t: value.level, off: () => onChange({ level: undefined }) } : null,
            value.postedWithin ? { k: 'pw', t: POSTED_WITHIN_OPTIONS.find((o) => o.value === value.postedWithin)?.label ?? 'Thời gian đăng', off: () => onChange({ postedWithin: undefined }) } : null,
            value.employmentType ? { k: 'et', t: value.employmentType, off: () => onChange({ employmentType: undefined }) } : null,
            value.experienceLevel ? { k: 'ex', t: value.experienceLevel, off: () => onChange({ experienceLevel: undefined }) } : null,
            value.urgentOnly ? { k: 'ug', t: '⚡ Khẩn cấp', off: () => onChange({ urgentOnly: undefined }) } : null,
            value.featuredEmployerOnly ? { k: 'fe', t: '⭐ DN yêu thích', off: () => onChange({ featuredEmployerOnly: undefined }) } : null,
          ].filter((x): x is { k: string; t: string; off: () => void } => !!x).map((c) => (
            <button key={c.k} type="button" onClick={c.off} title="Bấm để bỏ lọc này" className="inline-flex items-center gap-1 rounded-full bg-primary-tint text-primary text-[12px] font-semibold pl-2.5 pr-2 py-1 max-w-full">
              <span className="truncate">{c.t}</span><span aria-hidden>✕</span>
            </button>
          ))}
          <button type="button" onClick={onClear} className="text-[12px] font-bold text-ink-muted hover:text-primary px-1">Xóa tất cả</button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setSheet(true)}
        className="sm:hidden h-11 rounded-xl border border-border-strong text-[14px] font-bold text-ink flex items-center justify-center gap-2"
      >
        ⚙ Bộ lọc{extraCount > 0 && <span className="rounded-full bg-primary text-white text-[12px] px-2 min-w-[22px] text-center">{extraCount}</span>}
      </button>
      {sheet && <div className="sm:hidden fixed inset-0 z-[60] bg-black/40" onClick={() => setSheet(false)} aria-hidden />}
      <div
        className={
          sheet
            ? 'flex flex-col gap-3 fixed inset-x-0 bottom-0 z-[61] max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:contents'
            : 'hidden sm:contents'
        }
        style={sheet ? { paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' } : undefined}
      >
      {sheet && (
        <div className="flex items-center justify-between sm:hidden">
          <div className="font-extrabold text-[16px]">Bộ lọc</div>
          <button type="button" onClick={() => setSheet(false)} className="h-10 px-4 rounded-full bg-primary text-white font-bold text-[14px]">{typeof resultCount === 'number' ? `Xem ${resultCount.toLocaleString('vi-VN')} việc` : 'Xong'}</button>
        </div>
      )}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
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
    </div>
  );
}
