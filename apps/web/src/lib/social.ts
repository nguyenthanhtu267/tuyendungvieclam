// Đợt 12e (21/09/2026) — chia sẻ tin tuyển dụng lên Facebook cá nhân của NTD, theo yêu cầu người
// dùng. Đã nghiên cứu Facebook Graph API trước khi làm: đăng TỰ ĐỘNG lên dòng thời gian CÁ NHÂN của
// người dùng đã bị Facebook chặn từ đợt thay đổi chính sách tháng 4/2018 (không app nào làm được,
// kể cả của Facebook) — cách hợp lệ duy nhất còn lại là mở Hộp thoại Chia sẻ (Share Dialog) để
// chính người dùng tự bấm "Đăng" (1 cú nhấp), không cần đăng nhập/App ID/App Review.
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tuyendungvieclam.vercel.app';
}

export function jobShareUrl(jobId: string): string {
  return `${getSiteUrl()}/viec-lam/${jobId}`;
}

export function openFacebookShare(url: string) {
  const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  window.open(shareUrl, 'facebook-share', 'width=580,height=650,noopener,noreferrer');
}
