'use client';

import { Combobox } from '@/components/ui/Combobox';
import Link from '@/components/SmartLink';
import { Suspense, useEffect, useRef, useState } from 'react';
import { blockAutoLoad } from '@/lib/data-saver';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { LaborJobList } from '@/components/labor/LaborJobList';
import { WorkerCredsBox, snapParams, useWorkerApply, whoOf } from '@/components/labor/WorkerCreds';
import { AddressPicker, EMPTY_ADDRESS, type AddressValue } from '@/components/labor/AddressPicker';
import { ApplicationHistory } from '@/components/labor/ApplicationHistory';
import { useSavedJobs } from '@/components/labor/saved';
import { RefreshReminder } from '@/components/labor/RefreshReminder';
import { workersApi, type WorkerJobCard, type WorkerKind } from '@/lib/api';
import { KIND_LABEL, KIND_SLUG, LABOR_GROUPS, PERKS_BY_KIND, PERK_SHORT, RADII, SHIFTS_BY_KIND, SLUG_KIND, guessGroups } from '@/lib/labor';
import { areaLabel, isPrecise, originParams, useJobOrigin } from '@/components/labor/useJobOrigin';

// Đợt 79 — kênh việc làm riêng cho lao động phổ thông (3 tab), tách khỏi danh sách việc văn phòng.
function LaborJobsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const kind: WorkerKind = SLUG_KIND[sp.get('loai') ?? ''] ?? 'worker';
  const [province, setProvince] = useState(sp.get('tinh') ?? '');
  const [group, setGroup] = useState(sp.get('nhom') ?? '');
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [qApplied, setQApplied] = useState((sp.get('q') ?? '').trim());
  // Đợt 134 — lọc ca làm + "Gần tôi" không cần hồ sơ (vị trí máy / chọn khu vực) + bán kính
  const [shifts, setShifts] = useState<string[]>([]);
  const [radius, setRadius] = useState(0);
  const [areaOpen, setAreaOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [areaDraft, setAreaDraft] = useState<AddressValue>(EMPTY_ADDRESS);
  const jo = useJobOrigin();
  const [perks, setPerks] = useState<string[]>([]);
  const [sort, setSort] = useState<'near' | 'match' | 'new'>('near');
  const [hideFilled, setHideFilled] = useState(true);
  const [page, setPage] = useState(1);
  // Đợt 148 — cuộn là bung trang kế tiếp: các trang sau nối vào danh sách, không cần bấm Trước/Sau.
  const [acc, setAcc] = useState<WorkerJobCard[]>([]);
  const [moreBusy, setMoreBusy] = useState(false);
  const autoPages = useRef(0);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [data, setData] = useState<{ items: WorkerJobCard[]; totalPages: number; total: number } | null>(null);
  const [flex, setFlex] = useState(false);
  const [schoolArea, setSchoolArea] = useState<AddressValue>(EMPTY_ADDRESS);
  const [showSaved, setShowSaved] = useState(false);
  const [savedCards, setSavedCards] = useState<WorkerJobCard[] | null>(null);
  const saved = useSavedJobs();
  const w = useWorkerApply();
  const snap = w.snap && w.snap.kind === kind ? w.snap : null;
  const guessed = guessGroups(q, kind).filter((g) => g !== group);

  useEffect(() => {
    workersApi.catalog().then((c) => setProvinces(c.provinces)).catch(() => undefined);
  }, []);
  const snapKey = JSON.stringify(snap);
  const originKey = JSON.stringify(jo.origin);
  const hasOrigin = !!snap || !!jo.origin;
  // Lọc bán kính chỉ khi biết tới quận/phường (hồ sơ hoặc khu vực đã chọn) — vị trí máy chỉ suy ra được tỉnh.
  const precise = jo.origin ? isPrecise(jo.origin) : !!snap && !!(snap.oldDistrict || snap.newWardCode);
  const originText = jo.origin ? jo.origin.label : snap ? `nơi ở trong hồ sơ (${[snap.oldDistrict, snap.province].filter(Boolean).join(', ')})` : '';
  useEffect(() => {
    if (page === 1) {
      setData(null);
      setAcc([]);
      autoPages.current = 0;
    } else setMoreBusy(true);
    const base = { ...snapParams(snap), ...originParams(jo.origin) };
    // Sinh viên: "tìm gần trường" ghi đè vị trí xếp hạng gần/xa bằng khu vực trường đã chọn
    const near = kind === 'student' && schoolArea.province && (schoolArea.oldDistrict || schoolArea.newWardCode);
    if (near) Object.assign(base, { oProvince: schoolArea.province, oDistrict: schoolArea.addressMode === 'old' ? schoolArea.oldDistrict : undefined, oWard: schoolArea.addressMode === 'new' ? schoolArea.newWardCode : undefined, oLat: undefined, oLon: undefined });
    workersApi
      .browse({
        kind, province: province || undefined, group: group || undefined, q: qApplied || undefined, perks: perks.join(',') || undefined,
        shifts: shifts.join(',') || undefined, radius: radius && precise ? String(radius) : undefined,
        hideFilled: hideFilled ? '1' : undefined, flex: kind === 'student' && flex ? '1' : undefined, page: String(page), pageSize: '20', sort: hasOrigin || (kind === 'student' && schoolArea.province && (schoolArea.oldDistrict || schoolArea.newWardCode)) ? sort : sort === 'near' ? 'new' : sort,
        ...base,
      })
      .then((r) => {
        setData(r);
        setAcc((a) => (page === 1 ? r.items : [...a, ...r.items.filter((x) => !a.some((y) => y.id === x.id))]));
      })
      .catch(() => {
        if (page === 1) setData({ items: [], total: 0, totalPages: 1 });
        autoPages.current = 99; // lỗi mạng khi tải thêm: dừng tự bung, chờ người dùng bấm "Xem thêm"
      })
      .finally(() => setMoreBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, province, group, qApplied, perks, sort, hideFilled, page, snapKey, flex, schoolArea, shifts, radius, originKey]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined' || !data || page >= data.totalPages) return;
    const io = new IntersectionObserver(
      (es) => {
        if (!es[0]?.isIntersecting || moreBusy || autoPages.current >= 6 || blockAutoLoad()) return;
        autoPages.current += 1;
        setPage((p) => p + 1);
      },
      { rootMargin: '700px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [data, page, moreBusy, acc.length]);

  // Đợt 150 — dự phòng bằng bộ nghe cuộn (khi IntersectionObserver không báo).
  useEffect(() => {
    if (!data || page >= data.totalPages) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      const el = sentinel.current;
      if (!el || moreBusy || autoPages.current >= 6 || blockAutoLoad()) return;
      if (el.getBoundingClientRect().top < window.innerHeight + 700) {
        autoPages.current += 1;
        setPage((p) => p + 1);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [data, page, moreBusy, acc.length]);

  const savedKey = saved.ids.join(',');
  useEffect(() => {
    if (!showSaved) return;
    if (!saved.ids.length) return setSavedCards([]);
    workersApi.cards(saved.ids).then((r) => setSavedCards(r.items)).catch(() => setSavedCards([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSaved, savedKey]);
  const switchKind = (k: WorkerKind) => {
    setGroup('');
    setPerks([]);
    setShifts([]);
    setPage(1);
    router.replace(`/lao-dong-pho-thong/viec-lam?loai=${KIND_SLUG[k]}`);
  };
  const toggleShift = (x: string) => {
    setPage(1);
    setShifts((l) => (l.includes(x) ? l.filter((y) => y !== x) : [...l, x]));
  };
  const togglePerk = (p: string) => {
    setPage(1);
    setPerks((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]));
  };
  const chip = (on: boolean) => `rounded-full border px-2.5 py-1 text-[13px] font-bold ${on ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`;

  return (
    <div className="max-w-5xl mx-3 sm:mx-auto my-3 flex flex-col gap-2.5">
      <RefreshReminder />
      <h1 className="tvl-title font-extrabold text-[20px] text-ink">Việc làm {KIND_LABEL[kind].toLowerCase()}</h1>
      <div role="tablist" className="grid grid-cols-3 gap-1.5">
        {(Object.keys(KIND_LABEL) as WorkerKind[]).map((k) => (
          <button key={k} role="tab" aria-selected={k === kind} type="button" onClick={() => switchKind(k)} className={`rounded-lg border py-2 text-[14px] font-extrabold ${k === kind ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <WorkerCredsBox w={w} slug={KIND_SLUG[kind]} />
      <div className="rounded-xl border border-border bg-white p-2.5 flex flex-col gap-2">
        <form
          className="flex flex-wrap gap-2 items-center"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQApplied(q.trim());
          }}
        >
          <input id="lj-q" aria-label="Tìm công việc" className="tvl-input !w-auto flex-1 min-w-[180px] !py-2" placeholder={kind === 'worker' ? 'Gõ công việc: đứng máy, bốc vác, phụ hồ…' : 'Gõ công việc hoặc tên công ty…'} value={q} onChange={(e) => setQ(e.target.value)} />
          <Combobox id="lj-prov" ariaLabel="Tỉnh/thành" className="min-w-[11rem] flex-1 sm:flex-none sm:w-56" inputClassName="!py-2" value={province} options={provinces} allLabel="Tất cả tỉnh/thành" onChange={(v) => { setProvince(v); setPage(1); }} />
          <Combobox id="lj-group" ariaLabel="Nhóm việc" className="min-w-[11rem] flex-1 sm:flex-none sm:w-56" inputClassName="!py-2" value={group} options={LABOR_GROUPS[kind]} allLabel="Tất cả nhóm việc" onChange={(v) => { setGroup(v); setPage(1); }} />
          <button type="submit" className="rounded-lg bg-accent text-white font-bold text-[14px] px-4 py-2">Tìm</button>
        </form>
        {guessed.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink">
            Có phải bạn tìm nhóm:
            {guessed.map((g) => (
              <button key={g} type="button" onClick={() => { setGroup(g); setQ(''); setQApplied(''); setPage(1); }} className="rounded-full border border-success bg-success-tint text-success font-bold px-2.5 py-1">{g}</button>
            ))}
          </div>
        )}
        {/* Đợt 134 — điện thoại: ca làm + phúc lợi gom vào "Lọc thêm" cho danh sách việc hiện sớm hơn */}
        <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)} className="sm:hidden self-start rounded-lg border border-border-strong bg-white text-ink font-bold text-[13px] px-2.5 py-1">
          ⚙ Lọc thêm: ca làm, KTX, xe đưa đón…{shifts.length + perks.length ? ` (${shifts.length + perks.length})` : ''} {moreOpen ? '▴' : '▾'}
        </button>
        <div className={`flex flex-col gap-2 ${moreOpen ? '' : 'max-sm:hidden'}`}>
        {SHIFTS_BY_KIND[kind].length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Ca làm">
            <span className="text-[13px] font-bold text-ink-muted">Ca làm:</span>
            {SHIFTS_BY_KIND[kind].map((x) => (
              <button key={x} type="button" aria-pressed={shifts.includes(x)} onClick={() => toggleShift(x)} className={chip(shifts.includes(x))}>{x}</button>
            ))}
            {shifts.length > 0 && <button type="button" onClick={() => { setShifts([]); setPage(1); }} className="text-[13px] font-bold text-primary underline">Bỏ chọn</button>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {PERKS_BY_KIND[kind].map((p) => (
            <button key={p} type="button" aria-pressed={perks.includes(p)} onClick={() => togglePerk(p)} className={chip(perks.includes(p))}>{PERK_SHORT[p]}</button>
          ))}
          {kind === 'student' && (
            <button type="button" aria-pressed={flex} onClick={() => { setFlex(!flex); setPage(1); }} className={chip(flex)}>Ca ngoài giờ học (tối, T7, CN)</button>
          )}
        </div>
        </div>
        <div className="rounded-lg bg-surface-alt px-2.5 py-2 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13.5px] text-ink">
            <span>📍 {hasOrigin ? <>Xếp việc gần <b>{originText}</b></> : <b>Tìm việc gần bạn:</b>}</span>
            <button type="button" onClick={() => { jo.locate(); setSort('near'); setPage(1); }} disabled={jo.locating} className="rounded-lg border border-primary bg-white text-primary font-bold text-[13px] px-2.5 py-1 disabled:opacity-60">{jo.locating ? 'Đang lấy vị trí…' : 'Dùng vị trí hiện tại'}</button>
            <button type="button" aria-expanded={areaOpen} onClick={() => setAreaOpen(!areaOpen)} className="rounded-lg border border-border-strong bg-white text-ink font-bold text-[13px] px-2.5 py-1">Chọn khu vực {areaOpen ? '▴' : '▾'}</button>
            {jo.origin && <button type="button" onClick={() => { jo.setOrigin(null); setRadius(0); setPage(1); }} className="text-[13px] font-bold text-primary underline">Bỏ vị trí</button>}
          </div>
          {jo.error && <div className="text-[12.5px] font-bold text-critical">{jo.error}</div>}
          {jo.origin?.mode === 'gps' && !areaOpen && (
            <button type="button" onClick={() => { setAreaDraft({ ...EMPTY_ADDRESS, province: jo.origin?.mode === 'gps' ? jo.origin.province : '' }); setAreaOpen(true); }} className="self-start text-[12.5px] font-bold text-primary underline">
              Chọn thêm quận/phường để xếp chính xác hơn và lọc theo km
            </button>
          )}
          {areaOpen && (
            <div className="flex flex-col gap-1.5">
              <AddressPicker value={areaDraft} onChange={setAreaDraft} provinces={provinces} idPrefix="lj-area" requireWard={false} />
              <button
                type="button"
                disabled={!areaDraft.province}
                onClick={() => { jo.setOrigin({ mode: 'area', area: areaDraft, label: areaLabel(areaDraft) }); setSort('near'); setAreaOpen(false); setPage(1); }}
                className="self-start rounded-lg bg-primary text-white font-bold text-[13px] px-3 py-1.5 disabled:opacity-50"
              >
                Tìm việc gần khu vực này
              </button>
            </div>
          )}
          {precise && (
            <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Bán kính">
              <span className="text-[13px] text-ink-muted">Trong:</span>
              {[0, ...RADII].map((r) => (
                <button key={r} type="button" role="radio" aria-checked={radius === r} onClick={() => { setRadius(r); setPage(1); }} className={chip(radius === r)}>{r ? `${r} km` : 'Mọi khoảng cách'}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div role="radiogroup" aria-label="Sắp xếp" className="flex rounded-lg border border-border-strong overflow-hidden">
            {([['near', 'Gần tôi'], ['match', 'Phù hợp nhất'], ['new', 'Mới nhất']] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={sort === k} onClick={() => { setSort(k); setPage(1); }} className={`px-2.5 py-1 text-[13px] font-bold ${sort === k ? 'bg-primary text-white' : 'bg-white text-ink'}`}>{l}</button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[13px] text-ink" htmlFor="lj-hide">
            <input id="lj-hide" type="checkbox" className="w-4 h-4" checked={hideFilled} onChange={(e) => { setHideFilled(e.target.checked); setPage(1); }} />Ẩn tin đã đủ người
          </label>
          {data && <span className="text-[13px] text-ink-muted">{data.total} tin</span>}
        </div>
        {kind === 'student' && (
          <details className="rounded-lg border border-border bg-white">
            <summary className="cursor-pointer px-2.5 py-1.5 text-[13.5px] font-bold text-ink">Tìm việc gần trường {schoolArea.province && schoolArea.oldDistrict ? `(${schoolArea.oldDistrict}, ${schoolArea.province})` : ''}</summary>
            <div className="p-2.5 flex flex-col gap-1.5">
              <div className="text-[12.5px] text-ink-muted">Chọn khu vực trường của bạn, tin gần trường sẽ xếp lên đầu (thay cho nơi ở).</div>
              <AddressPicker value={schoolArea} onChange={(a) => { setSchoolArea(a); setPage(1); }} provinces={provinces} idPrefix="lj-school" requireWard={false} />
              {schoolArea.province && <button type="button" onClick={() => setSchoolArea(EMPTY_ADDRESS)} className="self-start text-[13px] font-bold text-primary underline">Bỏ chọn khu vực trường</button>}
            </div>
          </details>
        )}
        {!hasOrigin && sort === 'near' && <div className="text-[12.5px] text-ink-muted">Bấm “Dùng vị trí hiện tại” hoặc “Chọn khu vực” để xếp việc gần bạn nhất.</div>}
      </div>
      <ApplicationHistory w={w} />
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={!showSaved} onClick={() => setShowSaved(false)} className={chip(!showSaved)}>Tất cả tin</button>
        <button type="button" aria-pressed={showSaved} onClick={() => setShowSaved(true)} className={chip(showSaved)}>♥ Tin đã lưu ({saved.ids.length})</button>
      </div>
      {showSaved ? (
        savedCards === null ? (
          <div className="rounded-xl border border-border bg-white p-4 text-[14px] text-ink-muted">Đang tải…</div>
        ) : (
          <LaborJobList jobs={savedCards} who={whoOf(w)} onApply={(id) => w.apply(id)} emptyText="Bạn chưa lưu tin nào. Bấm “♡ Lưu tin” ở mỗi tin để xem lại và nhận nhắc khi tin sắp đủ người." />
        )
      ) : data === null ? (
        <div className="rounded-xl border border-border bg-white p-4 text-[14px] text-ink-muted">Đang tải…</div>
      ) : (
        <LaborJobList jobs={acc} who={whoOf(w)} onApply={(id) => w.apply(id)} emptyText="Chưa có tin phù hợp bộ lọc. Hãy điền thông tin để nhà tuyển dụng chủ động liên hệ bạn." />
      )}
      {!showSaved && data && data.totalPages > 1 && (
        <div className="flex flex-col items-center gap-2" aria-live="polite">
          <div className="text-xs text-ink-muted rounded-lg bg-white px-3 py-1.5">Đang hiện <b>{acc.length}</b> / {data.total} tin</div>
          {page < data.totalPages ? (
            <>
              <div ref={sentinel} className="h-1 w-full" aria-hidden />
              {moreBusy ? (
                <div className="text-[13px] text-ink-muted py-2">⟳ Đang tải thêm tin…</div>
              ) : (
                <button type="button" onClick={() => { autoPages.current = 0; setPage((p) => p + 1); }} className="rounded-lg border border-border-strong bg-white font-bold text-[14px] w-full sm:w-72 h-12">Xem thêm tin</button>
              )}
            </>
          ) : (
            <div className="text-[12.5px] text-ink-faint py-1">Đã hiện hết kết quả.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LaborJobsPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <Suspense fallback={null}>
        <LaborJobsInner />
      </Suspense>
    </main>
  );
}
