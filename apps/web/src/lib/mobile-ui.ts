// Đợt 159 — trên điện thoại/máy tính bảng: chọn xong một gợi ý thì HẠ bàn phím ngay (bỏ focus ô nhập) để bàn phím và danh sách
// không che màn hình, tránh bấm nhầm sang nút khác. Máy tính (chuột) giữ nguyên focus để gõ tiếp.
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches;
}
export function dismissKeyboard(el?: HTMLElement | null) {
  if (!isTouchDevice()) return;
  const t = el ?? (document.activeElement as HTMLElement | null);
  if (t && typeof t.blur === 'function') t.blur();
}
