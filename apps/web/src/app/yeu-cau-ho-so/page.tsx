'use client';

import { useState } from 'react';
import Link from '@/components/SmartLink';
import SiteHeader from '@/components/SiteHeader';
import { publicProfileRequestApi, workersApi, ApiError } from '@/lib/api';
import { DateSelect, isFullDate } from '@/components/labor/DateSelect';

// Đợt 18c (26/09/2026) — trang công khai để người thật yêu cầu GỠ hoặc NHẬN LẠI hồ sơ “Nguồn tổng hợp”
// (hồ sơ do đội ngũ web tổng hợp từ CV). Không cần đăng nhập; Admin xử lý ở “Nguồn ngoài → CV ứng viên
// → Yêu cầu gỡ / nhận lại”. Máy chủ giới hạn 5 yêu cầu/phút mỗi IP để chống spam.
export default function YeuCauHoSoPage() {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', requestType: '' as '' | 'remove' | 'claim', note: '' });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState<'office' | 'labor'>('office');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.requestType) return setError('Vui lòng chọn loại yêu cầu');
    setSending(true);
    try {
      await publicProfileRequestApi.create({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        requestType: form.requestType,
        note: form.note.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 429
            ? 'Bạn gửi quá nhiều yêu cầu — vui lòng thử lại sau 1 phút.'
            : err.message
          : 'Không gửi được yêu cầu — vui lòng thử lại',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="max-w-2xl mx-3 sm:mx-auto my-4 px-5 sm:px-8 py-6 rounded-2xl border border-border bg-white flex flex-col gap-5">
        <div>
          <h1 className="font-extrabold text-2xl text-ink">Gỡ hoặc nhận lại hồ sơ “Nguồn tổng hợp”</h1>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed">
            Một số hồ sơ ứng viên trên Tuyển Dụng Việc Làm được đội ngũ tổng hợp từ CV (gắn nhãn “Nguồn tổng hợp”). Nếu đó là
            hồ sơ của bạn, bạn có thể yêu cầu <b>gỡ hẳn</b> hoặc <b>nhận lại</b> để tự quản lý (sửa thông tin, ẩn/khoá hồ sơ, ứng
            tuyển trực tiếp). Chúng tôi xác minh qua email / số điện thoại trên CV và phản hồi trong thời gian sớm nhất.
          </p>
        </div>

        <div role="tablist" className="flex gap-1 border-b border-border text-sm font-bold">
          {([['office', 'Hồ sơ nhân viên văn phòng (CV)'], ['labor', 'Hồ sơ công nhân · sinh viên · thực tập']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={who === k} onClick={() => setWho(k)} className={`px-3 py-2.5 border-b-2 -mb-px text-left ${who === k ? 'text-primary border-primary' : 'text-ink-faint border-transparent'}`}>
              {l}
            </button>
          ))}
        </div>

        {who === 'labor' ? (
          <LaborClaimForm />
        ) : done ? (
          <div className="rounded-xl bg-success-tint text-success p-5 text-sm font-semibold">
            Đã nhận yêu cầu của bạn. Đội ngũ quản trị sẽ kiểm tra và liên hệ qua email / số điện thoại bạn cung cấp.
            <div className="mt-3">
              <Link href="/" className="underline">
                Về trang chủ
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-xl bg-white border border-border p-5 flex flex-col gap-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-bold text-ink mb-1">Bạn muốn</legend>
              {(
                [
                  ['remove', 'Gỡ hồ sơ', 'Xoá hồ sơ tổng hợp khỏi hệ thống, nhà tuyển dụng không tìm thấy nữa.'],
                  ['claim', 'Nhận lại hồ sơ', 'Chuyển hồ sơ thành tài khoản của bạn (đăng nhập bằng email bên dưới).'],
                ] as const
              ).map(([v, l, d]) => (
                <label
                  key={v}
                  className={`flex gap-3 items-start rounded-lg border p-3 cursor-pointer ${
                    form.requestType === v ? 'border-primary bg-[#F3F6FB]' : 'border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="requestType"
                    value={v}
                    checked={form.requestType === v}
                    onChange={() => setForm({ ...form, requestType: v })}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-bold text-ink">{l}</span>
                    <span className="block text-xs text-ink-faint">{d}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-ink">Họ và tên *</span>
              <input id="req-name" required maxLength={120} className="tvl-input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-ink">Email *</span>
                <input
                  id="req-email"
                  type="email"
                  required
                  maxLength={150}
                  className="tvl-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-ink">Số điện thoại trên CV</span>
                <input id="req-phone" maxLength={30} className="tvl-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-ink">Ghi chú</span>
              <textarea
                id="req-note"
                maxLength={2000}
                className="tvl-input min-h-[90px]"
                placeholder="VD: đường link hồ sơ, chức danh trên hồ sơ… để chúng tôi tìm đúng hồ sơ nhanh hơn"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </label>
            {error && <div className="rounded-lg bg-critical-tint text-critical text-xs font-semibold px-3.5 py-2.5">{error}</div>}
            <button type="submit" disabled={sending} className="tvl-btn-primary">
              {sending ? 'Đang gửi…' : 'Gửi yêu cầu'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

// Đợt 136 — hồ sơ lao động phổ thông "Nguồn tổng hợp": chính chủ gỡ hoặc nhận lại NGAY bằng số điện thoại + ngày sinh (không cần chờ Admin).
function LaborClaimForm() {
  const [phone, setPhone] = useState('');
  const [birth, setBirth] = useState('');
  const [type, setType] = useState<'' | 'remove' | 'claim'>('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setRes(null);
    if (!type) return setRes({ ok: false, text: 'Vui lòng chọn Gỡ hồ sơ hoặc Nhận lại hồ sơ.' });
    if (!/^0\d{9}$/.test(phone.replace(/\D/g, ''))) return setRes({ ok: false, text: 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0).' });
    if (!isFullDate(birth)) return setRes({ ok: false, text: 'Vui lòng chọn đủ ngày, tháng, năm sinh.' });
    setBusy(true);
    try {
      const r = await workersApi.sourcedRequest(phone.replace(/\D/g, ''), birth, type);
      setRes({ ok: !!r.done, text: r.message });
    } catch (err) {
      setRes({ ok: false, text: err instanceof ApiError ? (err.status === 429 ? 'Bạn thử quá nhiều lần — vui lòng thử lại sau 1 phút.' : err.message) : 'Không gửi được yêu cầu — vui lòng thử lại' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="rounded-xl bg-white border border-border p-5 flex flex-col gap-4">
      <p className="text-sm text-ink-muted leading-relaxed">
        Hồ sơ gắn nhãn “Nguồn tổng hợp” là hồ sơ do đội ngũ web hoặc nhà tuyển dụng thu thập (từ bài đăng tìm việc, danh sách…), không phải bạn tự điền. Nhập <b>số điện thoại</b> và <b>ngày sinh</b> để gỡ hoặc nhận lại ngay.
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-bold text-ink mb-1">Bạn muốn</legend>
        {([['remove', 'Gỡ hồ sơ', 'Xoá hẳn hồ sơ khỏi hệ thống, nhà tuyển dụng không tìm thấy nữa.'], ['claim', 'Nhận lại hồ sơ', 'Hồ sơ thành của bạn: bỏ nhãn “Nguồn tổng hợp”, bạn tự sửa, ẩn hoặc tạm dừng tìm việc.']] as const).map(([v, l, d]) => (
          <label key={v} className={`flex gap-3 items-start rounded-lg border p-3 cursor-pointer ${type === v ? 'border-primary bg-[#F3F6FB]' : 'border-border'}`}>
            <input type="radio" name="laborType" value={v} checked={type === v} onChange={() => setType(v)} className="mt-0.5" />
            <span>
              <span className="block text-sm font-bold text-ink">{l}</span>
              <span className="block text-xs text-ink-faint">{d}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-ink">Số điện thoại *</span>
        <input id="lab-phone" inputMode="tel" maxLength={14} className="tvl-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-ink">Ngày sinh *</span>
        <DateSelect value={birth} onChange={setBirth} idPrefix="lab-bd" />
      </div>
      {res && <div role="status" className={`rounded-lg text-xs font-semibold px-3.5 py-2.5 ${res.ok ? 'bg-success-tint text-success' : 'bg-critical-tint text-critical'}`}>{res.text}</div>}
      <button type="submit" disabled={busy} className="tvl-btn-primary">{busy ? 'Đang xử lý…' : 'Gửi yêu cầu'}</button>
    </form>
  );
}
