// Đợt 91 — "đợi trang hydrate xong rồi mới cập nhật các Provider".
//
// Vấn đề đo được: HTML trang (SSR) hiện ra rất nhanh, nhưng file JS của TRANG (page-*.js) là file tải về CUỐI. Trong lúc đó khung layout
// đã hydrate xong và các Provider (đăng nhập, nền, ngôn ngữ) chạy effect `setState` ngay → Context đổi giá trị trong khi phần nội dung trang
// vẫn chưa hydrate. React không thể "ghép" lại phần HTML đó với giá trị Context mới nên BỎ nó đi và vẽ lại từ đầu: cả trang bị thay bằng
// khung xương (loading.tsx) ~0,5 giây rồi hiện lại → giật bố cục (CLS ≈ 0,12 ở trang chủ trên 4G chậm).
// Cách chữa: các cập nhật Provider ở lần mở đầu chờ tới khi trang tải xong (sự kiện load = mọi file JS đã chạy) + ~250ms để React hydrate
// xong nội dung; có người thao tác hoặc quá 4 giây thì chạy ngay. Điều hướng giữa các trang sau đó không bị ảnh hưởng.
let ready = false;
const queue: Array<() => void> = [];

function flush() {
  if (ready) return;
  ready = true;
  queue.splice(0).forEach((f) => {
    try {
      f();
    } catch {
      /* bỏ qua */
    }
  });
}

if (typeof window !== 'undefined') {
  const afterLoad = () => window.setTimeout(flush, 250);
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
  window.setTimeout(flush, 4000); // dây an toàn
  (['pointerdown', 'keydown', 'touchstart'] as const).forEach((e) => window.addEventListener(e, flush, { once: true, passive: true }));
}

/** Chạy `fn` khi trang đã hydrate xong (hoặc ngay nếu đã xong). Trả về hàm huỷ. */
export function whenPageReady(fn: () => void): () => void {
  if (ready) {
    fn();
    return () => undefined;
  }
  let cancelled = false;
  const wrapped = () => {
    if (!cancelled) fn();
  };
  queue.push(wrapped);
  return () => {
    cancelled = true;
  };
}
