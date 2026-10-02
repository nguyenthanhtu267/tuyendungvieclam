'use client';

import { Combobox } from '@/components/ui/Combobox';

import { useRef, useState } from 'react';
import Link from '@/components/SmartLink';
import type { Company, JobPosting } from '@/lib/api';
import { CompanyLogo } from '@/components/CompanyLogo';
import { SourcedBadge, isCompanyUnverified } from '@/components/SourcedBadge';
import { JobCard } from '@/components/JobCard';
import { formatNumber } from '@/lib/format';
import { FitText } from '@/components/FitText';

// Đợt 49 — "Tổng quan công ty" theo mẫu careerviet.vn: khung thông tin nền xanh nhạt (tên, logo, địa điểm,
// thông tin có biểu tượng, nút FOLLOW) → Giới thiệu → Thông điệp (Tầm nhìn/Sứ mệnh) → Hình ảnh → Việc làm đang tuyển.
// Dùng chung cho tab "Tổng quan công ty" ở trang tin và trang /cong-ty/[id]. Mục nào chưa có dữ liệu thì ẩn.
export default function CompanyOverview({
  company,
  jobs,
  excludeJobId,
  canFollow,
  following,
  followBusy,
  onToggleFollow,
  maxJobs = 20,
  showAllLink,
}: {
  company: Company;
  jobs: JobPosting[];
  excludeJobId?: string;
  canFollow?: boolean;
  following?: boolean;
  followBusy?: boolean;
  onToggleFollow?: () => void;
  maxJobs?: number;
  showAllLink?: boolean;
}) {
  // Đợt 51 — chỉ ưu tiên hiện các việc làm được quan tâm (xem/tìm) nhiều nhất; phần còn lại bấm "Xem thêm".
  const [showAll, setShowAll] = useState(false);
  // Đợt 54 — thanh tìm trong danh sách việc làm của công ty: chức danh + địa điểm (tỉnh) + sắp xếp.
  const [kw, setKw] = useState('');
  const [place, setPlace] = useState('');
  const [sort, setSort] = useState<'hot' | 'new' | 'salary'>('hot');
  const base = jobs.filter((j) => j.id !== excludeJobId);
  const jobProvinces = (j: JobPosting) => (j.provinces && j.provinces.length ? j.provinces : j.location ? [j.location] : []);
  const placeCounts = new Map<string, number>();
  base.forEach((j) => jobProvinces(j).forEach((pv) => placeCounts.set(pv, (placeCounts.get(pv) ?? 0) + 1)));
  const places = Array.from(placeCounts.entries()).sort((a, b) => b[1] - a[1]);
  const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  const filtering = kw.trim() !== '' || place !== '';
  const list = base
    .filter((j) => (!kw.trim() || norm(j.title).includes(norm(kw.trim()))) && (!place || jobProvinces(j).includes(place)))
    .sort((a, b) =>
      sort === 'new'
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : sort === 'salary'
          ? (b.salaryMax ?? b.salaryMin ?? 0) - (a.salaryMax ?? a.salaryMin ?? 0)
          : (b.viewCount ?? 0) - (a.viewCount ?? 0),
    );
  const TOP = 5;
  const shown = showAll || filtering ? maxJobs : Math.min(TOP, maxJobs);
  const info: { icon: string; label: string; value: string }[] = [
    company.contactPerson ? { icon: '👤', label: 'Người liên hệ', value: company.contactPerson } : null,
    company.size ? { icon: '👥', label: 'Quy mô công ty', value: company.size } : null,
    company.companyType ? { icon: '🏛️', label: 'Loại hình hoạt động', value: company.companyType } : null,
    company.industry ? { icon: '🏷️', label: 'Lĩnh vực', value: company.industry } : null,
    company.taxCode ? { icon: '🧾', label: 'Mã số thuế', value: company.taxCode } : null,
  ].filter(Boolean) as { icon: string; label: string; value: string }[];
  const website = company.website ? (/^https?:\/\//i.test(company.website) ? company.website : `https://${company.website}`) : null;

  return (
    <div className="flex flex-col gap-6 text-ink min-w-0">
      <section className="rounded-lg bg-[#EEF2F9] border border-border p-4 sm:p-5">
        {/* Đợt 95 — logo đứng TRƯỚC (bên trái), tên công ty bên phải xuống tối đa 3 dòng, quá khung thì tự co chữ. */}
        <div className="flex gap-3 sm:gap-4 items-start">
          <div className="shrink-0 w-[84px] h-[72px] sm:w-[128px] sm:h-[108px] rounded-md bg-white border border-border flex items-center justify-center overflow-hidden">
            <CompanyLogo name={company.name} logoUrl={company.logoUrl} size={104} className="text-xl max-w-full max-h-full" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1.5 justify-center sm:min-h-[108px]">
            <h2 className="font-extrabold text-[17px] sm:text-[18px] leading-snug uppercase tracking-tight min-w-0 max-w-full">
              <FitText lines={3} min={0.55}>{company.name}</FitText>
            </h2>
            {isCompanyUnverified(company) && <div><SourcedBadge /></div>}
          </div>
        </div>
        <div className="mt-3">
          <div className="flex-1 min-w-0 w-full">
            {company.address && (
              <div className="text-[14px] pb-2 border-b border-border-strong/60">
                <span className="font-bold">Địa điểm</span> <span className="ml-1 text-ink-muted">{company.address}</span>
              </div>
            )}
            <div className="font-bold text-[14px] mt-2">Thông tin công ty</div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1 text-[13px] text-ink-muted">
              {info.map((i) => (
                <span key={i.label}>
                  <span aria-hidden>{i.icon}</span> {i.label}: <span className="text-ink">{i.value}</span>
                </span>
              ))}
              {website && (
                <span>
                  <span aria-hidden>🌐</span> Website:{' '}
                  <a href={website} target="_blank" rel="noreferrer nofollow" className="text-primary hover:underline">
                    {company.website}
                  </a>
                </span>
              )}
              {company.followersCount != null && (
                <span>
                  <span aria-hidden>❤</span> {formatNumber(company.followersCount)} người theo dõi
                </span>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-3 flex-wrap">
              {showAllLink && (
                <Link href={`/cong-ty/${company.id}`} className="rounded-md border border-primary text-primary font-bold text-[13px] px-4 h-9 inline-flex items-center hover:bg-white">
                  Trang công ty →
                </Link>
              )}
              {canFollow && (
                <button
                  onClick={onToggleFollow}
                  disabled={followBusy}
                  className={`rounded-md font-extrabold text-[13px] uppercase tracking-wide px-8 h-9 disabled:opacity-60 ${
                    following ? 'bg-white text-primary border border-primary' : 'bg-primary text-white hover:bg-primary-dark'
                  }`}
                >
                  {following ? '✓ Đang theo dõi' : 'Follow'}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {company.description && (
        <Section title="Giới thiệu về công ty">
          <Collapsible text={company.description} />
        </Section>
      )}

      {(company.vision || company.mission) && (
        <Section title={`Thông điệp từ ${company.name}`}>
          {company.vision && (
            <div className="mb-3">
              <div className="font-bold text-[13px] uppercase text-ink-muted mb-1">Tầm nhìn</div>
              <p className="text-[14px] leading-relaxed whitespace-pre-line">{company.vision}</p>
            </div>
          )}
          {company.mission && (
            <div>
              <div className="font-bold text-[13px] uppercase text-ink-muted mb-1">Sứ mệnh</div>
              <p className="text-[14px] leading-relaxed whitespace-pre-line">{company.mission}</p>
            </div>
          )}
        </Section>
      )}

      {company.galleryUrls && company.galleryUrls.length > 0 && <Gallery urls={company.galleryUrls} name={company.name} />}

      <Section
        title={
          filtering
            ? `Vị trí đang tuyển dụng (${list.length}/${base.length} việc làm)`
            : list.length > TOP && !showAll && sort === 'hot'
              ? `Việc làm được quan tâm nhiều nhất (${TOP}/${list.length})`
              : `Vị trí đang tuyển dụng${list.length ? ` (${list.length} việc làm)` : ''}`
        }
      >
        {base.length > 1 && (
          <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
            <label className="flex-1 min-w-0 relative" htmlFor="co-job-kw">
              <span className="sr-only">Nhập chức danh</span>
              <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">🔍</span>
              <input
                id="co-job-kw"
                className="tvl-input" style={{ paddingLeft: 36 }}
                placeholder="Nhập chức danh"
                value={kw}
                onChange={(e) => setKw(e.target.value)}
              />
            </label>
            {places.length > 1 && (
              <Combobox id="co-job-place" ariaLabel="Địa điểm làm việc" className="w-full sm:w-[210px]" value={place} options={places.map(([pv, n]) => ({ value: pv, label: pv, hint: String(n) }))} allLabel={`Tất cả địa điểm (${base.length})`} onChange={setPlace} />
            )}
            <select
              id="co-job-sort"
              aria-label="Sắp xếp"
              className="tvl-input sm:w-[210px]"
              value={sort}
              onChange={(e) => setSort(e.target.value as 'hot' | 'new' | 'salary')}
            >
              <option value="hot">Quan tâm nhiều nhất</option>
              <option value="new">Mới cập nhật</option>
              <option value="salary">Lương cao nhất</option>
            </select>
          </div>
        )}
        {list.length === 0 ? (
          <div className="text-[14px] text-ink-muted">
            {filtering ? 'Không có vị trí nào khớp. Thử chức danh hoặc địa điểm khác.' : 'Công ty hiện chưa có tin tuyển dụng khác đang hiển thị.'}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {list.slice(0, shown).map((j) => (
              <JobCard key={j.id} job={{ ...j, company: j.company ?? company }} />
            ))}
            {list.length > shown && !showAll && !filtering && list.length > TOP && (
              <button onClick={() => setShowAll(true)} className="tvl-btn-ghost !w-auto px-4 self-start">
                Xem tất cả {list.length} việc làm →
              </button>
            )}
            {list.length > shown && showAll && (
              <Link href={`/cong-ty/${company.id}`} className="tvl-btn-ghost !w-auto px-4 self-start">
                Xem tất cả {list.length} việc làm →
              </Link>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between border-b border-border-strong/70 pb-2 mb-3">
        <h3 className="font-extrabold text-[16px] uppercase tracking-tight">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

const COLLAPSED = 600;
function Collapsible({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > COLLAPSED;
  return (
    <div className="text-[14px] leading-relaxed">
      <p className="whitespace-pre-line">{open || !long ? text : `${text.slice(0, COLLAPSED).trim()}…`}</p>
      {long && (
        <button onClick={() => setOpen((v) => !v)} className="text-primary font-semibold text-[13px] mt-1 hover:underline">
          {open ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </div>
  );
}

function Gallery({ urls, name }: { urls: string[]; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const ok = urls.filter((u) => !broken.has(u));
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.8), behavior: 'smooth' });
  const arrows = (
    <div className="flex gap-1.5">
      <button onClick={() => scroll(-1)} aria-label="Ảnh trước" className="w-7 h-7 rounded-full border border-border-strong bg-white text-[13px] hover:border-primary">‹</button>
      <button onClick={() => scroll(1)} aria-label="Ảnh sau" className="w-7 h-7 rounded-full border border-border-strong bg-white text-[13px] hover:border-primary">›</button>
    </div>
  );
  if (ok.length === 0) return null; // mọi link ảnh lỗi → ẩn cả mục
  return (
    <Section title="Hình ảnh công ty" right={ok.length > 2 ? arrows : undefined}>
      <div ref={ref} className="flex gap-3 overflow-x-auto snap-x pb-1" style={{ scrollbarWidth: 'thin' }}>
        {ok.map((u, i) => (
          <button key={u + i} onClick={() => setZoom(u)} className="snap-start shrink-0 w-[260px] h-[170px] rounded-lg overflow-hidden border border-border bg-surface-alt">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={u}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
              onError={() => setBroken((b) => new Set(b).add(u))}
            />
          </button>
        ))}
      </div>
      {zoom && (
        <div role="dialog" aria-label="Xem ảnh" onClick={() => setZoom(null)} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt={`Hình ảnh ${name}`} className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </Section>
  );
}
