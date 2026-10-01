'use client';

import ScreeningInput from '@/components/ScreeningInput';
import { useState } from 'react';
import Link from 'next/link';
import { applicationsApi, ApiError } from '@/lib/api';
import { track } from '@/lib/analytics';
import { AdSlot } from '@/components/ads/AdSlot';

const MAX_BYTES = 3 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png';

// Đợt 22 (29/09/2026) — ứng tuyển KHÔNG cần đăng nhập: họ tên, SĐT, email (bắt buộc) + CV gửi bằng file HOẶC
// link (Google Drive...). Không tạo tài khoản; nhà tuyển dụng liên hệ qua SĐT/email đã nhập.
export function GuestApplyForm({
  jobId,
  jobTitle,
  questions = [],
  onCancel,
}: {
  jobId: string;
  jobTitle: string;
  questions?: { q: string }[];
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  function pickFile(f: File | null) {
    setError(null);
    if (f && f.size > MAX_BYTES) {
      setError('File CV vượt quá 3MB — vui lòng chọn file nhẹ hơn hoặc dán link Google Drive.');
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'file' && !file) return setError('Vui lòng chọn file CV (PDF/Word/ảnh) hoặc chuyển sang dán link CV.');
    if (mode === 'link' && !link.trim()) return setError('Vui lòng dán link CV (VD link chia sẻ Google Drive).');
    if (questions.length && questions.some((_, i) => answers[i] !== 'yes' && answers[i] !== 'no')) return setError('Vui lòng trả lời đủ các câu hỏi của nhà tuyển dụng.');
    const form = new FormData();
    form.append('fullName', fullName.trim());
    form.append('phone', phone.trim());
    form.append('email', email.trim());
    if (coverLetter.trim()) form.append('coverLetter', coverLetter.trim());
    if (questions.length) form.append('screeningAnswers', JSON.stringify(answers.slice(0, questions.length)));
    if (mode === 'file' && file) form.append('file', file);
    if (mode === 'link') form.append('cvLink', link.trim());
    setState('submitting');
    try {
      await applicationsApi.applyAsGuest(jobId, form);
      track('apply_submit', { entityType: 'job', entityId: jobId, meta: { guest: true } });
      setState('done');
    } catch (err) {
      setState('idle');
      setError(err instanceof ApiError ? err.message : 'Không thể gửi hồ sơ lúc này, vui lòng thử lại');
    }
  }

  if (state === 'done') {
    return (
      <div className="flex flex-col gap-1 text-success text-sm font-semibold">
        <div>✅ Đã gửi hồ sơ ứng tuyển thành công!</div>
        <div className="text-ink-muted font-normal text-xs">
          Nhà tuyển dụng sẽ liên hệ với bạn qua số điện thoại/email đã nhập. Đăng ký tài khoản miễn phí để theo dõi
          trạng thái hồ sơ và ứng tuyển nhanh hơn ở lần sau.{' '}
          <Link href="/dang-nhap" className="text-primary font-semibold underline">
            Đăng ký
          </Link>
        </div>
        {/* Đợt 24 — banner nhỏ gọn sau khi khách nộp đơn thành công. */}
        <AdSlot slot="apply-success" className="mt-2 font-normal" />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="guest-apply-form">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="font-bold text-sm">Ứng tuyển nhanh — {jobTitle}</div>
        <div className="text-xs text-ink-muted">
          Đã có tài khoản?{' '}
          <Link href="/dang-nhap" className="text-primary font-semibold hover:underline">
            Đăng nhập
          </Link>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold">Họ và tên *</span>
          <input id="guest-fullname" className="tvl-input" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} autoComplete="name" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold">Số điện thoại *</span>
          <input id="guest-phone" className="tvl-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={20} autoComplete="tel" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold">Email *</span>
          <input id="guest-email" className="tvl-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={150} autoComplete="email" />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold">CV của bạn * (chọn 1 trong 2 cách)</span>
        <div className="flex gap-2 text-xs font-semibold">
          {(
            [
              ['file', 'Tải file CV lên'],
              ['link', 'Dán link CV (Google Drive...)'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                setError(null);
              }}
              className={`px-3 py-1.5 rounded-lg border ${mode === key ? 'bg-primary text-white border-primary' : 'border-border text-ink-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === 'file' ? (
          <label key="cv-file" className="flex flex-col gap-1">
            <input id="guest-file" className="tvl-input" type="file" accept={ACCEPT} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            <span className="text-[11px] text-ink-faint">PDF, Word (.doc/.docx) hoặc ảnh JPG/PNG, tối đa 3MB.</span>
          </label>
        ) : (
          <label key="cv-link" className="flex flex-col gap-1">
            <input id="guest-link" className="tvl-input" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/file/d/..." maxLength={1000} />
            <span className="text-[11px] text-ink-faint">
              Nhớ bật chia sẻ &quot;Bất kỳ ai có đường liên kết&quot; để nhà tuyển dụng mở được CV.
            </span>
          </label>
        )}
      </div>

      <ScreeningInput questions={questions} value={answers} onChange={setAnswers} />

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold">Lời nhắn cho nhà tuyển dụng (không bắt buộc)</span>
        <textarea id="guest-cover" className="tvl-input min-h-[70px]" value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} maxLength={2000} />
      </label>

      {error && <div className="text-critical text-xs font-semibold">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" disabled={state === 'submitting'} className="tvl-btn-accent !w-auto px-6">
          {state === 'submitting' ? 'Đang gửi...' : 'Gửi hồ sơ ứng tuyển'}
        </button>
        <button type="button" onClick={onCancel} className="tvl-btn-ghost !w-auto px-4">
          Huỷ
        </button>
      </div>
    </form>
  );
}
