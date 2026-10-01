'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import EmployerHeader from '@/components/EmployerHeader';
import { AddressPicker, EMPTY_ADDRESS, type AddressValue } from '@/components/labor/AddressPicker';
import { useAuth } from '@/lib/auth-context';
import { workersApi, type TrustInfo, type DropoutRow, type EmployerLaborJob, type SupplyRow, type WorkerAppRow, type WorkerKind, type WorkerSearchItem } from '@/lib/api';
import Link from '@/components/SmartLink';
import { TrustBadge } from '@/components/labor/LaborJobList';
import { callScript } from '@/lib/labor-extra';
import { CERT_LABEL, EXPERIENCE_LABEL, HOURS_LABEL, ageOfBirth, CALL_LABEL, CALL_STATUS, GENDER_LABEL, KIND_LABEL, LABOR_GROUPS, ago, fmtDateTime, placeText, slotText } from '@/lib/labor';

const ORIGIN_KEY = 'tvl_emp_origin';
interface Origin { addr: AddressValue; lat: number | null; lon: number | null }
function readOrigin(): Origin | null {
  try {
    return JSON.parse(localStorage.getItem(ORIGIN_KEY) ?? 'null');
  } catch {
    return null;
  }
}

// Đợt 79 — NTD (bắt buộc đăng nhập) tìm công nhân / sinh viên / thực tập sinh; xếp theo gần công ty
// hoặc mới cập nhật; ghi chú "đã có việc làm" hiện cho NTD khác (chỉ thời gian, không lộ công ty).
export default function EmployerLaborPage() {
  const { me, token } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'search' | 'apps' | 'supply'>('search');
  const [callStatus, setCallStatus] = useState('');
  const [needs, setNeeds] = useState('');
  const [laborJobs, setLaborJobs] = useState<EmployerLaborJob[]>([]);
  const [supply, setSupply] = useState<{ totalInProvince?: number; districts: SupplyRow[]; provinces: { province: string; total: number; km: number }[]; origin: { province: string } | null; hours?: number[]; bestHours?: { h: number; n: number }[]; dropout?: DropoutRow[] } | null>(null);
  const [kind, setKind] = useState<'' | WorkerKind>('');
  const [province, setProvince] = useState('');
  const [group, setGroup] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'near' | 'recent' | 'match'>('near');
  const [jobId, setJobId] = useState('');
  const [today, setToday] = useState(false);
  // Đợt 84 — bộ lọc riêng từng nhóm
  const [ef, setEf] = useState({ exp: '', bike: false, health: false, hours: '', months: '', year: '', major: '', ready: false });
  const setE = (p: Partial<typeof ef>) => { setEf((s) => ({ ...s, ...p })); setPage(1); };
  const [includeNot, setIncludeNot] = useState(false);
  const [page, setPage] = useState(1);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [origin, setOrigin] = useState<Origin>({ addr: EMPTY_ADDRESS, lat: null, lon: null });
  const [originOpen, setOriginOpen] = useState(false);
  const [data, setData] = useState<{ items: WorkerSearchItem[]; total: number; totalPages: number } | null>(null);
  const [apps, setApps] = useState<WorkerAppRow[] | null>(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [iv, setIv] = useState({ at: '', place: '' });
  const [ivMsg, setIvMsg] = useState('');
  const [showList, setShowList] = useState(false);
  const [myTrust, setMyTrust] = useState<TrustInfo | null>(null);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap?next=/nha-tuyen-dung/lao-dong-pho-thong');
    else if (me && !me.role.startsWith('employer') && me.role !== 'admin') router.replace('/');
  }, [me, router]);

  useEffect(() => {
    workersApi.catalog().then((c) => setProvinces(c.provinces)).catch(() => undefined);
    const saved = readOrigin();
    if (saved) setOrigin(saved);
    else if (token)
      workersApi
        .origin(token)
        .then((o) => o.province && setOrigin((s) => ({ ...s, addr: { ...EMPTY_ADDRESS, province: o.province! } })))
        .catch(() => undefined);
  }, [token]);

  const saveOrigin = (o: Origin) => {
    setOrigin(o);
    try {
      localStorage.setItem(ORIGIN_KEY, JSON.stringify(o));
    } catch {
      /* bỏ qua */
    }
  };

  const load = useCallback(() => {
    if (!token) return;
    setData(null);
    setErr('');
    const a = origin.addr;
    workersApi
      .search(token, {
        kind: kind || undefined, province: province || undefined, group: group || undefined, q: q.trim() || undefined, sort,
        includeNotSeeking: includeNot ? '1' : undefined, page: String(page), callStatus: callStatus || undefined, needs: needs || undefined, jobId: jobId || undefined, today: today ? '1' : undefined,
        exp: ef.exp || undefined, bike: ef.bike ? '1' : undefined, health: ef.health ? '1' : undefined, hours: ef.hours || undefined, months: ef.months || undefined, year: ef.year || undefined, major: ef.major.trim() || undefined, ready: ef.ready ? '1' : undefined,
        originProvince: a.province || undefined, originMode: a.addressMode, originDistrict: a.oldDistrict || undefined, originWard: a.oldWard || undefined,
        originNewWard: a.newWardCode || undefined, originLat: origin.lat != null ? String(origin.lat) : undefined, originLon: origin.lon != null ? String(origin.lon) : undefined,
      })
      .then(setData)
      .catch((e) => {
        setErr((e as Error).message);
        setData({ items: [], total: 0, totalPages: 1 });
      });
  }, [token, kind, province, group, q, sort, includeNot, page, origin, callStatus, needs, jobId, today, ef]);
  useEffect(() => {
    if (tab === 'search') load();
  }, [load, tab]);
  const loadApps = useCallback(() => {
    if (!token) return;
    workersApi
      .applications(token)
      .then((r) => {
        setApps(r.items);
        setLaborJobs(r.jobs);
        setMyTrust(r.trust ?? null);
      })
      .catch(() => setApps([]));
  }, [token]);
  useEffect(() => {
    loadApps();
  }, [loadApps]);
  useEffect(() => {
    if (tab !== 'supply' || !token) return;
    setSupply(null);
    const a = origin.addr;
    workersApi
      .supply(token, { kind: kind || undefined, group: group || undefined, originProvince: a.province || undefined, originMode: a.addressMode, originDistrict: a.oldDistrict || undefined, originWard: a.oldWard || undefined, originNewWard: a.newWardCode || undefined })
      .then(setSupply)
      .catch(() => setSupply({ districts: [], provinces: [], origin: null }));
  }, [tab, token, kind, group, origin]);

  async function bookInterview() {
    if (!token || !sel.length) return;
    setIvMsg('');
    try {
      const r = await workersApi.setInterview(token, sel, new Date(iv.at).toISOString(), iv.place.trim() || undefined);
      setIvMsg(`Đã hẹn phỏng vấn cho ${r.updated} người.`);
      setShowList(true);
      loadApps();
    } catch (e) {
      setIvMsg((e as Error).message);
    }
  }
  async function attend(id: string, attended: boolean) {
    if (!token) return;
    await workersApi.attendance(token, id, attended).catch((e) => setErr((e as Error).message));
    loadApps();
  }
  async function setCall(item: WorkerSearchItem, status: string, jobId?: string | null) {
    if (!token) return;
    try {
      const r = await workersApi.setContact(token, item.id, status, jobId);
      setData((d) => d && { ...d, items: d.items.map((x) => (x.id === item.id ? { ...x, myStatus: r.status ? { status: r.status, jobId: r.jobId ?? null, updatedAt: r.updatedAt ?? new Date().toISOString() } : null } : x)) });
      if (status === 'hired') loadApps();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  function pickGps() {
    navigator.geolocation?.getCurrentPosition(
      (p) => saveOrigin({ ...origin, lat: Math.round(p.coords.latitude * 1e5) / 1e5, lon: Math.round(p.coords.longitude * 1e5) / 1e5 }),
      () => setErr('Không lấy được vị trí — hãy chọn địa chỉ công ty.'),
      { timeout: 10000 },
    );
  }

  async function note(item: WorkerSearchItem, kindN: 'hired' | 'note', text?: string) {
    if (!token) return;
    try {
      const n = await workersApi.addNote(token, item.id, kindN, text);
      setData((d) => d && { ...d, items: d.items.map((x) => (x.id === item.id ? { ...x, notes: [n, ...x.notes], refreshedAfterHired: false } : x)) });
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function delNote(item: WorkerSearchItem, noteId: string) {
    if (!token) return;
    await workersApi.delNote(token, noteId).catch(() => undefined);
    setData((d) => d && { ...d, items: d.items.map((x) => (x.id === item.id ? { ...x, notes: x.notes.filter((n) => n.id !== noteId) } : x)) });
  }

  const originText = origin.addr.province
    ? [origin.addr.addressMode === 'new' ? origin.addr.newWardName : origin.addr.oldWard, origin.addr.addressMode === 'old' ? origin.addr.oldDistrict : '', origin.addr.province].filter(Boolean).join(', ')
    : 'chưa chọn';
  const groups = kind ? LABOR_GROUPS[kind] : Array.from(new Set(Object.values(LABOR_GROUPS).flat()));

  return (
    <main className="min-h-screen">
      <EmployerHeader />
      <div className="max-w-6xl mx-3 sm:mx-auto my-3 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="tvl-title font-extrabold text-[20px] text-ink">Tìm công nhân, sinh viên, thực tập sinh</h1>
          <Link href="/nha-tuyen-dung/phieu-nhan-xet-thuc-tap" className="rounded-lg border border-border-strong bg-white font-bold text-[13px] px-2.5 py-1.5 text-ink">Phiếu nhận xét thực tập (in)</Link>
          <div role="tablist" className="flex gap-1.5">
            {([['search', 'Tìm ứng viên'], ['apps', `Ứng tuyển vào tin của bạn${apps?.some((a) => !a.seenAt) ? ` (${apps.filter((a) => !a.seenAt).length} mới)` : ''}`], ['supply', 'Nguồn lao động quanh công ty']] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`rounded-lg border px-3 py-1.5 text-[14px] font-bold ${tab === k ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-ink'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {tab === 'search' && (
          <>
            <div className="rounded-xl border border-border bg-white p-2.5 flex flex-wrap gap-2 items-center">
              <select id="el-kind" aria-label="Nhóm ứng viên" className="tvl-input !w-auto !py-2" value={kind} onChange={(e) => { setKind(e.target.value as '' | WorkerKind); setGroup(''); setPage(1); }}>
                <option value="">Tất cả nhóm</option>
                {(Object.keys(KIND_LABEL) as WorkerKind[]).map((k) => (<option key={k} value={k}>{KIND_LABEL[k]}</option>))}
              </select>
              <select id="el-prov" aria-label="Tỉnh/thành ứng viên" className="tvl-input !w-auto !py-2" value={province} onChange={(e) => { setProvince(e.target.value); setPage(1); }}>
                <option value="">Mọi tỉnh/thành</option>
                {provinces.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>
              <select id="el-group" aria-label="Công việc mong muốn" className="tvl-input !w-auto !py-2 max-w-[220px]" value={group} onChange={(e) => { setGroup(e.target.value); setPage(1); }}>
                <option value="">Mọi công việc</option>
                {groups.map((g) => (<option key={g} value={g}>{g}</option>))}
              </select>
              <input id="el-q" aria-label="Tên hoặc số điện thoại" className="tvl-input !w-44 !py-2" placeholder="Tên hoặc SĐT" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())} />
              <select id="el-job" aria-label="Xếp hạng theo tin" className="tvl-input !w-auto !py-2 max-w-[240px]" value={jobId} onChange={(e) => { setJobId(e.target.value); setSort(e.target.value ? 'match' : 'near'); setPage(1); }}>
                <option value="">Xếp hạng theo tin: không</option>
                {laborJobs.filter((j) => !j.filled).map((j) => (<option key={j.id} value={j.id}>{j.title}</option>))}
              </select>
              <button type="button" aria-pressed={today} onClick={() => { setToday(!today); setPage(1); }} className={`rounded-lg border px-3 py-2 text-[13.5px] font-extrabold ${today ? 'border-accent bg-accent text-white' : 'border-border-strong bg-white text-ink'}`}>Hôm nay nên gọi</button>
              <div role="radiogroup" aria-label="Sắp xếp" className="flex rounded-lg border border-border-strong overflow-hidden">
                {([...(jobId ? ([['match', 'Hợp tin nhất']] as const) : []), ['near', 'Gần công ty'], ['recent', 'Mới cập nhật']] as const).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={sort === k} onClick={() => { setSort(k); setPage(1); }} className={`px-3 py-2 text-[13.5px] font-bold ${sort === k ? 'bg-primary text-white' : 'bg-white text-ink'}`}>{l}</button>
                ))}
              </div>
              <select id="el-call" aria-label="Sổ gọi điện" className="tvl-input !w-auto !py-2" value={callStatus} onChange={(e) => { setCallStatus(e.target.value); setPage(1); }}>
                <option value="">Sổ gọi: tất cả</option>
                <option value="none">Chưa gọi</option>
                {CALL_STATUS.map((c) => (<option key={c.v} value={c.v}>{c.l}</option>))}
              </select>
              <select id="el-needs" aria-label="Nhu cầu" className="tvl-input !w-auto !py-2" value={needs} onChange={(e) => { setNeeds(e.target.value); setPage(1); }}>
                <option value="">Mọi nhu cầu</option>
                <option value="housing">Cần chỗ ở</option>
                <option value="shuttle">Cần xe đưa đón</option>
              </select>
              <label className="flex items-center gap-1.5 text-[13.5px] text-ink" htmlFor="el-all">
                <input id="el-all" type="checkbox" className="w-4 h-4" checked={includeNot} onChange={(e) => { setIncludeNot(e.target.checked); setPage(1); }} />Gồm cả người tạm dừng tìm việc
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2" aria-label="Bộ lọc theo nhóm">
              <button type="button" aria-pressed={ef.ready} onClick={() => setE({ ready: !ef.ready })} className={`rounded-lg border px-3 py-2 text-[13.5px] font-extrabold ${ef.ready ? 'border-success bg-success text-white' : 'border-border-strong bg-white text-ink'}`}>Đi làm được ngay</button>
              {(kind === 'worker' || kind === '') && (
                <>
                  <select id="ef-exp" aria-label="Kinh nghiệm" className="tvl-input !w-auto !py-2" value={ef.exp} onChange={(e) => setE({ exp: e.target.value })}>
                    <option value="">Kinh nghiệm: tất cả</option>
                    <option value="has">Đã có kinh nghiệm</option>
                    <option value="gte1">Từ 1 năm trở lên</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-[13.5px] text-ink" htmlFor="ef-bike"><input id="ef-bike" type="checkbox" className="w-4 h-4" checked={ef.bike} onChange={(e) => setE({ bike: e.target.checked })} />Có xe máy</label>
                  <label className="flex items-center gap-1.5 text-[13.5px] text-ink" htmlFor="ef-health"><input id="ef-health" type="checkbox" className="w-4 h-4" checked={ef.health} onChange={(e) => setE({ health: e.target.checked })} />Có giấy khám sức khoẻ</label>
                </>
              )}
              {kind === 'student' && (
                <select id="ef-hours" aria-label="Số giờ mỗi tuần" className="tvl-input !w-auto !py-2" value={ef.hours} onChange={(e) => setE({ hours: e.target.value })}>
                  <option value="">Giờ/tuần: tất cả</option>
                  {Object.entries(HOURS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              )}
              {kind === 'intern' && (
                <>
                  <select id="ef-months" aria-label="Thời gian thực tập" className="tvl-input !w-auto !py-2" value={ef.months} onChange={(e) => setE({ months: e.target.value })}>
                    <option value="">Thực tập: tất cả</option>
                    {[1, 2, 3, 6].map((m) => <option key={m} value={m}>Từ {m} tháng</option>)}
                  </select>
                  <select id="ef-year" aria-label="Năm học" className="tvl-input !w-auto !py-2" value={ef.year} onChange={(e) => setE({ year: e.target.value })}>
                    <option value="">Năm học: tất cả</option>
                    {[2, 3, 4, 5].map((y) => <option key={y} value={y}>Từ năm {y}</option>)}
                  </select>
                </>
              )}
              {(kind === 'student' || kind === 'intern') && (
                <input id="ef-major" aria-label="Ngành học" className="tvl-input !w-40 !py-2" placeholder="Ngành học" value={ef.major} onChange={(e) => setEf({ ...ef, major: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && setPage(1)} />
              )}
            </div>

            <div className="rounded-xl border border-border bg-white p-2.5 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 text-[14px] text-ink">
                <span>Vị trí công ty để tính gần/xa: <b>{originText}</b>{origin.lat != null && ' · đã có toạ độ GPS (tính km thật)'}</span>
                <button type="button" onClick={() => setOriginOpen(!originOpen)} className="font-bold text-primary underline">{originOpen ? 'Đóng' : 'Đổi vị trí'}</button>
              </div>
              {originOpen && (
                <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
                  <AddressPicker value={origin.addr} onChange={(a) => saveOrigin({ ...origin, addr: a })} provinces={provinces} idPrefix="el-org" requireWard={false} />
                  <div className="flex flex-col gap-1.5">
                    <button type="button" onClick={pickGps} className="rounded-lg border border-border-strong bg-white font-bold text-[13.5px] px-3 py-2 text-ink">Dùng vị trí hiện tại (đang ở công ty)</button>
                    {origin.lat != null && <button type="button" onClick={() => saveOrigin({ ...origin, lat: null, lon: null })} className="text-[13px] font-bold text-critical">Bỏ toạ độ GPS</button>}
                  </div>
                </div>
              )}
              <div className="text-[12.5px] text-ink-muted">Khoảng cách ước tính theo phường/xã, quận/huyện và tỉnh; chỉ chính xác theo km khi cả công ty và ứng viên đều dùng vị trí GPS.</div>
            </div>

            {today && <div className="rounded-xl border border-accent bg-white px-3 py-2 text-[13.5px] text-ink"><b>Danh sách gọi hôm nay:</b> hồ sơ làm mới trong 14 ngày, chưa phỏng vấn/nhận/loại; người “chưa nghe máy” hoặc “hẹn gọi lại” chỉ nhắc lại sau 1 ngày. Cập nhật Sổ gọi sau mỗi cuộc để danh sách tự rút gọn.</div>}
            {jobId && <div className="rounded-xl border border-primary bg-white px-3 py-2 text-[13.5px] text-ink"><b>Đang xếp hạng theo tin đã chọn:</b> điểm dựa trên nhóm việc, khoảng cách tới nơi làm việc của tin, ca rảnh, nhu cầu chỗ ở/xe và mức mới của hồ sơ.</div>}
            <div className="rounded-xl border border-warning bg-warning-tint px-3 py-2 text-[13.5px] text-ink">
              <b>Lưu ý:</b> ghi chú &quot;Đã có việc làm&quot; do nhà tuyển dụng khác để lại (không hiện tên công ty) chỉ để tham khảo — <b>bạn vẫn có thể liên hệ thêm</b> để xác nhận.
            </div>
            {err && <div className="rounded-lg border border-critical bg-white px-3 py-2 text-[14px] text-critical font-bold">{err}</div>}

            {data === null ? (
              <div className="rounded-xl border border-border bg-white p-4 text-[14px] text-ink-muted">Đang tải…</div>
            ) : data.items.length === 0 ? (
              <div className="rounded-xl border border-border bg-white p-4 text-[14px] text-ink-muted">Chưa có ứng viên phù hợp bộ lọc.</div>
            ) : (
              <>
                <div className="text-[13.5px] text-ink"><span className="tvl-title !py-0.5">{data.total} ứng viên</span></div>
                <div className="grid lg:grid-cols-2 gap-2">
                  {data.items.map((w) => (
                    <WorkerCard key={w.id} w={w} onNote={note} onDelNote={delNote} onCall={setCall} jobs={laborJobs} />
                  ))}
                </div>
                {data.totalPages > 1 && (
                  <div className="flex justify-center gap-2">
                    <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-border-strong bg-white px-3 py-1.5 font-bold disabled:text-ink-faint">‹ Trước</button>
                    <span className="rounded-lg bg-white px-3 py-1.5 font-bold">{page}/{data.totalPages}</span>
                    <button type="button" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-border-strong bg-white px-3 py-1.5 font-bold disabled:text-ink-faint">Sau ›</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'apps' && laborJobs.length > 0 && (
          <div className="rounded-xl border border-border bg-white p-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2"><div className="font-extrabold text-[15px] text-ink">Tiến độ tuyển đủ số lượng</div>{myTrust && <><span className="text-[13px] text-ink">Điểm uy tín của công ty bạn (ứng viên thấy):</span><TrustBadge t={myTrust} /></>}</div>
            {myTrust && myTrust.score != null && myTrust.score < 75 && <div className="text-[12.5px] text-ink">Muốn tăng điểm: gọi lại ứng viên mới trong 24 giờ và cập nhật trạng thái (đã gọi, hẹn phỏng vấn…) cho mọi đơn ứng tuyển.</div>}
            {laborJobs.map((j) => (
              <div key={j.id} className="grid sm:grid-cols-[1fr_220px_auto] gap-2 items-center text-[14px]">
                <Link href={`/viec-lam/${j.id}`} className="font-bold text-ink hover:text-primary truncate">{j.title}</Link>
                <div>
                  <div className="h-2.5 rounded-full bg-surface-alt overflow-hidden"><div className={`h-full ${j.filled ? 'bg-critical' : 'bg-success'}`} style={{ width: `${Math.min(100, (j.hired / Math.max(1, j.headcount)) * 100)}%` }} /></div>
                  <div className="text-[12.5px] text-ink">Đã nhận {j.hired}/{j.headcount}{j.filled ? ' — đã tự đóng vì đủ người' : ''}{j.ageDays != null && ` · đăng ${j.ageDays} ngày`}</div>
                  {j.forecast && (
                    <div className="mt-1 text-[12.5px] text-ink">
                      Dự báo: tin {j.forecast.scope === 'cùng loại tin' ? 'cùng loại' : `nhóm “${j.forecast.scope}”`} thường tuyển đủ sau <b>~{j.forecast.days} ngày</b> ({j.forecast.samples} tin đã đủ).
                      {(j.ageDays ?? 0) > j.forecast.days * 1.2 && <b className="text-critical"> Tin của bạn đã chậm hơn mức này — thử tăng lương/phụ cấp, thêm KTX hoặc xe đưa đón, hoặc làm mới tin.</b>}
                    </div>
                  )}
                  {j.needExtend && (
                    <div className="mt-1 rounded border border-warning bg-warning-tint px-2 py-1 text-[12.5px] text-ink">
                      Tin đã hơn 30 ngày mà chưa đủ người{j.deadline ? ` (hạn ${j.deadline})` : ''}. Gia hạn thêm 30 ngày và xem lại mức lương/quyền lợi để dễ tuyển hơn.{' '}
                      <button type="button" onClick={() => token && workersApi.extendJob(token, j.id).then(loadApps)} className="font-extrabold text-primary underline">Gia hạn 30 ngày</button>
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => token && workersApi.setFilled(token, j.id, !j.filled).then(loadApps)} className="rounded-lg border border-border-strong bg-white font-bold text-[13px] px-2.5 py-1 text-ink">
                  {j.filled ? 'Mở lại nhận ứng tuyển' : 'Đóng: đã đủ người'}
                </button>
              </div>
            ))}
            <div className="text-[12.5px] text-ink-muted">Đánh dấu &quot;Đã nhận việc&quot; ở bảng dưới hoặc trong sổ gọi điện — đủ số lượng thì tin tự đóng (&quot;Đã tuyển đủ&quot;) và ngừng nhận ứng tuyển; chưa đủ sau 30 ngày thì hệ thống nhắc gia hạn.</div>
          </div>
        )}
        {tab === 'apps' && apps && apps.length > 0 && (
          <div className="rounded-xl border border-border bg-white p-3 flex flex-col gap-2">
            <div className="font-extrabold text-[15px] text-ink">Hẹn phỏng vấn (một hoặc nhiều người cùng lúc)</div>
            <div className="text-[13px] text-ink">Tích chọn ứng viên ở bảng bên dưới, chọn ngày giờ và địa điểm. Ứng viên thấy lịch này trong “Lịch sử ứng tuyển” và tải được vào lịch điện thoại.</div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[13px] font-bold text-ink flex flex-col gap-1" htmlFor="iv-at">Ngày giờ<input id="iv-at" type="datetime-local" className="tvl-input !py-1.5" value={iv.at} onChange={(e) => setIv({ ...iv, at: e.target.value })} /></label>
              <label className="text-[13px] font-bold text-ink flex flex-col gap-1 flex-1 min-w-[200px]" htmlFor="iv-place">Địa điểm<input id="iv-place" className="tvl-input !py-1.5" maxLength={200} placeholder="vd: Cổng 2, KCN Sóng Thần — gặp chị Lan" value={iv.place} onChange={(e) => setIv({ ...iv, place: e.target.value })} /></label>
              <button type="button" disabled={!sel.length || !iv.at} onClick={bookInterview} className="rounded-lg bg-accent text-white font-extrabold text-[13.5px] px-3 py-2 disabled:bg-ink-faint">Hẹn {sel.length || ''} người</button>
              <button type="button" disabled={!sel.length} onClick={() => setShowList(true)} className="rounded-lg border border-border-strong bg-white text-ink font-bold text-[13.5px] px-3 py-2 disabled:text-ink-faint">Xem / in danh sách điểm danh</button>
            </div>
            {ivMsg && <div className="text-[13.5px] font-bold text-success">{ivMsg}</div>}
          </div>
        )}
        {tab === 'apps' && showList && apps && (
          <div className="rounded-xl border-2 border-primary bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
              <div className="font-extrabold text-[15px] text-ink">Danh sách điểm danh phỏng vấn</div>
              <div className="flex gap-2">
                <button type="button" onClick={() => window.print()} className="rounded-lg bg-primary text-white font-bold text-[13.5px] px-3 py-1.5">In danh sách</button>
                <button type="button" onClick={() => setShowList(false)} className="rounded-lg border border-border-strong bg-white font-bold text-[13.5px] px-3 py-1.5 text-ink">Đóng</button>
              </div>
            </div>
            <div id="print-area" className="mt-2 text-ink">
              <h2 className="font-extrabold text-[18px] uppercase">Danh sách điểm danh phỏng vấn</h2>
              <div className="text-[13.5px]">{iv.at ? `Thời gian: ${fmtDateTime(new Date(iv.at).toISOString())}` : ''}{iv.place ? ` · Địa điểm: ${iv.place}` : ''}</div>
              <table className="w-full border-collapse text-[14px] mt-2">
                <thead><tr><th className="border border-border-strong p-1.5 w-10">STT</th><th className="border border-border-strong p-1.5 text-left">Họ và tên</th><th className="border border-border-strong p-1.5 text-left">Điện thoại</th><th className="border border-border-strong p-1.5 text-left">Vị trí</th><th className="border border-border-strong p-1.5 w-24">Có mặt</th><th className="border border-border-strong p-1.5 w-40">Ghi chú</th></tr></thead>
                <tbody>
                  {apps.filter((a) => sel.includes(a.id)).map((a, i) => (
                    <tr key={a.id}><td className="border border-border-strong p-1.5 text-center">{i + 1}</td><td className="border border-border-strong p-1.5">{a.fullName}</td><td className="border border-border-strong p-1.5">{a.phone}</td><td className="border border-border-strong p-1.5">{a.jobTitle}</td><td className="border border-border-strong p-1.5" /><td className="border border-border-strong p-1.5" /></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'apps' && (
          <div className="rounded-xl border border-border bg-white overflow-x-auto">
            {apps === null ? (
              <div className="p-4 text-[14px] text-ink-muted">Đang tải…</div>
            ) : apps.length === 0 ? (
              <div className="p-4 text-[14px] text-ink-muted">Chưa có ai ứng tuyển nhanh. Khi đăng tin, chọn &quot;Loại tin&quot; là Tuyển công nhân / Sinh viên / Thực tập sinh để nhận ứng tuyển bằng số điện thoại.</div>
            ) : (
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="text-left text-ink-muted border-b border-border">
                    <th className="p-2 w-8"><input type="checkbox" aria-label="Chọn tất cả" className="w-4 h-4" checked={sel.length > 0 && sel.length === apps.length} onChange={(e) => setSel(e.target.checked ? apps.map((a) => a.id) : [])} /></th><th className="p-2">Thời gian</th><th className="p-2">Tin tuyển</th><th className="p-2">Ứng viên</th><th className="p-2">Điện thoại</th><th className="p-2">Khu vực</th><th className="p-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a) => (
                    <tr key={a.id} className={`border-b border-border ${a.seenAt ? '' : 'font-bold'}`}>
                      <td className="p-2"><input type="checkbox" aria-label={`Chọn ${a.fullName}`} className="w-4 h-4" checked={sel.includes(a.id)} onChange={(e) => setSel((l) => (e.target.checked ? [...l, a.id] : l.filter((x) => x !== a.id)))} /></td>
                      <td className="p-2 whitespace-nowrap">{fmtDateTime(a.createdAt)}</td>
                      <td className="p-2">{a.jobTitle}</td>
                      <td className="p-2">
                        {a.fullName} <span className="text-ink-muted font-normal">· {KIND_LABEL[a.kind]}</span>
                        {a.groupSize > 1 && <span className="ml-1 rounded bg-primary-tint text-primary text-[12px] font-bold px-1.5 py-0.5">Nhóm {a.groupSize} người · {a.groupCode}</span>}
                      </td>
                      <td className="p-2 whitespace-nowrap"><a href={`tel:${a.phone}`} className="text-primary font-bold">{a.phone}</a></td>
                      <td className="p-2">{[a.newWard ?? a.oldDistrict, a.province].filter(Boolean).join(', ')}</td>
                      <td className="p-2">
                        <select
                          aria-label="Trạng thái ứng tuyển"
                          className="rounded border border-border-strong bg-white px-1.5 py-1 text-[13px] font-normal"
                          value={a.status}
                          onChange={(e) => token && workersApi.appStatus(token, a.id, e.target.value).then(loadApps)}
                        >
                          <option value="new">Mới</option>
                          {CALL_STATUS.map((c) => (<option key={c.v} value={c.v}>{c.l}</option>))}
                        </select>
                        {a.interviewAt && <div className="text-[12.5px] font-normal text-ink mt-1">Hẹn {fmtDateTime(a.interviewAt)}{a.interviewPlace ? ` · ${a.interviewPlace}` : ''}</div>}
                        {(a.status === 'hired' || a.status === 'interview') && !a.startedAt && (
                          <div className="flex gap-1 mt-1">
                            <button type="button" onClick={() => attend(a.id, true)} className="rounded border border-success bg-success-tint text-success font-bold text-[12px] px-1.5 py-0.5">Có đi làm</button>
                            <button type="button" onClick={() => attend(a.id, false)} className="rounded border border-critical bg-critical-tint text-critical font-bold text-[12px] px-1.5 py-0.5">Vắng</button>
                          </div>
                        )}
                        {a.startedAt && <div className="text-[12.5px] font-normal text-success mt-1">Đã đi làm từ {fmtDateTime(a.startedAt)}</div>}
                        {a.kind === 'intern' && a.certRequestedAt && (
                          <div className="mt-1 text-[12.5px] font-normal text-ink">
                            <span className="rounded bg-warning-tint border border-warning font-bold px-1.5 py-0.5">Xin xác nhận thực tập</span>{' '}
                            <Link href="/nha-tuyen-dung/phieu-nhan-xet-thuc-tap" className="font-bold text-primary underline">Mở phiếu nhận xét</Link>
                          </div>
                        )}
                        {a.extra?.ready === 'now' && <div className="mt-1"><span className="rounded bg-success text-white font-bold text-[12px] px-1.5 py-0.5">Đi làm được ngay</span></div>}
                        {a.birthDate && ageOfBirth(a.birthDate) < 18 && <div className="mt-1 text-[12.5px] font-bold text-critical">Chưa đủ 18 tuổi — không giao ca đêm/việc nặng</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {tab === 'supply' && (
          <div className="flex flex-col gap-2">
            <div className="rounded-xl border border-border bg-white p-3 text-[14px] text-ink">
              Người <b>đang tìm việc</b> (làm mới trong 45 ngày) theo quận/huyện của tỉnh <b>{supply?.origin?.province ?? origin.addr.province ?? '—'}</b>
              {kind && <> · nhóm {KIND_LABEL[kind]}</>}{group && <> · {group}</>}. Đổi vị trí công ty ở tab &quot;Tìm ứng viên&quot;. Dùng để chọn tuyến xe đưa đón hoặc nơi treo băng rôn.
            </div>
            {supply === null ? (
              <div className="rounded-xl border border-border bg-white p-4 text-[14px] text-ink-muted">Đang tải…</div>
            ) : supply.districts.length === 0 ? (
              <div className="rounded-xl border border-border bg-white p-4 text-[14px] text-ink-muted">Chưa có người đang tìm việc trong tỉnh này.</div>
            ) : (
              <div className="rounded-xl border border-border bg-white p-3 overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="text-left text-ink-muted"><th className="p-1.5">Quận/huyện</th><th className="p-1.5 w-[45%]">Số người đang tìm việc</th><th className="p-1.5">Công nhân</th><th className="p-1.5">SV</th><th className="p-1.5">TTS</th><th className="p-1.5">Cần chỗ ở</th><th className="p-1.5">Cần xe</th></tr>
                  </thead>
                  <tbody>
                    {supply.districts.map((d) => {
                      const max = supply.districts[0].total || 1;
                      return (
                        <tr key={d.district} className="border-t border-border">
                          <td className="p-1.5 font-bold">{d.district}</td>
                          <td className="p-1.5">
                            <div className="flex items-center gap-2">
                              <div className="h-3 rounded bg-primary" style={{ width: `${Math.max(4, (d.total / max) * 100)}%` }} />
                              <span className="font-extrabold tabular-nums">{d.total}</span>
                            </div>
                          </td>
                          <td className="p-1.5 tabular-nums">{d.worker}</td><td className="p-1.5 tabular-nums">{d.student}</td><td className="p-1.5 tabular-nums">{d.intern}</td>
                          <td className="p-1.5 tabular-nums">{d.housing}</td><td className="p-1.5 tabular-nums">{d.shuttle}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {supply && supply.hours && supply.hours.some((n) => n > 0) && (
              <div className="rounded-xl border border-border bg-white p-3 text-[14px] text-ink">
                <div className="font-extrabold">Giờ vàng đăng tin và gọi điện</div>
                <div className="text-[13.5px]">
                  Ứng viên hay vào làm mới hồ sơ nhất lúc: <b>{(supply.bestHours ?? []).map((b) => `${b.h}h–${b.h + 1}h`).join(', ')}</b>. Nên đăng/làm mới tin và gọi điện vào các khung giờ này.
                </div>
                <div className="mt-2 flex items-end gap-0.5 h-20" role="img" aria-label="Số lượt làm mới hồ sơ theo giờ trong ngày">
                  {supply.hours.map((n, h) => {
                    const mx = Math.max(...supply.hours!);
                    const best = (supply.bestHours ?? []).some((b) => b.h === h);
                    return <div key={h} title={`${h}h: ${n}`} className={`flex-1 rounded-t ${best ? 'bg-accent' : 'bg-primary'}`} style={{ height: `${Math.max(3, (n / mx) * 100)}%` }} />;
                  })}
                </div>
                <div className="flex justify-between text-[11px] text-ink-muted"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
              </div>
            )}
            {supply && supply.dropout && supply.dropout.length > 0 && (
              <div className="rounded-xl border border-border bg-white p-3 text-[14px] text-ink overflow-x-auto">
                <div className="font-extrabold">Tỷ lệ nhận việc nhưng không đi làm (toàn hệ thống, ẩn danh)</div>
                <table className="w-full text-[13.5px] mt-1">
                  <thead><tr className="text-left text-ink-muted"><th className="p-1.5">Nhóm việc</th><th className="p-1.5">Đi làm</th><th className="p-1.5">Không đi làm</th><th className="p-1.5">Tỷ lệ bỏ</th><th className="p-1.5">Nên tuyển dư</th></tr></thead>
                  <tbody>
                    {supply.dropout.map((d) => (
                      <tr key={d.group} className="border-t border-border"><td className="p-1.5 font-bold">{d.group}</td><td className="p-1.5 tabular-nums">{d.hired}</td><td className="p-1.5 tabular-nums">{d.noShow}</td><td className={`p-1.5 tabular-nums font-bold ${d.rate >= 30 ? 'text-critical' : ''}`}>{d.rate}%</td><td className="p-1.5 tabular-nums">+{d.extraPct}%</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-[12.5px] text-ink-muted mt-1">Dữ liệu từ trạng thái “Đã nhận việc” / “Nhận việc nhưng không đi làm” trong Sổ gọi điện. Chỉ hiện nhóm có từ 3 trường hợp trở lên.</div>
              </div>
            )}
            {supply && supply.provinces.length > 0 && (
              <div className="rounded-xl border border-border bg-white p-3 text-[14px] text-ink">
                <b>Tỉnh lân cận:</b> {supply.provinces.map((p) => `${p.province} ${p.total} người (~${p.km} km)`).join(' · ')}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function WorkerCard({
  w, onNote, onDelNote, onCall, jobs,
}: {
  w: WorkerSearchItem;
  onNote: (w: WorkerSearchItem, k: 'hired' | 'note', t?: string) => void;
  onDelNote: (w: WorkerSearchItem, id: string) => void;
  onCall: (w: WorkerSearchItem, status: string, jobId?: string | null) => void;
  jobs: { id: string; title: string; filled: boolean }[];
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const hired = w.notes.find((n) => n.kind === 'hired');
  return (
    <article className="rounded-xl border border-border bg-white p-3 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-extrabold text-[16px] text-ink">{w.fullName}</div>
          <div className="text-[13.5px] text-ink">{GENDER_LABEL[w.gender]} · {w.age} tuổi · <b>{KIND_LABEL[w.kind]}</b>{!w.isSeeking && <span className="text-critical font-bold"> · Tạm dừng tìm việc</span>}</div>
        </div>
        {w.distance && (
          <div className={`rounded-lg px-2 py-1 text-[13px] font-extrabold ${w.outOfRadius ? 'bg-warning-tint text-ink border border-warning' : 'bg-success-tint text-success'}`}>
            {w.distance.label}
          </div>
        )}
      </div>
      {w.match && (
        <div className="rounded-lg border border-primary bg-white px-2 py-1 text-[13px] text-ink">
          <b className={w.match.score >= 60 ? 'text-success' : 'text-ink'}>Hợp tin: {w.match.score}/100</b>
          {w.match.reasons.length > 0 && <> — {w.match.reasons.join(' · ')}</>}
        </div>
      )}
      <div className="text-[14px] text-ink">{placeText(w)}{w.addressDetail ? ` · ${w.addressDetail}` : ''}</div>
      {w.outOfRadius && <div className="text-[12.5px] text-ink">Ứng viên muốn làm trong khoảng {w.radiusKm} km — có thể xa hơn mong muốn.</div>}
      <div className="text-[14px] text-ink"><b>Muốn làm:</b> {w.desiredJobs.join(', ')}{w.radiusKm && !w.outOfRadius ? ` · trong ${w.radiusKm} km` : ''}</div>
      {(w.shifts.length > 0 || w.needsHousing || w.needsShuttle) && (
        <div className="flex flex-wrap gap-1">
          {w.shifts.map((s) => (<span key={s} className="rounded bg-surface-alt border border-border px-1.5 py-0.5 text-[12.5px] text-ink">{s}</span>))}
          {w.needsHousing && <span className="rounded bg-primary-tint px-1.5 py-0.5 text-[12.5px] font-bold text-primary">Cần chỗ ở</span>}
          {w.needsShuttle && <span className="rounded bg-primary-tint px-1.5 py-0.5 text-[12.5px] font-bold text-primary">Cần xe đưa đón</span>}
        </div>
      )}
      {(w.readyNow || w.minor) && (
        <div className="flex flex-wrap gap-1">
          {w.readyNow && <span className="rounded bg-success text-white font-bold text-[12.5px] px-1.5 py-0.5">Đi làm được ngay</span>}
          {w.minor && <span className="rounded border border-critical bg-critical-tint text-critical font-bold text-[12.5px] px-1.5 py-0.5">Chưa đủ 18 tuổi — không giao ca đêm/việc nặng</span>}
        </div>
      )}
      {w.extra && (
        <div className="text-[13.5px] text-ink">
          {[
            w.extra.experience ? EXPERIENCE_LABEL[w.extra.experience] : null,
            w.extra.hasBike ? 'Có xe máy' : null,
            w.extra.hasHealth ? 'Có giấy khám sức khoẻ' : null,
            ...(w.extra.certs ?? []).map((c) => CERT_LABEL[c]),
            w.extra.hours ? HOURS_LABEL[w.extra.hours] : null,
            w.extra.year ? `Năm ${w.extra.year}` : null,
            w.extra.months ? `Thực tập ${w.extra.months} tháng` : null,
            w.extra.sessions ? `${w.extra.sessions} buổi/tuần` : null,
            w.extra.startDate ? `Bắt đầu từ ${new Date(w.extra.startDate).toLocaleDateString('vi-VN')}` : null,
            w.extra.mandatory === 'school' ? 'Thực tập bắt buộc theo trường' : w.extra.mandatory === 'free' ? 'Tự tìm thực tập' : null,
            w.extra.ready && w.extra.ready !== 'now' ? `Đi làm từ ${new Date(w.extra.ready).toLocaleDateString('vi-VN')}` : null,
          ].filter(Boolean).join(' · ')}
        </div>
      )}
      {(w.school || w.major) && <div className="text-[13.5px] text-ink">{[w.school, w.major].filter(Boolean).join(' · ')}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <a href={`tel:${w.phone}`} className="rounded-lg bg-accent text-white font-extrabold text-[14px] px-3 py-1.5">Gọi {w.phone}</a>
        <a href={`https://zalo.me/${w.phone}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border-strong bg-white font-bold text-[13.5px] px-2.5 py-1.5 text-ink">Zalo</a>
        {w.relativePhone && <a href={`tel:${w.relativePhone}`} className="text-[13.5px] text-ink">Người thân: <b className="text-primary">{w.relativePhone}</b></a>}
      </div>
      {w.availability.length > 0 && <div className="text-[13px] text-ink"><b>Lịch rảnh:</b> {slotText(w.availability)}</div>}
      <div className="text-[12.5px] text-ink-muted">
        Cập nhật {ago(w.refreshedAt)} ({fmtDateTime(w.refreshedAt)})
        {w.stale && <span className="ml-1 font-bold text-critical">· Lâu chưa cập nhật (trên 45 ngày) — có thể đã có việc</span>}
      </div>
      {w.examMode && w.examUntil && new Date(w.examUntil) >= new Date(new Date().toDateString()) && (
        <div className="rounded border border-warning bg-warning-tint px-2 py-1 text-[12.5px] font-bold text-ink">{w.examMode === 'pause' ? 'Đang mùa thi' : 'Mùa thi: chỉ nhận ca T7, CN'} đến {new Date(w.examUntil).toLocaleDateString('vi-VN')}</div>
      )}
      <details className="rounded-lg border border-border bg-white">
        <summary className="cursor-pointer px-2 py-1 text-[13px] font-bold text-ink">Kịch bản gọi điện gợi ý</summary>
        <ol className="list-decimal pl-6 pr-2 pb-2 text-[12.5px] text-ink flex flex-col gap-0.5">
          {callScript(w.kind, w.desiredJobs[0], w.fullName).map((x) => (<li key={x}>{x}</li>))}
        </ol>
      </details>
      {w.competition > 0 && (
        <div className="text-[12.5px] font-bold text-ink">
          <span className="rounded bg-warning-tint border border-warning px-1.5 py-0.5">Đã được {w.competition} nhà tuyển dụng khác liên hệ trong 7 ngày</span> — nên gọi sớm.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-surface-alt px-2 py-1.5">
        <span className="text-[12.5px] font-bold text-ink">Sổ gọi:</span>
        {CALL_STATUS.map((c) => {
          const on = w.myStatus?.status === c.v;
          return (
            <button key={c.v} type="button" aria-pressed={on} onClick={() => onCall(w, on ? 'none' : c.v, c.v === 'hired' ? jobs.find((j) => !j.filled)?.id ?? null : w.myStatus?.jobId)} className={`rounded-full border px-2 py-0.5 text-[12.5px] font-bold ${on ? c.cls : 'bg-white border-border-strong text-ink'}`}>
              {c.l}
            </button>
          );
        })}
        {w.myStatus?.status === 'hired' && jobs.length > 0 && (
          <select aria-label="Nhận vào tin" className="rounded border border-border-strong bg-white px-1 py-0.5 text-[12.5px]" value={w.myStatus.jobId ?? ''} onChange={(e) => onCall(w, 'hired', e.target.value || null)}>
            <option value="">— nhận vào tin nào? —</option>
            {jobs.map((j) => (<option key={j.id} value={j.id}>{j.title}</option>))}
          </select>
        )}
        {w.myStatus && <span className="text-[12px] text-ink-muted">{CALL_LABEL[w.myStatus.status]} · {fmtDateTime(w.myStatus.updatedAt)}</span>}
      </div>

      {hired && !hired.mine && (
        <div className="rounded-lg border border-warning bg-warning-tint px-2.5 py-1.5 text-[13px] text-ink">
          <b>Ghi chú từ nhà tuyển dụng khác:</b> {hired.text} — lúc {fmtDateTime(hired.createdAt)}. Bạn vẫn có thể liên hệ thêm.
          {w.refreshedAfterHired && <div className="font-bold text-success">Ứng viên đã làm mới thông tin sau ghi chú này — có thể đang tìm việc lại.</div>}
        </div>
      )}
      {w.notes.filter((n) => n !== hired || n.mine).length > 0 && (
        <ul className="flex flex-col gap-1">
          {w.notes
            .filter((n) => n !== hired || n.mine)
            .map((n) => (
              <li key={n.id} className="text-[13px] text-ink flex flex-wrap gap-1.5 items-center">
                <span className="text-ink-muted">{fmtDateTime(n.createdAt)}</span>
                <span>{n.mine ? 'Bạn ghi:' : 'NTD khác ghi:'}</span>
                <b>{n.text}</b>
                {n.mine && <button type="button" onClick={() => onDelNote(w, n.id)} className="text-critical font-bold">Xoá</button>}
              </li>
            ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!w.notes.some((n) => n.kind === 'hired' && n.mine) && (
          <button type="button" onClick={() => onNote(w, 'hired')} className="rounded-lg border border-border-strong bg-white font-bold text-[13px] px-2.5 py-1 text-ink">Đánh dấu đã có việc làm</button>
        )}
        {adding ? (
          <span className="flex gap-1.5 items-center">
            <input aria-label="Ghi chú" className="tvl-input !py-1 !w-56" maxLength={200} value={text} onChange={(e) => setText(e.target.value)} placeholder="vd: Hẹn phỏng vấn thứ 2" />
            <button type="button" onClick={() => { if (text.trim()) { onNote(w, 'note', text.trim()); setText(''); setAdding(false); } }} className="text-primary font-bold text-[13px]">Lưu</button>
          </span>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="text-primary font-bold text-[13px]">+ Ghi chú</button>
        )}
      </div>
    </article>
  );
}
