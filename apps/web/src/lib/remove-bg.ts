// Đợt 162 — TÁCH NỀN + CẮT SÁT cho ảnh người (nam/nữ) Admin tải lên, chạy ngay trên trình duyệt (không gửi ảnh đi đâu).
// Cách làm: lấy màu nền từ viền ảnh → "tràn" từ viền vào trong, xoá mọi điểm ảnh có màu gần màu nền (độ nhạy chỉnh được) →
// làm mềm mép + khử viền màu nền → bỏ mảng rời nhỏ → cắt sát khung người. Ảnh đã có nền trong suốt thì chỉ cắt sát.
// Phù hợp ảnh chụp/ảnh minh hoạ trên nền đơn sắc hoặc gần đơn sắc; nền phức tạp (phong cảnh) cần ảnh PNG đã tách sẵn.
export interface CutoutOptions {
  /** Độ nhạy 0–100: càng cao càng xoá nhiều màu gần nền. Mặc định 38. */
  tolerance: number;
  /** Xoá cả khoảng nền bị người che nửa chừng (giữa tay và thân...), không chỉ vùng nối với viền. */
  fillHoles: boolean;
  /** Bỏ bước tách nền, chỉ cắt sát (ảnh đã tách sẵn). */
  cropOnly: boolean;
  /** Chừa viền quanh người (điểm ảnh). */
  pad: number;
}
export const DEFAULT_CUTOUT: CutoutOptions = { tolerance: 38, fillHoles: false, cropOnly: false, pad: 4 };

export interface CutoutResult {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Ảnh gốc đã có nền trong suốt sẵn. */
  hadAlpha: boolean;
  /** Tỉ lệ điểm ảnh còn lại / tổng (để cảnh báo tách quá tay hoặc không tách được). */
  keptRatio: number;
}

export function cutout(src: Uint8ClampedArray, w: number, h: number, opt: Partial<CutoutOptions> = {}): CutoutResult {
  const o = { ...DEFAULT_CUTOUT, ...opt };
  const n = w * h;
  const d = new Uint8ClampedArray(src); // bản sao để sửa
  let transparent = 0;
  for (let i = 0; i < n; i++) if (d[i * 4 + 3] < 250) transparent++;
  const hadAlpha = transparent / n > 0.02;

  if (!hadAlpha && !o.cropOnly) {
    // 1) màu nền = nhóm màu phổ biến nhất trên viền ảnh
    const buckets = new Map<number, { c: number; r: number; g: number; b: number }>();
    const addB = (x: number, y: number) => {
      const p = (y * w + x) * 4;
      const key = ((d[p] >> 4) << 8) | ((d[p + 1] >> 4) << 4) | (d[p + 2] >> 4);
      const e = buckets.get(key) ?? { c: 0, r: 0, g: 0, b: 0 };
      e.c++; e.r += d[p]; e.g += d[p + 1]; e.b += d[p + 2];
      buckets.set(key, e);
    };
    for (let x = 0; x < w; x++) { addB(x, 0); addB(x, h - 1); }
    for (let y = 1; y < h - 1; y++) { addB(0, y); addB(w - 1, y); }
    let best = { c: 0, r: 255, g: 255, b: 255 };
    buckets.forEach((e) => { if (e.c > best.c) best = e; });
    const br = best.r / best.c || 255, bg = best.g / best.c || 255, bb = best.b / best.c || 255;
    const dist = (p: number) => Math.max(Math.abs(d[p] - br), Math.abs(d[p + 1] - bg), Math.abs(d[p + 2] - bb));
    const tol = Math.max(2, Math.min(100, o.tolerance)) * 1.6; // 0–100 → 0–160 (khoảng cách màu lớn nhất theo kênh)

    // 2) tràn từ viền vào trong
    const removed = new Uint8Array(n);
    const queue = new Int32Array(n);
    let qh = 0, qt = 0;
    const push = (x: number, y: number) => {
      const i = y * w + x;
      if (removed[i]) return;
      if (dist(i * 4) <= tol) { removed[i] = 1; queue[qt++] = i; }
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (qh < qt) {
      const i = queue[qh++];
      const x = i % w, y = (i / w) | 0;
      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < h - 1) push(x, y + 1);
    }
    if (o.fillHoles) for (let i = 0; i < n; i++) if (!removed[i] && dist(i * 4) <= tol * 0.6) removed[i] = 1;

    // 3) mép mềm + khử viền màu nền
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      if (removed[i]) { d[p + 3] = 0; continue; }
      const x = i % w, y = (i / w) | 0;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && removed[yy * w + xx]) { near = true; break; }
      }
      if (!near) continue;
      const dv = dist(p);
      if (dv < tol * 1.8) {
        const a = Math.max(0, Math.min(1, (dv - tol * 0.8) / (tol * 1.0)));
        if (a < 1) {
          if (a > 0.05) {
            d[p] = Math.max(0, Math.min(255, (d[p] - br * (1 - a)) / a));
            d[p + 1] = Math.max(0, Math.min(255, (d[p + 1] - bg * (1 - a)) / a));
            d[p + 2] = Math.max(0, Math.min(255, (d[p + 2] - bb * (1 - a)) / a));
          }
          d[p + 3] = Math.round(d[p + 3] * a);
        }
      }
    }

    // 4) bỏ mảng rời nhỏ (bóng đổ, đốm nền còn sót): giữ các mảng ≥ 4% mảng lớn nhất
    const label = new Int32Array(n).fill(-1);
    const sizes: number[] = [];
    const stack = new Int32Array(n);
    for (let s = 0; s < n; s++) {
      if (label[s] !== -1 || d[s * 4 + 3] < 24) continue;
      const id = sizes.length;
      let sp = 0, cnt = 0;
      stack[sp++] = s; label[s] = id;
      while (sp) {
        const i = stack[--sp]; cnt++;
        const x = i % w, y = (i / w) | 0;
        const tryN = (j: number) => { if (label[j] === -1 && d[j * 4 + 3] >= 24) { label[j] = id; stack[sp++] = j; } };
        if (x > 0) tryN(i - 1);
        if (x < w - 1) tryN(i + 1);
        if (y > 0) tryN(i - w);
        if (y < h - 1) tryN(i + w);
      }
      sizes.push(cnt);
    }
    const maxS = Math.max(0, ...sizes);
    for (let i = 0; i < n; i++) {
      const l = label[i];
      if (l >= 0 && sizes[l] < maxS * 0.04) d[i * 4 + 3] = 0;
    }
  }

  // 5) cắt sát phần còn lại
  let x0 = w, y0 = h, x1 = -1, y1 = -1, kept = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 12) {
      kept++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { data: d, width: w, height: h, hadAlpha, keptRatio: 0 };
  x0 = Math.max(0, x0 - o.pad); y0 = Math.max(0, y0 - o.pad); x1 = Math.min(w - 1, x1 + o.pad); y1 = Math.min(h - 1, y1 + o.pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const from = ((y0 + y) * w + x0) * 4;
    out.set(d.subarray(from, from + cw * 4), y * cw * 4);
  }
  return { data: out, width: cw, height: ch, hadAlpha, keptRatio: kept / n };
}
