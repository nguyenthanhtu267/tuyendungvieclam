// Đợt 10 — danh mục cố định cho thanh tìm kiếm & bộ lọc nâng cao, theo
// claude/06-spec-tim-kiem-nang-cao.md (đọc từ 40 ảnh chụp careerviet.vn — đã đối chiếu với danh
// sách 63 tỉnh/thành trước khi chốt, một số tỉnh đã sáp nhập theo Nghị quyết 2025 được giữ tên phổ
// biến để không lệch với dữ liệu tin tuyển dụng đã có).

export const PINNED_PROVINCES = ['Hà Nội', 'Hồ Chí Minh'];

export const PROVINCE_REGIONS: { region: string; provinces: string[] }[] = [
  {
    region: 'Đồng Bằng Sông Cửu Long',
    provinces: [
      'An Giang', 'Bạc Liêu', 'Bến Tre', 'Cà Mau', 'Cần Thơ', 'Đồng Tháp', 'Hậu Giang',
      'Kiên Giang', 'Long An', 'Sóc Trăng', 'Tiền Giang', 'Trà Vinh', 'Vĩnh Long',
    ],
  },
  {
    region: 'Đồng Bằng Sông Hồng',
    provinces: [
      'Bắc Ninh', 'Hà Nam', 'Hải Dương', 'Hải Phòng', 'Hưng Yên', 'Nam Định',
      'Ninh Bình', 'Thái Bình', 'Vĩnh Phúc',
    ],
  },
  {
    region: 'KV Bắc Trung Bộ',
    provinces: ['Hà Tĩnh', 'Nghệ An', 'Quảng Bình', 'Quảng Trị', 'Thanh Hóa', 'Thừa Thiên Huế'],
  },
  {
    region: 'KV Đông Bắc Bộ',
    provinces: [
      'Bắc Giang', 'Bắc Kạn', 'Cao Bằng', 'Hà Giang', 'Lạng Sơn', 'Phú Thọ',
      'Quảng Ninh', 'Thái Nguyên', 'Tuyên Quang',
    ],
  },
  {
    region: 'KV Đông Nam Bộ',
    provinces: ['Bà Rịa - Vũng Tàu', 'Bình Dương', 'Bình Phước', 'Đồng Nai', 'Tây Ninh'],
  },
  {
    region: 'KV Nam Trung Bộ',
    provinces: [
      'Bình Định', 'Bình Thuận', 'Đà Nẵng', 'Khánh Hòa', 'Ninh Thuận', 'Phú Yên', 'Quảng Nam', 'Quảng Ngãi',
    ],
  },
  {
    region: 'KV Tây Bắc Bộ',
    provinces: ['Điện Biên', 'Hòa Bình', 'Lai Châu', 'Lào Cai', 'Sơn La', 'Yên Bái'],
  },
  {
    region: 'KV Tây Nguyên',
    provinces: ['Đắk Lắk', 'Đắk Nông', 'Gia Lai', 'Kon Tum', 'Lâm Đồng'],
  },
  {
    region: 'Khác',
    provinces: ['Bến Cầu (KCN)', 'Cửa khẩu / Biên giới', 'Toàn quốc từ xa (Remote)'],
  },
];

export const PROVINCES: string[] = [
  ...PINNED_PROVINCES,
  ...PROVINCE_REGIONS.flatMap((r) => r.provinces),
];

// Đợt 12v (21/09/2026) — rà soát lại toàn bộ danh mục theo yêu cầu người dùng (sau khi phát hiện
// thiếu "Nhân sự" ở đợt 12u): đối chiếu với danh mục ngành nghề phổ biến của các trang tuyển dụng lớn
// tại VN (careerviet.vn, TopCV, VietnamWorks), bổ sung thêm 10 ngành còn thiếu — An ninh/Bảo vệ, Bảo
// hiểm, Dệt may/Da giày, Điện/Điện tử/Điện lạnh, Lao động phổ thông, Luật/Pháp lý, Quảng cáo/Truyền
// thông/Đối ngoại, Thiết kế/Mỹ thuật, Viễn thông, Xuất nhập khẩu — sắp theo thứ tự bảng chữ cái tiếng
// Việt cho nhất quán (2 mục cuối "Ngành khác"/"Thương mại điện tử" giữ nguyên vị trí cũ, thêm sau).
export const INDUSTRIES: string[] = [
  'An ninh / Bảo vệ',
  'Bảo hiểm',
  'Bảo trì / Sửa chữa',
  'Bán lẻ',
  'Biên phiên dịch',
  'Bất động sản',
  'CNTT / Phần mềm',
  'Công nghệ sinh học',
  'Dệt may / Da giày',
  'Dịch vụ khách hàng',
  'Du lịch',
  'Điện / Điện tử / Điện lạnh',
  'Giáo dục / Đào tạo',
  'Hàng hải',
  'Hành chính / Văn phòng',
  'Khoáng sản',
  'Kinh doanh / Bán hàng',
  'Kế toán / Kiểm toán',
  'Lao động phổ thông',
  'Logistics',
  'Luật / Pháp lý',
  'Marketing',
  'Mới tốt nghiệp / Thực tập',
  'Nhà hàng / Khách sạn',
  // Đợt 12u (21/09/2026) — bổ sung "Nhân sự" (HR), bị thiếu trong danh mục ngành nghề dùng chung
  // (FilterBar tìm việc, form đăng tin, mega menu) — người dùng phát hiện không tìm thấy khi lọc.
  'Nhân sự',
  'Ngân hàng',
  'Nông nghiệp',
  'Quảng cáo / Truyền thông / Đối ngoại',
  'Sản xuất / Cơ khí',
  'Tài chính / Đầu tư',
  'Thiết kế / Mỹ thuật',
  'Thực phẩm & Đồ uống',
  'Tư vấn',
  'Vận tải',
  'Viễn thông',
  'Xây dựng',
  'Xuất nhập khẩu',
  'Y tế / Dược',
  'Ngành khác',
  'Thương mại điện tử',
];

export const SALARY_TIERS: { label: string; value: number }[] = [
  { label: 'Mức lương', value: 0 },
  { label: 'Từ 3.000.000 đ', value: 3 },
  { label: 'Từ 5.000.000 đ', value: 5 },
  { label: 'Từ 7.000.000 đ', value: 7 },
  { label: 'Từ 10.000.000 đ', value: 10 },
  { label: 'Từ 15.000.000 đ', value: 15 },
  { label: 'Từ 20.000.000 đ', value: 20 },
  { label: 'Từ 30.000.000 đ', value: 30 },
  { label: 'Từ 40.000.000 đ', value: 40 },
  { label: 'Từ 50.000.000 đ', value: 50 },
  { label: 'Từ 60.000.000 đ', value: 60 },
  { label: 'Từ 70.000.000 đ', value: 70 },
];

export const LEVELS: string[] = [
  'Sinh viên / Thực tập sinh',
  'Mới tốt nghiệp',
  'Nhân viên',
  'Trưởng nhóm / Giám sát',
  'Quản lý',
  'Quản lý cấp cao',
  'Điều hành cấp cao',
];

export const POSTED_WITHIN_OPTIONS: { label: string; value: string }[] = [
  { label: '3 ngày trước', value: '3d' },
  { label: '1 tuần trước', value: '7d' },
  { label: '2 tuần trước', value: '14d' },
  { label: '1 tháng trước', value: '30d' },
];

export const EMPLOYMENT_TYPES: string[] = [
  'Nhân viên chính thức',
  'Tạm thời/Dự án',
  'Thời vụ - Nghề tự do',
  'Thực tập',
];

export const EXPERIENCE_LEVELS: string[] = [
  'Không yêu cầu kinh nghiệm',
  'Chưa có kinh nghiệm',
  'Đến dưới 1 năm',
  'Từ 1 đến 4 năm',
  'Từ 5 đến 7 năm',
  'Từ 7 đến 10 năm',
  'Từ 11 năm',
];

// Đợt 12k (21/09/2026) — cho ô "Giới tính" trong form Đăng tin (khối "Thông tin khác" ở trang chi
// tiết tin, theo mẫu careerviet.vn).
export const GENDER_OPTIONS: string[] = ['Không yêu cầu', 'Nam', 'Nữ'];
