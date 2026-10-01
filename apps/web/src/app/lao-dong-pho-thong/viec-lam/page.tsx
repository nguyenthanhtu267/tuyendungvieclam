'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { LaborJobList } from '@/components/labor/LaborJobList';
import { WorkerCredsBox, snapParams, useWorkerApply, whoOf } from '@/components/labor/WorkerCreds';
import { AddressPicker, EMPTY_ADDRESS, type AddressValue } from '@/components/labor/AddressPicker';
import { ApplicationHistory } from '@/components/labor/ApplicationHistory';
import { useSavedJobs } from '@/components/labor/saved';
import { RefreshReminder } from '@/components/labor/RefreshReminder';
import { workersApi, type WorkerJobCard, type WorkerKind } from '@/lib/api';
import { KIND_LABEL, KIND_SLUG, LABOR_GROUPS, PERKS_BY_KIND, PERK_SHORT, SLUG_KIND, guessGroups } from '@/lib/labor';

// Đợt 79 — kênh việc làm riêng cho lao động phổ thông (3 tab), tách khỏi danh sách việc văn phòng.
function LaborJobsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const kind: WorkerKind = SLUG_KIND[sp.get('loai') ?? ''] ?? 'worker';
  const [province, setProvince] = useState(sp.get('tinh') ?? '');
  const [group, setGroup] = useState(sp.get('nhom') ?? '');
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');
  const [perks, setPerks] = useState<string[]>([]);
  const [sort, setSort] = useState<'near' | 'match' | 'new'>('near');
  const [hideFilled, setHideFilled] = useState(true);
  const [page, setPage] = useState(1);
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
  useEffect(() => {
    setData(null);
    const base = snapParams(snap);
    // Sinh viên: "tìm gần trường" ghi đè vị trí xếp hạng gần/xa bằng khu vực trường đã chọn
    const near = kind === 'student' && schoolArea.province && (schoolArea.oldDistrict || schoolArea.newWardCode);
    if (near) Object.assign(base, { oProvince: schoolArea.province, oDistrict: schoolArea.addressMode === 'old' ? schoolArea.oldDistrict : undefined, oWard: schoolArea.addressMode === 'new' ? schoolArea.newWardCode : undefined, oLat: undefined, oLon: undefined });
    workersApi
      .browse({
        kind, province: province || undefined, group: group || undefined, q: qApplied || undefined, perks: perks.join(',') || undefined,
        hideFilled: hideFilled ? '1' : undefined, flex: kind === 'student' && flex ? '1' : undefined, page: String(page), pageSize: '20', sort: snap || (kind === 'student' && schoolArea.province && (schoolArea.oldDistrict || schoolArea.newWardCode)) ? sort : sort === 'near' ? 'new' : sort,
        ...base,
      })
      .then((r) => setData(r))
      .catch(() => setData({ items: [], total: 0, totalPages: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, province, group, qApplied, perks, sort, hideFilled, page, snapKey, flex, schoolArea]);

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
    setPage(1);
    router.replace(`/lao-dong-pho-thong/viec-lam?loai=${KIND_SLUG[k]}`);
  };
  const togglePerk = (p: string) => {
    setPage(1);
    setPerks((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]));
  };
  const chip = (on: boolean) => `rounded-full border px-2.5 py-1 text-[13px] font-bold ${on ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`;

  return (
    <div className="max-w-5xl mx-3 sm:mx-auto my-3 flex flex-col gap-2.5">
      <RefreshReminder />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="tvl-title font-extrabold text-[20px] text-ink">Việc làm {KIND_LABEL[kind].toLowerCase()}</h1>
        <Link href={`/lao-dong-pho-thong?loai=${KIND_SLUG[kind]}`} className={`rounded-lg font-extrabold text-[14px] px-3 py-2 uppercase ${kind === 'worker' ? 'bg-[#FFD84D] text-[#C8102E] border border-warning' : 'bg-white text-ink border border-border-strong'}`}>
          Điền thông tin để nhà tuyển dụng gọi
        </Link>
      </div>
      <div role="tablist" className="grid grid-cols-3 gap-1.5">
        {(Object.keys(KIND_LABEL) as WorkerKind[]).map((k) => (
          <button key={k} role="tab" aria-selected={k === kind} type="button" onClick={() => switchKind(k)} className={`rounded-lg border py-2 text-[14px] font-extrabold ${k === kind ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
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
          <select id="lj-prov" aria-label="Tỉnh/thành" className="tvl-input !w-auto !py-2" value={province} onChange={(e) => { setProvince(e.target.value); setPage(1); }}>
            <option value="">Tất cả tỉnh/thành</option>
            {provinces.map((p) => (<option key={p} value={p}>{p}</option>))}
          </select>
          <select id="lj-group" aria-label="Nhóm việc" className="tvl-input !w-auto !py-2" value={group} onChange={(e) => { setGroup(e.target.value); setPage(1); }}>
            <option value="">Tất cả nhóm việc</option>
            {LABOR_GROUPS[kind].map((g) => (<option key={g} value={g}>{g}</option>))}
          </select>
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
        <div className="flex flex-wrap items-center gap-1.5">
          {PERKS_BY_KIND[kind].map((p) => (
            <button key={p} type="button" aria-pressed={perks.includes(p)} onClick={() => togglePerk(p)} className={chip(perks.includes(p))}>{PERK_SHORT[p]}</button>
          ))}
          <span className="mx-1 text-border-strong">|</span>
          <div role="radiogroup" aria-label="Sắp xếp" className="flex rounded-lg border border-border-strong overflow-hidden">
            {([['near', 'Gần tôi'], ['match', 'Phù hợp nhất'], ['new', 'Mới nhất']] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={sort === k} onClick={() => { setSort(k); setPage(1); }} className={`px-2.5 py-1 text-[13px] font-bold ${sort === k ? 'bg-primary text-white' : 'bg-white text-ink'}`}>{l}</button>
            ))}
          </div>
          {kind === 'student' && (
            <button type="button" aria-pressed={flex} onClick={() => { setFlex(!flex); setPage(1); }} className={chip(flex)}>Ca ngoài giờ học (tối, T7, CN)</button>
          )}
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
        {!snap && sort === 'near' && <div className="text-[12.5px] text-ink-muted">Xác nhận số điện thoại bên dưới (hoặc điền thông tin) để xếp việc gần nơi bạn ở.</div>}
      </div>
      <WorkerCredsBox w={w} slug={KIND_SLUG[kind]} />
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
        <LaborJobList jobs={data.items} who={whoOf(w)} onApply={(id) => w.apply(id)} emptyText="Chưa có tin phù hợp bộ lọc. Hãy điền thông tin để nhà tuyển dụng chủ động liên hệ bạn." />
      )}
      {!showSaved && data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-border-strong bg-white px-3 py-1.5 font-bold disabled:text-ink-faint">‹ Trước</button>
          <span className="rounded-lg bg-white px-3 py-1.5 font-bold">{page}/{data.totalPages}</span>
          <button type="button" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-border-strong bg-white px-3 py-1.5 font-bold disabled:text-ink-faint">Sau ›</button>
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
