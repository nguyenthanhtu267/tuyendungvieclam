'use client';

import { useEffect, useState } from 'react';
import { employerApi, smartApi2, type CandidateDetail, type EmployerApplication } from '@/lib/api';

type Score = { score: number; reasons: string[]; gaps: string[] };
type Mode = null | 'interview' | 'reply' | 'compare';

const TEMPLATES: { id: string; label: string; status: string; text: string }[] = [
  { id: 'thanks', label: 'Cảm ơn và từ chối lịch sự', status: 'rejected', text: 'Chào {ten}, cảm ơn bạn đã quan tâm đến vị trí {vitri} tại {congty}. Sau khi cân nhắc, hồ sơ của bạn chưa phù hợp với nhu cầu hiện tại. Chúng tôi sẽ lưu hồ sơ và liên hệ khi có vị trí phù hợp hơn. Chúc bạn sớm tìm được công việc như ý.' },
  { id: 'reviewing', label: 'Đã nhận và đang xem xét', status: 'reviewing', text: 'Chào {ten}, {congty} đã nhận hồ sơ ứng tuyển vị trí {vitri} của bạn và đang xem xét. Chúng tôi sẽ phản hồi trong thời gian sớm nhất.' },
  { id: 'suitable', label: 'Hồ sơ phù hợp, sẽ liên hệ', status: 'suitable', text: 'Chào {ten}, hồ sơ của bạn phù hợp với vị trí {vitri}. {congty} sẽ liên hệ với bạn để sắp xếp bước tiếp theo, bạn vui lòng giữ liên lạc.' },
  { id: 'remind', label: 'Nhắc lịch phỏng vấn', status: 'interview', text: 'Chào {ten}, {congty} xin nhắc lịch phỏng vấn vị trí {vitri} của bạn. Nếu cần đổi lịch, bạn vui lòng phản hồi sớm để chúng tôi sắp xếp lại.' },
  { id: 'moredocs', label: 'Đề nghị bổ sung hồ sơ', status: 'reviewing', text: 'Chào {ten}, để tiếp tục xét hồ sơ vị trí {vitri}, {congty} đề nghị bạn bổ sung thêm thông tin về kinh nghiệm và thành tích gần nhất. Bạn vui lòng cập nhật hồ sơ hoặc phản hồi tin nhắn này.' },
];

const fill = (t: string, a: EmployerApplication) =>
  t
    .replace(/\{ten\}/g, a.cv?.candidateProfile?.fullName ?? a.cv?.guestFullName ?? 'bạn')
    .replace(/\{vitri\}/g, a.jobPosting?.title ?? 'đã ứng tuyển')
    .replace(/\{congty\}/g, a.jobPosting?.company?.name ?? 'công ty');

// Đợt 64 — thao tác hàng loạt cho hồ sơ đã chọn: mời phỏng vấn, gửi phản hồi theo mẫu, so sánh 2–3 ứng viên.
export default function ApplicantBulkTools({
  token,
  selected,
  scores,
  onDone,
  onClear,
}: {
  token: string;
  selected: EmployerApplication[];
  scores: Record<string, Score>;
  onDone: () => void;
  onClear: () => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // interview
  const [slots, setSlots] = useState<string[]>(['', '', '']);
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');
  // reply
  const [tpl, setTpl] = useState(TEMPLATES[0].id);
  const [text, setText] = useState(TEMPLATES[0].text);
  // compare
  const [details, setDetails] = useState<Record<string, CandidateDetail | null>>({});

  useEffect(() => {
    if (mode !== 'compare') return;
    selected.slice(0, 3).forEach((a) => {
      if (a.id in details) return;
      employerApi
        .getApplicantOnlineProfile(token, a.id)
        .then((d) => setDetails((m) => ({ ...m, [a.id]: d })))
        .catch(() => setDetails((m) => ({ ...m, [a.id]: null })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selected.map((a) => a.id).join(',')]);

  if (selected.length === 0) return null;

  async function runInterview() {
    const iso = slots.filter(Boolean).map((s) => new Date(s).toISOString());
    if (!iso.length) return setMsg('Chọn ít nhất 1 khung giờ.');
    setBusy(true);
    setMsg('');
    let ok = 0;
    for (const a of selected) {
      try {
        await employerApi.proposeInterview(token, a.id, { slots: iso, place: place || undefined, note: note || undefined });
        ok++;
      } catch {
        /* bỏ qua từng đơn lỗi, báo tổng kết */
      }
    }
    setBusy(false);
    setMsg(`Đã gửi lời mời cho ${ok}/${selected.length} ứng viên. Họ sẽ chọn 1 trong các khung giờ.`);
    onDone();
  }
  async function runReply() {
    const t = TEMPLATES.find((x) => x.id === tpl)!;
    setBusy(true);
    setMsg('');
    let ok = 0;
    for (const a of selected) {
      try {
        await smartApi2.updateStatusWithMessage(token, a.id, t.status, fill(text, a));
        ok++;
      } catch {
        /* bỏ qua */
      }
    }
    setBusy(false);
    setMsg(`Đã cập nhật và gửi phản hồi cho ${ok}/${selected.length} ứng viên. Hồ sơ đã ở đúng trạng thái này từ trước sẽ không gửi lại.`);
    onDone();
  }

  const cmp = selected.slice(0, 3);
  const rows: { label: string; get: (a: EmployerApplication, d: CandidateDetail | null) => string; num?: (a: EmployerApplication, d: CandidateDetail | null) => number | null }[] = [
    { label: 'Độ phù hợp', get: (a) => (scores[a.id] ? `${scores[a.id].score}%` : '—'), num: (a) => scores[a.id]?.score ?? null },
    { label: 'Vị trí mong muốn', get: (_a, d) => d?.desiredPosition ?? '—' },
    { label: 'Kinh nghiệm', get: (_a, d) => (d?.yearsOfExperience != null ? `${d.yearsOfExperience} năm` : '—'), num: (_a, d) => d?.yearsOfExperience ?? null },
    { label: 'Cấp bậc hiện tại', get: (_a, d) => d?.currentLevel ?? '—' },
    { label: 'Học vấn cao nhất', get: (_a, d) => d?.highestDegree ?? d?.educations?.[0]?.degree ?? '—' },
    { label: 'Lương mong muốn (triệu)', get: (_a, d) => (d?.desiredSalaryMin || d?.desiredSalaryMax ? `${d?.desiredSalaryMin ?? ''}${d?.desiredSalaryMin && d?.desiredSalaryMax ? '–' : ''}${d?.desiredSalaryMax ?? ''}` : '—') },
    { label: 'Nơi ở', get: (_a, d) => d?.province ?? '—' },
    { label: 'Kỹ năng', get: (_a, d) => (d?.skills?.length ? d.skills.map((s) => s.skillName).slice(0, 8).join(', ') : '—'), num: (_a, d) => d?.skills?.length ?? null },
    { label: 'Công việc gần nhất', get: (_a, d) => (d?.experiences?.[0] ? `${d.experiences[0].position}${d.experiences[0].companyName ? ' · ' + d.experiences[0].companyName : ''}` : '—') },
    { label: 'Ngoại ngữ', get: (_a, d) => (d?.languages?.length ? d.languages.map((l) => l.language).join(', ') : '—') },
  ];

  return (
    <div className="rounded-xl border border-primary bg-[#F3F6FB] p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-extrabold text-[13.5px]">Đã chọn {selected.length} hồ sơ</span>
        <button type="button" className="tvl-btn-ghost !w-auto px-3 text-[13px]" onClick={() => setMode(mode === 'interview' ? null : 'interview')}>Mời phỏng vấn hàng loạt</button>
        <button type="button" className="tvl-btn-ghost !w-auto px-3 text-[13px]" onClick={() => setMode(mode === 'reply' ? null : 'reply')}>Gửi phản hồi theo mẫu</button>
        <button type="button" disabled={selected.length < 2 || selected.length > 3} title="Chọn 2–3 hồ sơ để so sánh" className="tvl-btn-ghost !w-auto px-3 text-[13px] disabled:text-ink-faint disabled:bg-white" onClick={() => setMode(mode === 'compare' ? null : 'compare')}>So sánh {selected.length >= 2 && selected.length <= 3 ? '' : '(chọn 2–3)'}</button>
        <button type="button" className="ml-auto text-[13px] font-bold text-ink-muted" onClick={onClear}>Bỏ chọn</button>
      </div>
      {msg && <div className="text-[13px] font-semibold">{msg}</div>}

      {mode === 'interview' && (
        <div className="rounded-lg bg-white border border-border p-3 grid gap-2">
          <div className="text-[12.5px] text-ink-muted">Đề xuất tối đa 3 khung giờ; mỗi ứng viên tự chọn 1 khung phù hợp với họ.</div>
          <div className="grid sm:grid-cols-3 gap-2">
            {slots.map((s, i) => (
              <input key={i} id={`bulk-slot-${i}`} type="datetime-local" className="tvl-input" value={s} onChange={(e) => setSlots((l) => l.map((x, k) => (k === i ? e.target.value : x)))} />
            ))}
          </div>
          <input id="bulk-place" className="tvl-input" placeholder="Địa điểm hoặc link phỏng vấn" value={place} onChange={(e) => setPlace(e.target.value)} />
          <input id="bulk-note" className="tvl-input" placeholder="Ghi chú cho ứng viên (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div><button type="button" disabled={busy} onClick={runInterview} className="tvl-btn-primary !w-auto px-5">{busy ? 'Đang gửi…' : `Gửi lời mời cho ${selected.length} người`}</button></div>
        </div>
      )}

      {mode === 'reply' && (
        <div className="rounded-lg bg-white border border-border p-3 grid gap-2">
          <select id="bulk-tpl" className="tvl-input" value={tpl} onChange={(e) => { setTpl(e.target.value); setText(TEMPLATES.find((x) => x.id === e.target.value)!.text); }}>
            {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <textarea id="bulk-reply" className="tvl-input" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="text-[12px] text-ink-faint">{'{ten}'}, {'{vitri}'}, {'{congty}'} tự thay theo từng ứng viên. Ví dụ với người đầu tiên: “{fill(text, selected[0]).slice(0, 110)}…”</div>
          <div><button type="button" disabled={busy} onClick={runReply} className="tvl-btn-primary !w-auto px-5">{busy ? 'Đang gửi…' : `Cập nhật trạng thái và gửi cho ${selected.length} người`}</button></div>
        </div>
      )}

      {mode === 'compare' && cmp.length >= 2 && (
        <div className="rounded-lg bg-white border border-border overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-alt text-left">
                <th className="p-2 w-40" />
                {cmp.map((a) => (
                  <th key={a.id} className="p-2 font-extrabold">{a.cv?.candidateProfile?.fullName ?? a.cv?.guestFullName ?? 'Ứng viên'}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const nums = cmp.map((a) => r.num?.(a, details[a.id] ?? null) ?? null);
                const best = nums.some((n) => n != null) ? Math.max(...nums.map((n) => n ?? -1)) : null;
                return (
                  <tr key={r.label} className="border-t border-border align-top">
                    <td className="p-2 text-ink-muted font-semibold">{r.label}</td>
                    {cmp.map((a, i) => (
                      <td key={a.id} className={`p-2 ${best != null && nums[i] === best && best >= 0 ? 'font-extrabold text-success' : ''}`}>
                        {a.id in details ? (details[a.id] === null && !r.num?.(a, null) && r.label !== 'Độ phù hợp' ? '(hồ sơ khách)' : r.get(a, details[a.id] ?? null)) : '…'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
