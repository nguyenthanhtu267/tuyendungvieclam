// Đợt 16 (25/09/2026) — mục 22a danh sách lỗi: người dùng muốn "tìm logo theo tên công ty" cho các
// công ty chưa có logo. Vì backend không lưu trữ tệp ảnh tải lên (chưa nối Cloudflare R2 — quyết
// định đã chốt từ Đợt 12ab, NTD chỉ dán link ảnh vào `logoUrl`), và vì việc dò tìm + xác nhận đúng
// logo THẬT của từng công ty theo tên cần con người xem/chọn (xem thêm công cụ Admin thủ công ở
// admin.service.ts#updateCompanyLogo + FeaturedEmployersCard ở trang admin dashboard), lớp này chỉ
// lo phần có thể làm HOÀN TOÀN tự động và an toàn: công ty nào đã lưu sẵn `website` nhưng CHƯA dán
// `logoUrl` thủ công thì tự động dùng favicon công khai của website đó làm ảnh đại diện tạm — không
// cần thao tác tay, không cần tải/lưu file (vẫn chỉ là 1 URL ảnh ngoài, giống hệt cơ chế `logoUrl`
// hiện có), áp dụng ngay cho mọi công ty hiện có + công ty mới sau này.
//
// Dùng dịch vụ favicon miễn phí của Google (không cần API key, không giới hạn dùng thử như một số
// dịch vụ logo thương mại): https://www.google.com/s2/favicons?domain=<domain>&sz=128
// Nhược điểm đã biết (đã nói rõ với người dùng khi hỏi trước khi code): ảnh trả về là favicon nhỏ
// của website, không đẹp/nét bằng logo thật — công ty muốn logo đẹp hơn thì dùng công cụ Admin thủ
// công để thay bằng URL logo thật, sau đó `logoUrl` đã lưu sẽ luôn được ưu tiên hơn favicon tự động.
export function resolveCompanyLogoUrl(company: {
  logoUrl?: string | null;
  website?: string | null;
}): string | undefined {
  if (company.logoUrl && company.logoUrl.trim()) return company.logoUrl.trim();
  const domain = extractDomain(company.website);
  if (!domain) return undefined;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

function extractDomain(website?: string | null): string | undefined {
  if (!website) return undefined;
  const trimmed = website.trim();
  if (!trimmed) return undefined;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const hostname = new URL(withScheme).hostname.replace(/^www\./i, '');
    return hostname || undefined;
  } catch {
    return undefined;
  }
}
