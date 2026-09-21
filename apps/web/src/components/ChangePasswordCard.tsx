'use client';

import { useState, type FormEvent } from 'react';
import { authApi, ApiError } from '@/lib/api';
import PasswordInput from '@/components/PasswordInput';

// Đợt 12a (20/09/2026) — dùng chung cho trang Cài đặt của Ứng viên (/ho-so) và Nhà tuyển dụng
// (/nha-tuyen-dung/tai-khoan). Đây là cách thực tế để đóng rủi ro "mật khẩu Admin mẫu lộ trong
// seed script" và cho phép người dùng tự chủ động đổi mật khẩu định kỳ.
export default function ChangePasswordCard({ token }: { token: string }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới nhập lại không khớp');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword(token, currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể đổi mật khẩu, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-[18px]">
      <div className="font-bold text-[13px] mb-0.5">Đổi mật khẩu</div>
      <div className="text-ink-faint text-[11.3px] mb-3">Nên đổi ngay nếu bạn đang dùng mật khẩu được cấp tạm</div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <PasswordInput
          required
          placeholder="Mật khẩu hiện tại"
          className="tvl-input text-[13px]"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <PasswordInput
          required
          placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
          className="tvl-input text-[13px]"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <PasswordInput
          required
          placeholder="Nhập lại mật khẩu mới"
          className="tvl-input text-[13px]"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error && <div className="text-critical text-[11.5px] font-semibold">{error}</div>}
        {success && <div className="text-success text-[11.5px] font-semibold">Đã đổi mật khẩu thành công.</div>}
        <button type="submit" disabled={loading} className="tvl-btn-primary !w-auto px-4 self-start">
          {loading ? 'Đang lưu…' : 'Đổi mật khẩu'}
        </button>
      </form>
    </div>
  );
}
