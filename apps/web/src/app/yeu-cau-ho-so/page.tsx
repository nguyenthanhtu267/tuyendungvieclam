'use client';

import { useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { publicProfileRequestApi, ApiError } from '@/lib/api';

// Đợt 18c (26/09/2026) — trang công khai để người thật yêu cầu GỠ hoặc NHẬN LẠI hồ sơ “Nguồn tổng hợp”
// (hồ sơ do đội ngũ web tổng hợp từ CV). Không cần đăng nhập; Admin xử lý ở “Nguồn ngoài → CV ứng viên
// → Yêu cầu gỡ / nhận lại”. Máy chủ giới hạn 5 yêu cầu/phút mỗi IP để chống spam.
export default function YeuCauHoSoPage() {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', requestType: '' as '' | 'remove' | 'claim', note: '' });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <main className="min-h-screen bg-bg">
      <SiteHeader />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-5">
        <div>
          <h1 className="font-extrabold text-2xl text-ink">Gỡ hoặc nhận lại hồ sơ “Nguồn tổng hợp”</h1>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed">
            Một số hồ sơ ứng viên trên Tuyển Dụng Việc Làm được đội ngũ tổng hợp từ CV (gắn nhãn “Nguồn tổng hợp”). Nếu đó là
            hồ sơ của bạn, bạn có thể yêu cầu <b>gỡ hẳn</b> hoặc <b>nhận lại</b> để tự quản lý (sửa thông tin, ẩn/khoá hồ sơ, ứng
            tuyển trực tiếp). Chúng tôi xác minh qua email / số điện thoại trên CV và phản hồi trong thời gian sớm nhất.
          </p>
        </div>

        {done ? (
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
                    form.requestType === v ? 'border-primary bg-primary/5' : 'border-border'
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
