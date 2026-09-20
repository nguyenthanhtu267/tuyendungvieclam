// Bảo mật (đợt 12a, 20/09/2026) — các hàm kiểm tra cấu hình bắt buộc trước khi cho server chạy ở
// môi trường production thật, để tránh lặp lại rủi ro đã phát hiện khi rà soát trước triển khai:
// JWT_SECRET/CORS còn để giá trị mẫu dành cho môi trường lập trình. Ở môi trường dev (NODE_ENV
// khác 'production'), các hàm này vẫn cho qua với giá trị mặc định tiện dụng như trước.

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

const PLACEHOLDER_JWT_SECRETS = new Set([
  'dev-secret-change-me-in-production',
  'change-me-to-a-long-random-string',
]);

const DEV_DEFAULT_JWT_SECRET = 'dev-secret-change-me-in-production';

// Ai biết được JWT_SECRET có thể tự ký token giả danh BẤT KỲ người dùng nào, kể cả Admin — vì vậy
// khi production PHẢI có 1 chuỗi ngẫu nhiên đủ dài, không được để trống hoặc dùng giá trị mẫu.
export function resolveJwtSecret(value: string | undefined): string {
  if (isProduction()) {
    if (!value || PLACEHOLDER_JWT_SECRETS.has(value) || value.length < 20) {
      throw new Error(
        'JWT_SECRET không hợp lệ cho môi trường production. Hãy đặt biến môi trường JWT_SECRET ' +
          'thành 1 chuỗi ngẫu nhiên dài (khuyến nghị >=32 ký tự), khác các giá trị mẫu trong ' +
          '.env.example, trước khi khởi động server. Ví dụ tạo nhanh: openssl rand -base64 32',
      );
    }
    return value;
  }
  return value ?? DEV_DEFAULT_JWT_SECRET;
}

// CORS mở cho mọi origin (origin: true) chỉ chấp nhận được ở môi trường dev. Production PHẢI khai
// báo rõ domain frontend thật qua CORS_ORIGIN (phân tách bởi dấu phẩy nếu có nhiều domain).
export function resolveCorsOrigins(value: string | undefined): string[] | true {
  if (isProduction() && !value) {
    throw new Error(
      'CORS_ORIGIN bắt buộc phải đặt khi NODE_ENV=production — liệt kê (các) domain frontend thật, ' +
        'phân tách bởi dấu phẩy nếu có nhiều domain (ví dụ: https://tuyendungvieclam.vercel.app).',
    );
  }
  if (!value) return true;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
