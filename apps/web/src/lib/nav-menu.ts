// Đợt 11 — nội dung mega-menu điều hướng, theo claude/06-spec-tim-kiem-nang-cao.md mục 5 (nguồn ảnh
// A33–A40 chỉ còn bản tóm tắt cấu trúc — 4 cột/5 nhóm cho "Tìm Việc Làm", 8 công cụ cho "Tiện Ích",
// 8 mục tài khoản ứng viên, 4 mục "Dành cho Nhà Tuyển Dụng" — không còn ảnh gốc để lấy đúng từng
// nhãn, nên nội dung bên dưới lấy trực tiếp từ danh mục & trang thật đã lập trình (catalogs.ts, các
// route đã có) thay vì bịa nhãn không kiểm chứng được).
import { INDUSTRIES, LEVELS, PINNED_PROVINCES, PROVINCE_REGIONS, SALARY_TIERS } from './catalogs';

export interface NavLinkItem {
  label: string;
  href: string;
}

export interface NavMenuGroup {
  title: string;
  items: NavLinkItem[];
  more?: NavLinkItem;
}

// Nhóm 1: Ngành nghề (cột 1)
const TOP_INDUSTRIES = INDUSTRIES.slice(0, 10);
// Nhóm 2: Địa điểm (cột 2) — 2 tỉnh ghim đầu + các tỉnh vùng đầu tiên cho gọn trong 1 cột
const TOP_PROVINCES = [...PINNED_PROVINCES, ...PROVINCE_REGIONS.flatMap((r) => r.provinces).slice(0, 8)];

export const JOBS_MEGA_MENU: { columns: NavMenuGroup[][] } = {
  columns: [
    [
      {
        title: 'Ngành Nghề',
        items: TOP_INDUSTRIES.map((i) => ({ label: i, href: `/viec-lam?industries=${encodeURIComponent(i)}` })),
        more: { label: 'Xem tất cả ngành nghề →', href: '/viec-lam' },
      },
    ],
    [
      {
        title: 'Địa Điểm',
        items: TOP_PROVINCES.map((p) => ({ label: p, href: `/viec-lam?provinces=${encodeURIComponent(p)}` })),
        more: { label: 'Xem tất cả tỉnh, thành →', href: '/viec-lam' },
      },
    ],
    [
      {
        title: 'Cấp Bậc',
        items: LEVELS.map((l) => ({ label: l, href: `/viec-lam?level=${encodeURIComponent(l)}` })),
      },
    ],
    [
      {
        title: 'Mức Lương',
        items: SALARY_TIERS.filter((t) => t.value > 0)
          .slice(0, 6)
          .map((t) => ({ label: t.label, href: `/viec-lam?salaryTier=${t.value}` })),
      },
      {
        title: 'Nổi Bật',
        items: [
          { label: '🔥 Việc làm khẩn cấp', href: '/viec-lam?urgentOnly=1' },
          { label: '💛 Doanh nghiệp yêu thích', href: '/viec-lam?featuredEmployerOnly=1' },
          { label: '🆕 Việc làm mới nhất', href: '/viec-lam?postedWithin=7d' },
          { label: 'Tất cả việc làm', href: '/viec-lam' },
        ],
      },
    ],
  ],
};

// "Tiện Ích" — 8 công cụ tính toán cho ứng viên. Theo quyết định đã chốt (claude/00-quyet-dinh-yeu-cau.md,
// "Hub nội dung phụ trợ"), các công cụ này ở dạng placeholder "Sắp ra mắt" cho tới khi được lập trình
// thật, không phải tính năng bị thiếu của đợt này.
export const UTILITY_TOOLS: string[] = [
  'Tính lương Gross – Net',
  'Tính thuế thu nhập cá nhân',
  'Tính bảo hiểm xã hội',
  'Tính trợ cấp thất nghiệp',
  'Tính trợ cấp thôi việc',
  'Tính lãi suất vay ngân hàng',
  'Trắc nghiệm tính cách nghề nghiệp (MBTI)',
  'Quy đổi điểm IELTS / TOEIC',
];

// Menu tài khoản ứng viên khi đã đăng nhập — 8 mục, trỏ tới các trang/anchor thật đã lập trình
// (đợt 8: hồ sơ trực tuyến + CV Builder; đợt 3: My Center các mục overview/suggestions/applications/cvs/settings).
export const CANDIDATE_ACCOUNT_MENU: NavLinkItem[] = [
  { label: 'Tổng quan hồ sơ', href: '/ho-so#overview' },
  { label: 'Hồ sơ trực tuyến', href: '/ho-so/truc-tuyen' },
  { label: 'Tạo CV', href: '/ho-so/cv' },
  { label: 'Việc làm gợi ý', href: '/ho-so#suggestions' },
  { label: 'Việc làm của tôi', href: '/ho-so#applications' },
  { label: 'CV & tệp đính kèm', href: '/ho-so#cvs' },
  { label: 'Cài đặt', href: '/ho-so#settings' },
];

// Khối navy "Dành cho Nhà Tuyển Dụng" — 4 mục, trỏ tới các route NTD thật đã lập trình.
export const EMPLOYER_CTA_MENU: NavLinkItem[] = [
  { label: 'Đăng Tin Tuyển Dụng', href: '/nha-tuyen-dung/dang-tin' },
  { label: 'Tìm Hồ Sơ Ứng Viên', href: '/nha-tuyen-dung/tim-ho-so' },
  { label: 'Bảng Giá Dịch Vụ', href: '/nha-tuyen-dung/don-hang' },
  { label: 'Đăng Ký Tài Khoản Nhà Tuyển Dụng', href: '/nha-tuyen-dung/dang-ky' },
];
