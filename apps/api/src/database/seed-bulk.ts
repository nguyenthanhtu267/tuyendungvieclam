/**
 * Đợt 12b (21/09/2026) — sinh dữ liệu ảo quy mô lớn, đa dạng thật, theo yêu cầu người dùng:
 * ~2167 công ty, ~1245 tin tuyển dụng, ~1029 ứng viên, cùng CV/hồ sơ 13 mục và đơn ứng tuyển demo
 * cho ATS (Đợt 11b). KHÔNG đụng tới 7 công ty/8 tin mẫu của `seed.ts` (đợt 7-10) — script này chỉ
 * cộng thêm, dùng tiền tố nhận diện riêng để an toàn chạy nhiều lần (idempotent):
 *   - Mã số thuế công ty ảo: bắt đầu bằng "9" (7 công ty mẫu cũ đều bắt đầu bằng "03...").
 *   - Email NTD ảo: @ntd-demo.vn — Email ứng viên ảo: @candidate-demo.vn
 * Nếu đã thấy đủ số lượng theo tiền tố trên, script sẽ bỏ qua (không sinh trùng lặp).
 *
 * Mật khẩu chung cho MỌI tài khoản ảo (ứng viên lẫn NTD chính của công ty ảo): Test@123
 * (quyết định người dùng 21/09/2026 — dùng chung 1 mật khẩu test để dễ tự đăng nhập kiểm tra bất kỳ
 * tài khoản nào trong danh sách sinh ra).
 *
 * Chạy: npm run seed:bulk  (sau khi đã chạy `npm run seed` ít nhất 1 lần cho dữ liệu mẫu gốc).
 * Thời gian chạy: vài phút (insert theo lô/chunk để không vượt giới hạn tham số của Postgres).
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { Company, CompanyApprovalStatus } from './entities/company.entity';
import { JobPosting, JobApprovalStatus } from './entities/job-posting.entity';
import { User, UserRole } from './entities/user.entity';
import { CompanyUser, CompanyUserType } from './entities/company-user.entity';
import { CandidateProfile, ProfileVisibility, Gender } from './entities/candidate-profile.entity';
import { CV, CvType } from './entities/cv.entity';
import { Application, ApplicationStatus } from './entities/application.entity';
import {
  CandidateExperience,
  CandidateEducation,
  CandidateCertificate,
  CandidateLanguage,
  CandidateSkill,
  CandidateAchievement,
  CandidateActivity,
  LanguageLevel,
  SkillLevel,
} from './entities/candidate-sections.entity';
import * as entities from './entities';

const entityList = Object.values(entities).filter((e) => typeof e === 'function') as any[];

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: entityList,
  synchronize: false,
});

// ---------------------------------------------------------------------------------------------
// Quy mô mục tiêu (theo yêu cầu người dùng — số "khoảng", không cần khớp tuyệt đối).
// ---------------------------------------------------------------------------------------------
const COMPANY_COUNT = 2167;
const JOB_COUNT = 1245;
const CANDIDATE_COUNT = 1029;

// ---------------------------------------------------------------------------------------------
// Tiện ích ngẫu nhiên
// ---------------------------------------------------------------------------------------------
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function chance(pct: number): boolean {
  return Math.random() * 100 < pct;
}
function sample<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i++) {
    const idx = randInt(0, copy.length - 1);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Insert theo lô — tránh vượt giới hạn 65535 tham số/câu lệnh của Postgres và giảm số round-trip
// so với save() từng bản ghi một (đợt 12b, dữ liệu quy mô lớn).
async function bulkInsert<T>(repo: any, rows: T[], chunkSize = 300, label = '') {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await repo.insert(chunk);
  }
  if (label) console.log(`  → đã insert ${rows.length} ${label}`);
}

// ---------------------------------------------------------------------------------------------
// Danh mục tham chiếu (khớp apps/web/src/lib/catalogs.ts để dữ liệu ảo lọc/tìm kiếm đúng thật).
// ---------------------------------------------------------------------------------------------
const PINNED_PROVINCES = ['Hà Nội', 'Hồ Chí Minh'];
const OTHER_PROVINCES = [
  'An Giang', 'Bạc Liêu', 'Bến Tre', 'Cà Mau', 'Cần Thơ', 'Đồng Tháp', 'Hậu Giang', 'Kiên Giang',
  'Long An', 'Sóc Trăng', 'Tiền Giang', 'Trà Vinh', 'Vĩnh Long', 'Bắc Ninh', 'Hà Nam', 'Hải Dương',
  'Hải Phòng', 'Hưng Yên', 'Nam Định', 'Ninh Bình', 'Thái Bình', 'Vĩnh Phúc', 'Hà Tĩnh', 'Nghệ An',
  'Quảng Bình', 'Quảng Trị', 'Thanh Hóa', 'Thừa Thiên Huế', 'Bắc Giang', 'Bắc Kạn', 'Cao Bằng',
  'Hà Giang', 'Lạng Sơn', 'Phú Thọ', 'Quảng Ninh', 'Thái Nguyên', 'Tuyên Quang', 'Bà Rịa - Vũng Tàu',
  'Bình Dương', 'Bình Phước', 'Đồng Nai', 'Tây Ninh', 'Bình Định', 'Bình Thuận', 'Đà Nẵng',
  'Khánh Hòa', 'Ninh Thuận', 'Phú Yên', 'Quảng Nam', 'Quảng Ngãi', 'Điện Biên', 'Hòa Bình',
  'Lai Châu', 'Lào Cai', 'Sơn La', 'Yên Bái', 'Đắk Lắk', 'Đắk Nông', 'Gia Lai', 'Kon Tum', 'Lâm Đồng',
];
function pickProvince(): string {
  // Thị trường việc làm thật tập trung nhiều ở 2 thành phố lớn — thiên vị có chủ đích cho thật.
  if (chance(45)) return pick(PINNED_PROVINCES);
  return pick(OTHER_PROVINCES);
}
const HCM_DISTRICTS = ['Quận 1', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 7', 'Quận 10', 'Quận 12', 'Thành phố Thủ Đức', 'Quận Bình Thạnh', 'Quận Tân Bình', 'Quận Phú Nhuận', 'Quận Gò Vấp'];
const HN_DISTRICTS = ['Quận Ba Đình', 'Quận Hoàn Kiếm', 'Quận Hai Bà Trưng', 'Quận Đống Đa', 'Quận Cầu Giấy', 'Quận Thanh Xuân', 'Quận Nam Từ Liêm', 'Quận Bắc Từ Liêm', 'Quận Long Biên', 'Quận Hà Đông'];

const INDUSTRIES: string[] = [
  'Bảo trì / Sửa chữa', 'Bán lẻ', 'Biên phiên dịch', 'Bất động sản', 'CNTT / Phần mềm',
  'Công nghệ sinh học', 'Dịch vụ khách hàng', 'Du lịch', 'Giáo dục / Đào tạo', 'Hàng hải',
  'Hành chính / Văn phòng', 'Khoáng sản', 'Kinh doanh / Bán hàng', 'Kế toán / Kiểm toán',
  'Logistics', 'Marketing', 'Mới tốt nghiệp / Thực tập', 'Nhà hàng / Khách sạn', 'Ngân hàng',
  'Nông nghiệp', 'Sản xuất / Cơ khí', 'Tài chính / Đầu tư', 'Thực phẩm & Đồ uống', 'Tư vấn',
  'Vận tải', 'Xây dựng', 'Y tế / Dược', 'Ngành khác', 'Thương mại điện tử',
];
const LEVELS: string[] = [
  'Sinh viên / Thực tập sinh', 'Mới tốt nghiệp', 'Nhân viên', 'Trưởng nhóm / Giám sát',
  'Quản lý', 'Quản lý cấp cao', 'Điều hành cấp cao',
];
const EMPLOYMENT_TYPES: string[] = ['Nhân viên chính thức', 'Tạm thời/Dự án', 'Thời vụ - Nghề tự do', 'Thực tập'];
const EXPERIENCE_LEVELS: string[] = [
  'Không yêu cầu kinh nghiệm', 'Chưa có kinh nghiệm', 'Đến dưới 1 năm', 'Từ 1 đến 4 năm',
  'Từ 5 đến 7 năm', 'Từ 7 đến 10 năm', 'Từ 11 năm',
];
const DEGREES = ['Trung học phổ thông', 'Trung cấp', 'Cao đẳng', 'Cử nhân', 'Kỹ sư', 'Thạc sĩ', 'Tiến sĩ'];

// Cấp bậc → khoảng kinh nghiệm & lương phù hợp (triệu VNĐ) để dữ liệu nhất quán, không vô lý
// (VD "Điều hành cấp cao" mà lương 8 triệu là phi thực tế).
const LEVEL_PROFILE: Record<string, { exp: string; salary: [number, number] }> = {
  'Sinh viên / Thực tập sinh': { exp: 'Chưa có kinh nghiệm', salary: [2, 6] },
  'Mới tốt nghiệp': { exp: 'Đến dưới 1 năm', salary: [6, 10] },
  'Nhân viên': { exp: 'Từ 1 đến 4 năm', salary: [8, 20] },
  'Trưởng nhóm / Giám sát': { exp: 'Từ 1 đến 4 năm', salary: [15, 30] },
  'Quản lý': { exp: 'Từ 5 đến 7 năm', salary: [25, 50] },
  'Quản lý cấp cao': { exp: 'Từ 7 đến 10 năm', salary: [40, 80] },
  'Điều hành cấp cao': { exp: 'Từ 11 năm', salary: [60, 150] },
};

const BENEFITS_POOL = [
  'Bảo hiểm sức khỏe', 'Thưởng KPI', 'Thưởng lễ Tết', 'Laptop', 'Du lịch hằng năm', 'Đào tạo chuyên môn',
  'Làm việc linh hoạt', 'Xe đưa đón', 'Ăn ca', 'Đồng phục', 'Phụ cấp đi lại', 'Nghỉ phép năm',
  'Bảo hiểm nhân thọ', 'Thưởng thâm niên', 'Chế độ thai sản mở rộng', 'Câu lạc bộ thể thao',
];

// Ngân hàng tên công ty — ghép "loại hình + từ khóa thương hiệu (+ từ khóa ngành)" để đa dạng thật,
// tránh trùng lặp hàng loạt như dùng nguyên 1 danh sách cố định.
const COMPANY_PREFIX = [
  'Công ty TNHH', 'Công ty Cổ phần', 'Công ty TNHH MTV', 'Công ty TNHH Thương mại Dịch vụ',
  'Công ty Cổ phần Đầu tư', 'Tập đoàn', 'Công ty TNHH Xuất nhập khẩu', 'Công ty TNHH Sản xuất Thương mại',
  'Công ty TNHH Tư vấn', 'Công ty Cổ phần Tập đoàn',
];
const COMPANY_CORE = [
  'Việt', 'Á Châu', 'Hoàng Gia', 'Phương Nam', 'Đông Dương', 'Thịnh Vượng', 'Kim Cương', 'Ánh Dương',
  'Sao Việt', 'Hòa Bình', 'Tân Tiến', 'Đại Phát', 'Thành Công', 'Phú Quý', 'Minh Phát', 'Gia Phát',
  'An Khang', 'Bình Minh', 'Hoàng Long', 'Đất Việt', 'Sài Gòn', 'Thăng Long', 'Cửu Long', 'Sông Hồng',
  'Hồng Hà', 'Phương Đông', 'Việt Thành', 'Nam Việt', 'Á Đông', 'Tân Việt', 'Hưng Thịnh', 'Đức Thành',
  'Toàn Cầu', 'Liên Việt', 'Kim Long', 'Ngọc Việt', 'Bảo Tín', 'Phát Đạt', 'Tiến Phát', 'Hải Âu',
  'Sen Vàng', 'Hoa Sen', 'Trường Thành', 'Việt Phát', 'Đông Á', 'Nam Phương', 'Hùng Vương', 'Đại Việt',
  'Minh Long', 'An Phát', 'Thái Sơn', 'Kim Ngân', 'Phúc Thành', 'Việt Á', 'Tân Phát', 'Hoàng Phát',
];
const INDUSTRY_SUFFIX: Record<string, string[]> = {
  'CNTT / Phần mềm': ['Công nghệ', 'Số', 'Software', 'Technology'],
  'Bán lẻ': ['Thương mại', 'Retail', 'Bán lẻ'],
  'Bất động sản': ['Địa ốc', 'Bất động sản', 'Land'],
  'Xây dựng': ['Xây dựng', 'Kiến trúc', 'Hạ tầng'],
  'Sản xuất / Cơ khí': ['Cơ khí', 'Công nghiệp', 'Chế tạo'],
  'Logistics': ['Logistics', 'Vận tải', 'Giao nhận'],
  'Vận tải': ['Vận tải', 'Giao thông'],
  'Nhà hàng / Khách sạn': ['Ẩm thực', 'Hospitality', 'Food & Beverage'],
  'Y tế / Dược': ['Dược phẩm', 'Y tế', 'Pharma'],
  'Giáo dục / Đào tạo': ['Giáo dục', 'Đào tạo', 'Academy'],
  'Ngân hàng': ['Tài chính', 'Finance'],
  'Tài chính / Đầu tư': ['Đầu tư', 'Capital', 'Finance'],
  'Du lịch': ['Du lịch', 'Travel'],
  'Thương mại điện tử': ['Thương mại điện tử', 'Digital Commerce'],
  'Thực phẩm & Đồ uống': ['Thực phẩm', 'Food'],
  'Nông nghiệp': ['Nông nghiệp', 'Agri'],
};
const usedCompanyNames = new Set<string>();
function genCompanyName(industry: string): string {
  let name = '';
  for (let attempt = 0; attempt < 20; attempt++) {
    const prefix = pick(COMPANY_PREFIX);
    const cores = sample(COMPANY_CORE, chance(35) ? 2 : 1);
    const suffixPool = INDUSTRY_SUFFIX[industry];
    const suffix = suffixPool && chance(45) ? ` ${pick(suffixPool)}` : '';
    name = `${prefix} ${cores.join(' ')}${suffix}`;
    if (!usedCompanyNames.has(name)) {
      usedCompanyNames.add(name);
      return name;
    }
  }
  // Hết combo đẹp sau 20 lần thử (hiếm) — thêm số thứ tự để chắc chắn không trùng.
  name = `${name} ${randInt(2, 99)}`;
  usedCompanyNames.add(name);
  return name;
}

// Chức danh theo ngành — mỗi ngành vài chức danh phổ biến thật, ghép cấp bậc phía trước khi cần.
const JOB_TITLES_BY_INDUSTRY: Record<string, string[]> = {
  'Bảo trì / Sửa chữa': ['Kỹ thuật viên Bảo trì', 'Nhân viên Sửa chữa Điện lạnh', 'Kỹ sư Bảo trì Thiết bị'],
  'Bán lẻ': ['Nhân viên Bán hàng', 'Quản lý Cửa hàng', 'Nhân viên Thu ngân', 'Trưởng ca Bán lẻ'],
  'Biên phiên dịch': ['Biên dịch viên Tiếng Anh', 'Phiên dịch viên Tiếng Trung', 'Biên dịch viên Tiếng Nhật'],
  'Bất động sản': ['Chuyên viên Kinh doanh Bất động sản', 'Trưởng phòng Kinh doanh Bất động sản', 'Nhân viên Tư vấn Đầu tư Bất động sản'],
  'CNTT / Phần mềm': ['Lập trình viên Backend', 'Lập trình viên Frontend (React)', 'Kỹ sư QA/Tester', 'Quản trị Hệ thống', 'Chuyên viên DevOps', 'Business Analyst'],
  'Công nghệ sinh học': ['Kỹ sư Công nghệ Sinh học', 'Chuyên viên Nghiên cứu & Phát triển'],
  'Dịch vụ khách hàng': ['Nhân viên Chăm sóc Khách hàng', 'Trưởng nhóm Tổng đài', 'Chuyên viên Hỗ trợ Kỹ thuật'],
  'Du lịch': ['Hướng dẫn viên Du lịch', 'Nhân viên Điều hành Tour', 'Chuyên viên Đặt phòng'],
  'Giáo dục / Đào tạo': ['Giáo viên Tiếng Anh', 'Chuyên viên Tuyển sinh', 'Trợ giảng', 'Giảng viên Đào tạo Nội bộ'],
  'Hàng hải': ['Thuyền viên', 'Nhân viên Điều độ Cảng biển'],
  'Hành chính / Văn phòng': ['Nhân viên Hành chính Nhân sự', 'Trợ lý Giám đốc', 'Nhân viên Văn thư Lưu trữ'],
  'Khoáng sản': ['Kỹ sư Địa chất Mỏ', 'Nhân viên Khai thác Khoáng sản'],
  'Kinh doanh / Bán hàng': ['Nhân viên Kinh doanh B2B', 'Chuyên viên Phát triển Thị trường', 'Trưởng nhóm Kinh doanh', 'Giám sát Bán hàng Khu vực'],
  'Kế toán / Kiểm toán': ['Kế toán Tổng hợp', 'Kế toán Công nợ', 'Chuyên viên Kiểm toán Nội bộ', 'Kế toán trưởng'],
  'Logistics': ['Nhân viên Điều phối Vận tải', 'Trưởng nhóm Vận hành Kho', 'Chuyên viên Xuất nhập khẩu'],
  'Marketing': ['Chuyên viên Marketing', 'Content Creator', 'Chuyên viên SEO', 'Trưởng phòng Marketing', 'Chuyên viên Digital Marketing'],
  'Mới tốt nghiệp / Thực tập': ['Thực tập sinh Kinh doanh', 'Thực tập sinh Marketing', 'Thực tập sinh CNTT'],
  'Nhà hàng / Khách sạn': ['Nhân viên Phục vụ', 'Lễ tân Khách sạn', 'Đầu bếp', 'Quản lý Nhà hàng'],
  'Ngân hàng': ['Chuyên viên Tín dụng', 'Giao dịch viên', 'Chuyên viên Thẩm định', 'Trưởng phòng Giao dịch'],
  'Nông nghiệp': ['Kỹ sư Nông nghiệp', 'Nhân viên Quản lý Trang trại'],
  'Sản xuất / Cơ khí': ['Kỹ sư Cơ khí Bảo trì', 'Công nhân Sản xuất', 'Quản đốc Xưởng', 'Kỹ sư Quản lý Chất lượng (QA/QC)'],
  'Tài chính / Đầu tư': ['Chuyên viên Phân tích Tài chính', 'Chuyên viên Đầu tư', 'Kiểm soát viên Tài chính'],
  'Thực phẩm & Đồ uống': ['Nhân viên Sản xuất Thực phẩm', 'Chuyên viên Kiểm soát Chất lượng Thực phẩm'],
  'Tư vấn': ['Chuyên viên Tư vấn Doanh nghiệp', 'Tư vấn viên Tài chính'],
  'Vận tải': ['Tài xế', 'Nhân viên Điều phối Vận tải', 'Giám sát Đội xe'],
  'Xây dựng': ['Kỹ sư Xây dựng', 'Giám sát Công trình', 'Kỹ sư Dự toán', 'Kiến trúc sư'],
  'Y tế / Dược': ['Điều dưỡng viên', 'Dược sĩ', 'Trình dược viên', 'Kỹ thuật viên Xét nghiệm'],
  'Ngành khác': ['Nhân viên Vận hành', 'Chuyên viên Hành chính Tổng hợp'],
  'Thương mại điện tử': ['Chuyên viên Vận hành Sàn TMĐT', 'Chuyên viên Content E-commerce', 'Nhân viên Xử lý Đơn hàng'],
};

const DESCRIPTION_TEMPLATES = [
  (title: string) => `Thực hiện công việc ${title.toLowerCase()} theo phân công của quản lý trực tiếp; phối hợp với các phòng ban liên quan để đảm bảo tiến độ và chất lượng công việc; báo cáo kết quả định kỳ.`,
  (title: string) => `Tìm kiếm, đề xuất và triển khai giải pháp cho vị trí ${title}; chủ động cải tiến quy trình làm việc; tham gia đào tạo, hướng dẫn nhân viên mới khi cần.`,
  (title: string) => `Đảm nhận toàn bộ đầu việc của vị trí ${title} tại chi nhánh/phòng ban được phân công; phối hợp chặt chẽ với các bộ phận liên quan để hoàn thành chỉ tiêu công việc hàng tháng/quý.`,
];
const REQUIREMENT_TEMPLATES = [
  (level: string) => `Tốt nghiệp Cao đẳng/Đại học chuyên ngành liên quan\nƯu tiên ứng viên có kinh nghiệm ở vị trí tương đương\nCó tinh thần trách nhiệm, chủ động trong công việc`,
  (level: string) => `Có khả năng làm việc độc lập lẫn theo nhóm\nKỹ năng giao tiếp, xử lý tình huống tốt\nƯu tiên ứng viên đã có kinh nghiệm ở cấp bậc "${level}"`,
  (level: string) => `Sử dụng thành thạo tin học văn phòng\nCẩn thận, trung thực, chịu được áp lực công việc\nSẵn sàng gắn bó lâu dài với công ty`,
];

// ---------------------------------------------------------------------------------------------
// Ngân hàng tên người Việt cho ứng viên ảo.
// ---------------------------------------------------------------------------------------------
const SURNAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Trương', 'Mai', 'Đào'];
const MIDDLE_MALE = ['Văn', 'Hữu', 'Minh', 'Quốc', 'Đức', 'Thành', 'Công', 'Anh', 'Thanh', 'Xuân'];
const MIDDLE_FEMALE = ['Thị', 'Ngọc', 'Thu', 'Thanh', 'Kim', 'Hồng', 'Mai', 'Diễm', 'Bích', 'Phương'];
const GIVEN_MALE = ['Anh', 'Bình', 'Cường', 'Dũng', 'Duy', 'Đạt', 'Hải', 'Hùng', 'Huy', 'Khang', 'Khoa', 'Long', 'Minh', 'Nam', 'Phong', 'Quang', 'Sơn', 'Tài', 'Thắng', 'Thịnh', 'Tuấn', 'Việt', 'Vinh', 'Đăng', 'Phát', 'Kiên', 'Bảo', 'Hoàng', 'Trung', 'Lâm'];
const GIVEN_FEMALE = ['Anh', 'Chi', 'Diệp', 'Duyên', 'Giang', 'Hà', 'Hạnh', 'Hằng', 'Hoa', 'Huệ', 'Huyền', 'Lan', 'Linh', 'Loan', 'Mai', 'My', 'Ngân', 'Nga', 'Nhung', 'Oanh', 'Phương', 'Quỳnh', 'Thảo', 'Thư', 'Thủy', 'Trang', 'Trinh', 'Uyên', 'Vân', 'Yến'];

function genPersonName(gender: Gender): { fullName: string; lastName: string; firstName: string } {
  const surname = pick(SURNAMES);
  const middle = gender === Gender.MALE ? pick(MIDDLE_MALE) : pick(MIDDLE_FEMALE);
  const given = gender === Gender.MALE ? pick(GIVEN_MALE) : pick(GIVEN_FEMALE);
  return {
    fullName: `${surname} ${middle} ${given}`,
    lastName: `${surname} ${middle}`,
    firstName: given,
  };
}

const SKILLS_POOL = [
  'Microsoft Office', 'Tiếng Anh giao tiếp', 'Kỹ năng giao tiếp', 'Làm việc nhóm', 'Quản lý thời gian',
  'Giải quyết vấn đề', 'Tư duy phản biện', 'Excel nâng cao', 'PowerPoint', 'Photoshop', 'SEO',
  'Google Ads', 'Facebook Ads', 'Chăm sóc khách hàng', 'Kỹ năng bán hàng', 'Đàm phán', 'Quản lý dự án',
  'JavaScript', 'React', 'Node.js', 'Python', 'Java', 'SQL', 'Kế toán', 'Phân tích tài chính',
  'Thiết kế đồ họa', 'AutoCAD', 'Quản lý kho vận', 'Xuất nhập khẩu', 'Tuyển dụng', 'Đào tạo nội bộ',
  'Thuyết trình', 'Viết nội dung', 'Chăm sóc bệnh nhân', 'Sửa chữa điện', 'Vận hành máy CNC', 'Quản lý chất lượng ISO',
];
const LANGUAGES_POOL = ['Tiếng Anh', 'Tiếng Trung', 'Tiếng Nhật', 'Tiếng Hàn', 'Tiếng Pháp', 'Tiếng Đức'];
const CERTS_POOL = ['TOEIC 650', 'IELTS 6.5', 'Chứng chỉ Kế toán trưởng', 'Chứng chỉ PMP', 'Google Ads Certified', 'Chứng chỉ An toàn lao động', 'Chứng chỉ Sư phạm', 'HSK 4', 'JLPT N3', 'Chứng chỉ Tin học văn phòng MOS'];
const SCHOOLS_POOL = ['Đại học Bách Khoa', 'Đại học Kinh tế Quốc dân', 'Đại học Ngoại thương', 'Đại học Kinh tế TP.HCM', 'Đại học Khoa học Tự nhiên', 'Đại học Sư phạm', 'Đại học Công nghiệp', 'Cao đẳng Kinh tế Kỹ thuật', 'Đại học Tôn Đức Thắng', 'Đại học Cần Thơ'];
const MAJORS_POOL = ['Công nghệ thông tin', 'Quản trị Kinh doanh', 'Kế toán', 'Marketing', 'Kinh tế Đối ngoại', 'Cơ khí', 'Tài chính Ngân hàng', 'Xây dựng', 'Ngôn ngữ Anh', 'Du lịch'];
const FOLDER_POOL = ['Ứng viên tiềm năng', 'Vòng 2', 'Chờ phỏng vấn', 'Ưu tiên'];

async function run() {
  await dataSource.initialize();

  const companyRepo = dataSource.getRepository(Company);
  const jobRepo = dataSource.getRepository(JobPosting);
  const userRepo = dataSource.getRepository(User);
  const companyUserRepo = dataSource.getRepository(CompanyUser);
  const candidateRepo = dataSource.getRepository(CandidateProfile);
  const cvRepo = dataSource.getRepository(CV);
  const applicationRepo = dataSource.getRepository(Application);
  const experienceRepo = dataSource.getRepository(CandidateExperience);
  const educationRepo = dataSource.getRepository(CandidateEducation);
  const certificateRepo = dataSource.getRepository(CandidateCertificate);
  const languageRepo = dataSource.getRepository(CandidateLanguage);
  const skillRepo = dataSource.getRepository(CandidateSkill);
  const achievementRepo = dataSource.getRepository(CandidateAchievement);
  const activityRepo = dataSource.getRepository(CandidateActivity);

  // --- Idempotency check — đã chạy rồi thì thôi, tránh sinh trùng lặp khi chạy nhầm lần 2. ------
  const bulkCompanyCount = await companyRepo
    .createQueryBuilder('c')
    .where("c.tax_code LIKE '9%'")
    .getCount();
  if (bulkCompanyCount >= COMPANY_COUNT) {
    console.log(`Đã có ${bulkCompanyCount} công ty ảo (mã số thuế bắt đầu bằng "9") — bỏ qua, không sinh trùng lặp.`);
    await dataSource.destroy();
    return;
  }

  const sharedPasswordHash = await argon2.hash('Test@123');
  console.log('Mật khẩu dùng chung cho toàn bộ tài khoản ảo sinh ra: Test@123');

  // === 1) CÔNG TY ẢO ==============================================================================
  console.log(`\n[1/6] Sinh ${COMPANY_COUNT} công ty ảo...`);
  const companies: Company[] = [];
  const SIZES = ['1-50 nhân viên', '50-150 nhân viên', '150-300 nhân viên', '300-500 nhân viên', '500-1000 nhân viên', 'Trên 1000 nhân viên'];
  for (let i = 0; i < COMPANY_COUNT; i++) {
    const industry = pick(INDUSTRIES);
    const name = genCompanyName(industry);
    let approvalStatus = CompanyApprovalStatus.APPROVED;
    if (chance(3)) approvalStatus = CompanyApprovalStatus.PENDING;
    else if (chance(2)) approvalStatus = CompanyApprovalStatus.REJECTED;
    companies.push(
      companyRepo.create({
        id: randomUUID(),
        name,
        taxCode: `9${String(i).padStart(9, '0')}`,
        size: pick(SIZES),
        industry,
        website: chance(55) ? `https://${name.split(' ').slice(-2).join('').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')}.vn` : undefined,
        approvalStatus,
        isFeaturedEmployer: chance(3),
        createdAt: daysAgo(randInt(1, 400)),
      }),
    );
  }
  await bulkInsert(companyRepo, companies, 300, 'công ty');

  // === 2) TÀI KHOẢN NTD CHÍNH CHO MỖI CÔNG TY (đăng nhập thử được, mật khẩu Test@123) ============
  console.log(`\n[2/6] Sinh tài khoản Nhà tuyển dụng chính cho từng công ty...`);
  const employerUsers: User[] = [];
  const companyUsers: CompanyUser[] = [];
  companies.forEach((company, i) => {
    const userId = randomUUID();
    employerUsers.push(
      userRepo.create({
        id: userId,
        email: `ntd${i + 1}@ntd-demo.vn`,
        fullName: `Bộ phận Nhân sự — ${company.name}`,
        passwordHash: sharedPasswordHash,
        role: UserRole.EMPLOYER_MAIN,
        createdAt: company.createdAt,
      }),
    );
    companyUsers.push(
      companyUserRepo.create({
        id: randomUUID(),
        companyId: company.id,
        userId,
        type: CompanyUserType.MAIN,
        createdAt: company.createdAt,
      }),
    );
  });
  await bulkInsert(userRepo, employerUsers, 300, 'tài khoản NTD');
  await bulkInsert(companyUserRepo, companyUsers, 300, 'liên kết công ty-NTD');

  // === 3) TIN TUYỂN DỤNG ẢO =======================================================================
  console.log(`\n[3/6] Sinh ${JOB_COUNT} tin tuyển dụng ảo...`);
  const approvedCompanies = companies.filter((c) => c.approvalStatus === CompanyApprovalStatus.APPROVED);
  const jobs: JobPosting[] = [];
  for (let i = 0; i < JOB_COUNT; i++) {
    const company = pick(approvedCompanies.length ? approvedCompanies : companies);
    // 85% tin cùng ngành với công ty, 15% khác ngành (NTD tuyển vị trí ngoài ngành chính — thật).
    const industry = chance(85) && company.industry ? company.industry : pick(INDUSTRIES);
    const titles = JOB_TITLES_BY_INDUSTRY[industry] ?? JOB_TITLES_BY_INDUSTRY['Ngành khác'];
    const level = pick(LEVELS);
    const profile = LEVEL_PROFILE[level];
    const province1 = pickProvince();
    const province2 = chance(20) ? pickProvince() : undefined;
    const provinces = province2 && province2 !== province1 ? [province1, province2] : [province1];
    let district: string | undefined;
    if (province1 === 'Hồ Chí Minh' && chance(55)) district = pick(HCM_DISTRICTS);
    else if (province1 === 'Hà Nội' && chance(55)) district = pick(HN_DISTRICTS);

    // Trạng thái duyệt — phần lớn "đang đăng" thật (APPROVED + chưa tạm ngưng), số ít trạng thái
    // khác để Admin/NTD có dữ liệu kiểm thử đa dạng (quyết định người dùng 21/09: "đa dạng thật").
    const roll = Math.random() * 100;
    let approvalStatus = JobApprovalStatus.APPROVED;
    let isPaused = false;
    let deadline = toDateOnly(daysFromNow(randInt(5, 60)));
    if (roll < 4) {
      approvalStatus = JobApprovalStatus.PENDING;
    } else if (roll < 6) {
      approvalStatus = JobApprovalStatus.REJECTED;
    } else if (roll < 8) {
      approvalStatus = JobApprovalStatus.EXPIRED;
      deadline = toDateOnly(daysAgo(randInt(1, 30)));
    } else if (roll < 12) {
      isPaused = true; // vẫn APPROVED — NTD tự tạm ngưng (Đợt 11b)
    }

    const title = pick(titles);
    jobs.push(
      jobRepo.create({
        id: randomUUID(),
        companyId: company.id,
        title,
        industry,
        location: provinces.join(' | '),
        provinces,
        district,
        experienceLevel: profile.exp,
        isUrgent: chance(8),
        isPaused,
        salaryMin: chance(85) ? profile.salary[0] : undefined,
        salaryMax: chance(85) ? profile.salary[1] : undefined,
        employmentType: pick(EMPLOYMENT_TYPES),
        level,
        headcount: chance(70) ? randInt(1, 3) : randInt(4, 15),
        description: pick(DESCRIPTION_TEMPLATES)(title),
        requirements: pick(REQUIREMENT_TEMPLATES)(level),
        benefits: sample(BENEFITS_POOL, randInt(2, 5)),
        deadline,
        approvalStatus,
        createdAt: daysAgo(randInt(0, 90)),
      }),
    );
  }
  await bulkInsert(jobRepo, jobs, 300, 'tin tuyển dụng');

  // === 4) ỨNG VIÊN ẢO (User + CandidateProfile + CV + 13-mục hồ sơ) ==============================
  console.log(`\n[4/6] Sinh ${CANDIDATE_COUNT} ứng viên ảo (hồ sơ + CV)...`);
  const candidateUsers: User[] = [];
  const candidateProfiles: CandidateProfile[] = [];
  const cvs: CV[] = [];
  const experiences: CandidateExperience[] = [];
  const educations: CandidateEducation[] = [];
  const certificates: CandidateCertificate[] = [];
  const languagesRows: CandidateLanguage[] = [];
  const skillsRows: CandidateSkill[] = [];
  const achievements: CandidateAchievement[] = [];
  const activities: CandidateActivity[] = [];

  const primaryCvIdByCandidate: string[] = []; // dùng cho bước 5 (đơn ứng tuyển)

  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const gender = chance(50) ? Gender.MALE : Gender.FEMALE;
    const { fullName, lastName, firstName } = genPersonName(gender);
    const userId = randomUUID();
    const profileId = randomUUID();
    const createdAt = daysAgo(randInt(1, 300));
    const desiredLevel = pick(LEVELS);
    const desiredProfile = LEVEL_PROFILE[desiredLevel];
    const yearsExp = desiredLevel === 'Sinh viên / Thực tập sinh' || desiredLevel === 'Mới tốt nghiệp' ? randInt(0, 1) : randInt(1, 15);
    const visRoll = Math.random() * 100;
    const visibility = visRoll < 70 ? ProfileVisibility.PUBLIC : visRoll < 85 ? ProfileVisibility.URGENT : ProfileVisibility.LOCKED;

    candidateUsers.push(
      userRepo.create({
        id: userId,
        email: `uv${i + 1}@candidate-demo.vn`,
        fullName,
        passwordHash: sharedPasswordHash,
        role: UserRole.CANDIDATE,
        createdAt,
      }),
    );

    const province = pickProvince();
    candidateProfiles.push(
      candidateRepo.create({
        id: profileId,
        userId,
        fullName,
        lastName,
        firstName,
        desiredPosition: pick(Object.values(JOB_TITLES_BY_INDUSTRY).flat()),
        desiredLevel,
        desiredSalaryMin: desiredProfile.salary[0],
        desiredSalaryMax: desiredProfile.salary[1],
        visibility,
        completionPercent: randInt(35, 100),
        gender,
        dateOfBirth: toDateOnly(daysAgo(randInt(21, 45) * 365)),
        phone: `09${randInt(10000000, 99999999)}`,
        province,
        district: province === 'Hồ Chí Minh' ? pick(HCM_DISTRICTS) : province === 'Hà Nội' ? pick(HN_DISTRICTS) : undefined,
        country: 'Việt Nam',
        careerObjective: `Mong muốn phát triển sự nghiệp ở vị trí ${desiredLevel.toLowerCase()}, đóng góp chuyên môn và không ngừng học hỏi trong môi trường làm việc chuyên nghiệp.`,
        desiredIndustries: sample(INDUSTRIES, randInt(1, 3)),
        desiredLocations: [province],
        yearsOfExperience: yearsExp,
        currentLevel: desiredLevel,
        highestDegree: pick(DEGREES),
        createdAt,
      }),
    );

    const cvId = randomUUID();
    primaryCvIdByCandidate.push(cvId);
    cvs.push(
      cvRepo.create({
        id: cvId,
        candidateProfileId: profileId,
        type: CvType.TEMPLATE,
        isPrimary: true,
        createdAt,
      }),
    );

    // Kinh nghiệm làm việc — sinh viên/mới ra trường có thể chưa có (thật).
    const expCount = desiredLevel === 'Sinh viên / Thực tập sinh' ? 0 : randInt(0, 4);
    for (let e = 0; e < expCount; e++) {
      experiences.push(
        experienceRepo.create({
          id: randomUUID(),
          candidateProfileId: profileId,
          position: pick(Object.values(JOB_TITLES_BY_INDUSTRY).flat()),
          companyName: `${pick(COMPANY_PREFIX)} ${pick(COMPANY_CORE)}`,
          startDate: toDateOnly(daysAgo(randInt(400, 2000))),
          endDate: e === 0 && chance(30) ? undefined : toDateOnly(daysAgo(randInt(30, 380))),
          isCurrent: e === 0 && chance(30),
          description: 'Thực hiện các đầu việc chuyên môn theo phân công, phối hợp cùng đội nhóm để hoàn thành mục tiêu công việc.',
        }),
      );
    }

    educations.push(
      educationRepo.create({
        id: randomUUID(),
        candidateProfileId: profileId,
        schoolName: pick(SCHOOLS_POOL),
        degree: pick(DEGREES),
        major: pick(MAJORS_POOL),
        startDate: toDateOnly(daysAgo(randInt(2000, 3000))),
        endDate: toDateOnly(daysAgo(randInt(200, 1900))),
      }),
    );

    for (const skillName of sample(SKILLS_POOL, randInt(3, 8))) {
      skillsRows.push(
        skillRepo.create({
          id: randomUUID(),
          candidateProfileId: profileId,
          skillName,
          level: pick(Object.values(SkillLevel)),
        }),
      );
    }

    if (chance(60)) {
      for (const language of sample(LANGUAGES_POOL, randInt(1, 2))) {
        languagesRows.push(
          languageRepo.create({
            id: randomUUID(),
            candidateProfileId: profileId,
            language,
            level: pick(Object.values(LanguageLevel)),
          }),
        );
      }
    }

    if (chance(35)) {
      for (const certName of sample(CERTS_POOL, randInt(1, 2))) {
        certificates.push(
          certificateRepo.create({
            id: randomUUID(),
            candidateProfileId: profileId,
            name: certName,
            issuer: 'Trung tâm Đào tạo & Sát hạch',
            issueDate: toDateOnly(daysAgo(randInt(100, 1500))),
          }),
        );
      }
    }

    if (chance(20)) {
      achievements.push(
        achievementRepo.create({
          id: randomUUID(),
          candidateProfileId: profileId,
          title: 'Nhân viên xuất sắc quý',
          description: 'Được ghi nhận vì thành tích công việc nổi bật trong quý.',
          date: toDateOnly(daysAgo(randInt(60, 900))),
        }),
      );
    }

    if (chance(15)) {
      activities.push(
        activityRepo.create({
          id: randomUUID(),
          candidateProfileId: profileId,
          title: 'Thành viên câu lạc bộ tình nguyện',
          organizationName: 'Đoàn Thanh niên',
          startDate: toDateOnly(daysAgo(randInt(500, 1800))),
          endDate: toDateOnly(daysAgo(randInt(100, 490))),
        }),
      );
    }
  }

  await bulkInsert(userRepo, candidateUsers, 300, 'tài khoản ứng viên');
  await bulkInsert(candidateRepo, candidateProfiles, 300, 'hồ sơ ứng viên');
  await bulkInsert(cvRepo, cvs, 300, 'CV');
  await bulkInsert(experienceRepo, experiences, 500, 'mục kinh nghiệm');
  await bulkInsert(educationRepo, educations, 500, 'mục học vấn');
  await bulkInsert(skillRepo, skillsRows, 500, 'kỹ năng');
  await bulkInsert(languageRepo, languagesRows, 500, 'ngoại ngữ');
  await bulkInsert(certificateRepo, certificates, 500, 'chứng chỉ');
  await bulkInsert(achievementRepo, achievements, 500, 'thành tích');
  await bulkInsert(activityRepo, activities, 500, 'hoạt động');

  // === 5) ĐƠN ỨNG TUYỂN DEMO ATS ==================================================================
  console.log(`\n[5/6] Sinh đơn ứng tuyển demo cho các tin đang đăng/tạm ngưng...`);
  const eligibleJobs = jobs.filter((j) => j.approvalStatus === JobApprovalStatus.APPROVED);
  const applications: Application[] = [];
  const STATUS_POOL: ApplicationStatus[] = [
    ApplicationStatus.NEW, ApplicationStatus.NEW, ApplicationStatus.NEW,
    ApplicationStatus.REVIEWING, ApplicationStatus.REVIEWING,
    ApplicationStatus.SUITABLE, ApplicationStatus.INTERVIEW, ApplicationStatus.REJECTED,
  ];
  for (const job of eligibleJobs) {
    const applicantCount = randInt(0, 8); // "vừa phải, 3-8 đơn/tin" — quyết định người dùng 21/09, cho phép 1 số tin chưa có đơn nào (thật hơn)
    if (applicantCount === 0) continue;
    const applicants = sample(primaryCvIdByCandidate, applicantCount);
    for (const cvId of applicants) {
      const isTrashed = chance(8);
      applications.push(
        applicationRepo.create({
          id: randomUUID(),
          jobPostingId: job.id,
          cvId,
          status: pick(STATUS_POOL),
          coverLetter: chance(40) ? 'Kính gửi Quý công ty, tôi mong muốn được ứng tuyển vào vị trí này và tin rằng kinh nghiệm của mình phù hợp với yêu cầu công việc.' : undefined,
          rating: chance(25) ? randInt(1, 5) : undefined,
          folder: chance(15) ? pick(FOLDER_POOL) : undefined,
          deletedAt: isTrashed ? daysAgo(randInt(1, 20)) : undefined,
          appliedAt: daysAgo(randInt(0, 60)),
        }),
      );
    }
  }
  await bulkInsert(applicationRepo, applications, 300, 'đơn ứng tuyển');

  console.log(`\n[6/6] Hoàn tất.`);
  console.log(`  Công ty ảo: ${companies.length} (${approvedCompanies.length} đang hoạt động)`);
  console.log(`  Tin tuyển dụng ảo: ${jobs.length} (${jobs.filter((j) => j.approvalStatus === JobApprovalStatus.APPROVED && !j.isPaused).length} đang đăng công khai)`);
  console.log(`  Ứng viên ảo: ${candidateProfiles.length}`);
  console.log(`  Đơn ứng tuyển ảo: ${applications.length}`);
  console.log(`\nĐăng nhập thử: bất kỳ email nào ở trên (vd uv1@candidate-demo.vn hoặc ntd1@ntd-demo.vn) — mật khẩu chung: Test@123`);

  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Lỗi khi sinh dữ liệu ảo quy mô lớn:', err);
  process.exit(1);
});
