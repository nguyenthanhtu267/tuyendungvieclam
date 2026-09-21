'use client';

import { useState, type InputHTMLAttributes } from 'react';

// Đợt 12s (21/09/2026) — ô nhập mật khẩu dùng chung, thêm nút "con mắt" để hiện/ẩn mật khẩu đang gõ
// (người dùng yêu cầu: gõ xong xem lại đúng chưa trước khi bấm Đăng nhập/Đăng ký/Đổi mật khẩu, tránh
// gõ sai mà không biết — nhất là trên điện thoại). Dùng chung 1 component cho mọi ô mật khẩu trong
// toàn trang (đăng nhập, đăng ký, đổi mật khẩu, tài khoản NTD) thay vì sửa lặp lại từng nơi.
type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export default function PasswordInput({ className = '', ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className} pr-10`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // tabIndex -1 để phím Tab đi thẳng từ ô nhập sang nút tiếp theo trong form, không dừng ở
        // nút này — đây là nút phụ trợ xem lại, không phải bước cần thao tác khi điền form.
        tabIndex={-1}
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-ink-faint hover:text-ink transition-colors"
      >
        {visible ? (
          // Con mắt gạch chéo — đang HIỆN mật khẩu, bấm để ẩn đi.
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 2l20 20" strokeLinecap="round" />
            <path
              d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6 0 10 6 10 6a17.5 17.5 0 0 1-3.06 3.63M6.5 6.5C3.6 8.2 2 12 2 12s4 8 10 8a9.6 9.6 0 0 0 5-1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          // Con mắt mở — đang ẨN mật khẩu (mặc định), bấm để hiện.
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path
              d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
