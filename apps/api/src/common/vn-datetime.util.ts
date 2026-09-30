// Đợt 46 — "09:00 thứ Bảy, 03/10/2026" theo giờ Việt Nam cho nội dung thông báo.
export function vnDateTime(d: Date): string {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  const wd: Record<string, string> = { Mon: 'thứ Hai', Tue: 'thứ Ba', Wed: 'thứ Tư', Thu: 'thứ Năm', Fri: 'thứ Sáu', Sat: 'thứ Bảy', Sun: 'Chủ nhật' };
  return `${g('hour')}:${g('minute')} ${wd[g('weekday')] ?? ''}, ${g('day')}/${g('month')}/${g('year')}`;
}
