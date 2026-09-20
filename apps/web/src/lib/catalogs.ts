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

export const INDUSTRIES: string[] = [
  'Bảo trì / Sửa chữa',
  'Bán lẻ',
  'Biên phiên dịch',
  'Bất động sản',
  'CNTT / Phần mềm',
  'Công nghệ sinh học',
  'Dịch vụ khách hàng',
  'Du lịch',
  'Giáo dục / Đào tạo',
  'Hàng hải',
  'Hành chính / Văn phòng',
  'Khoáng sản',
  'Kinh doanh / Bán hàng',
  'Kế toán / Kiểm toán',
  'Logistics',
  'Marketing',
  'Mới tốt nghiệp / Thực tập',
  'Nhà hàng / Khách sạn',
  'Ngân hàng',
  'Nông nghiệp',
  'Sản xuất / Cơ khí',
  'Tài chính / Đầu tư',
  'Thực phẩm & Đồ uống',
  'Tư vấn',
  'Vận tải',
  'Xây dựng',
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
