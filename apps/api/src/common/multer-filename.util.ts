// Đợt 21 (27/09/2026) — sửa lỗi tên file Tiếng Việt bị lỗi font khi tải file lên (CV, ảnh đại diện,
// giấy phép kinh doanh, "cào CV"...).
//
// multer (dùng busboy bên dưới) đọc tên file trong header `Content-Disposition` của phần
// multipart/form-data theo bảng mã Latin-1 (ISO-8859-1) — đúng RFC 7578 (chuẩn cũ không bắt buộc
// UTF-8), NHƯNG mọi trình duyệt hiện đại lại luôn GỬI tên file dạng byte UTF-8. Kết quả: với tên file
// có dấu Tiếng Việt, `file.originalname` bị đọc nhầm — ví dụ gửi "Phạm Thanh Sơn - KTT.pdf" thì
// `file.originalname` nhận được lại là "Pháº¡m Thanh SÆ¡n - KTT.pdf" (lỗi font kiểu mojibake).
//
// Đã kiểm chứng trực tiếp với multer đang dùng trong dự án (script kiểm thử gửi multipart thật) —
// đúng như mô tả trên, và `Buffer.from(originalname, 'latin1').toString('utf8')` sửa đúng lại tên gốc.
//
// Gọi hàm này NGAY khi nhận `file.originalname` từ `@UploadedFile()`/`FileInterceptor`, trước khi lưu
// hay dùng tên file ở bất cứ đâu (CSDL, Google Drive, header tải xuống...).
export function fixMulterFilename(name?: string | null): string | undefined {
  if (!name) return name ?? undefined;
  let repaired: string;
  try {
    repaired = Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
  // Tên gốc thuần ASCII (không dấu, không ký tự đặc biệt) → latin1 và utf8 luôn ra cùng một chuỗi,
  // không có gì để sửa.
  if (repaired === name) return name;
  // Giải mã lại sinh ký tự thay thế (U+FFFD) → các byte gốc KHÔNG phải UTF-8 hợp lệ khi đọc lại theo
  // cách này, tức tên gốc không bị lỗi theo kiểu latin1-hoá-UTF8 — giữ nguyên tên gốc cho an toàn
  // (tránh sửa nhầm những tên file hiếm khi vốn đã ở dạng mã khác).
  if (repaired.includes('�')) return name;
  return repaired;
}
