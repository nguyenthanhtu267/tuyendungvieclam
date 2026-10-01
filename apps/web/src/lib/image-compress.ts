// Đợt 111 — thu nhỏ ảnh NGAY TRÊN MÁY trước khi tải lên (WiFi yếu gửi nhanh hơn nhiều). Chỉ ảnh JPG/PNG/WebP lớn; lỗi gì cũng trả lại ảnh gốc.
export async function compressImage(file: File, maxDim = 1280, quality = 0.82): Promise<File> {
  try {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size < 250 * 1024) return file;
    const bmp = await createImageBitmap(file);
    const ratio = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * ratio);
    const h = Math.round(bmp.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
