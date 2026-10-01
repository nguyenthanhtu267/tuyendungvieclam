// Đợt 102 — rung nhẹ xác nhận thao tác (điện thoại hỗ trợ Vibration API; iPhone/máy không hỗ trợ thì bỏ qua êm). Tôn trọng chế độ giảm chuyển động.
export function haptic(ms: number | number[] = 12) {
  try {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    navigator.vibrate(ms);
  } catch {
    /* bỏ qua */
  }
}
