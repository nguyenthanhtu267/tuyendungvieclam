// Đợt 81 — mẫu tin tuyển theo nhóm việc (điền sẵn mô tả, yêu cầu, quyền lợi, lương gợi ý) để đăng tin nhanh.
import type { WorkerKind } from './api';

interface Tpl { title: string; tasks: string[]; reqs: string[]; base?: number; ot?: number; perks?: string[]; headcount?: number }
const T: Record<string, Tpl> = {
  'May mặc - Giày da': { title: 'Công nhân may / giày da', tasks: ['May, ráp, ủi, kiểm hàng theo chuyền', 'Đảm bảo sản lượng và chất lượng theo tổ trưởng hướng dẫn'], reqs: ['Có hoặc chưa có kinh nghiệm — được đào tạo', 'Sức khoẻ tốt, chăm chỉ'], base: 6.5, ot: 40, perks: ['housing', 'meals', 'no_fee'], headcount: 20 },
  'Điện tử - Lắp ráp': { title: 'Công nhân lắp ráp điện tử', tasks: ['Lắp ráp, kiểm tra linh kiện, đứng dây chuyền', 'Làm việc theo ca, mặc đồ bảo hộ'], reqs: ['Nam/nữ 18–40 tuổi, mắt tốt', 'Chịu được ca đêm xoay ca'], base: 7, ot: 40, perks: ['housing', 'shuttle', 'meals', 'no_fee'], headcount: 30 },
  'Cơ khí - Hàn - Tiện': { title: 'Thợ cơ khí / hàn / tiện', tasks: ['Gia công, hàn, tiện, phay theo bản vẽ', 'Bảo trì máy móc cơ bản'], reqs: ['Có tay nghề hoặc đã học nghề', 'Ưu tiên có chứng chỉ hàn'], base: 9, ot: 30, perks: ['meals', 'no_fee'], headcount: 5 },
  'Chế biến thực phẩm': { title: 'Công nhân chế biến thực phẩm', tasks: ['Sơ chế, đóng gói, vận hành máy theo quy trình vệ sinh', 'Làm việc trong môi trường mát/lạnh'], reqs: ['Có giấy khám sức khoẻ', 'Sạch sẽ, tuân thủ quy định ATTP'], base: 6.5, ot: 40, perks: ['meals', 'shuttle', 'no_fee'], headcount: 15 },
  'Kho vận - Bốc xếp': { title: 'Nhân viên kho / bốc xếp', tasks: ['Nhập, xuất, soạn hàng, bốc xếp, kiểm đếm', 'Vận hành xe nâng tay'], reqs: ['Sức khoẻ tốt', 'Ưu tiên có bằng lái xe nâng'], base: 7.5, ot: 40, perks: ['meals', 'no_fee'], headcount: 10 },
  'Đóng gói - Phân loại': { title: 'Công nhân đóng gói', tasks: ['Đóng gói, dán tem, phân loại sản phẩm', 'Kiểm tra số lượng trước khi giao'], reqs: ['Cẩn thận, nhanh tay', 'Không cần kinh nghiệm'], base: 6.5, ot: 30, perks: ['meals', 'no_fee'], headcount: 10 },
  'Nhựa - Bao bì - In ấn': { title: 'Công nhân nhựa / bao bì', tasks: ['Vận hành máy ép/thổi/in, kiểm sản phẩm', 'Vệ sinh khuôn và khu vực làm việc'], reqs: ['Chịu được môi trường nóng', 'Được đào tạo vận hành máy'], base: 7, ot: 40, perks: ['meals', 'no_fee'], headcount: 10 },
  'Gỗ - Nội thất': { title: 'Thợ gỗ / nội thất', tasks: ['Cắt, chà nhám, lắp ráp, sơn hoàn thiện', 'Đọc bản vẽ cơ bản'], reqs: ['Có tay nghề hoặc học việc', 'Chịu khó, an toàn lao động'], base: 8, ot: 30, perks: ['meals', 'no_fee'], headcount: 5 },
  'Bảo vệ': { title: 'Nhân viên bảo vệ', tasks: ['Trực cổng, tuần tra, kiểm soát ra vào', 'Ghi sổ giao ca'], reqs: ['Nam 20–50 tuổi, sức khoẻ tốt', 'Lý lịch rõ ràng'], base: 6.5, ot: 0, perks: ['meals', 'no_fee'], headcount: 3 },
  'Tạp vụ - Vệ sinh': { title: 'Nhân viên tạp vụ / vệ sinh', tasks: ['Vệ sinh khu vực được phân công, thu gom rác', 'Giữ gìn trang thiết bị'], reqs: ['Chăm chỉ, trung thực', 'Không yêu cầu kinh nghiệm'], base: 5.5, ot: 0, perks: ['meals', 'no_fee'], headcount: 2 },
  'Lái xe - Giao hàng': { title: 'Tài xế / nhân viên giao hàng', tasks: ['Nhận và giao hàng theo tuyến, thu hộ COD nếu có', 'Giữ xe và hàng hoá an toàn'], reqs: ['Có bằng lái phù hợp, biết đường', 'Có điện thoại thông minh'], base: 8, ot: 30, perks: ['no_fee'], headcount: 5 },
  'Phụ bếp - Phục vụ': { title: 'Phụ bếp / phục vụ', tasks: ['Sơ chế, phụ bếp hoặc bưng bê, dọn bàn', 'Giữ vệ sinh khu vực làm việc'], reqs: ['Nhanh nhẹn, thân thiện', 'Có thể làm ca xoay'], base: 6.5, ot: 20, perks: ['meals', 'no_fee'], headcount: 3 },
  'Xây dựng': { title: 'Thợ phụ / thợ xây dựng', tasks: ['Phụ hồ, trộn vữa, vận chuyển vật liệu, hoàn thiện', 'Thực hiện theo chỉ dẫn của thợ chính'], reqs: ['Sức khoẻ tốt, chịu nắng', 'Tuân thủ an toàn lao động'], base: 9, ot: 20, perks: ['meals', 'no_fee'], headcount: 8 },
  'Lao động phổ thông khác': { title: 'Lao động phổ thông', tasks: ['Làm việc theo phân công của quản lý', 'Được hướng dẫn trực tiếp tại chỗ'], reqs: ['Sức khoẻ tốt, chăm chỉ', 'Không yêu cầu kinh nghiệm'], base: 6.5, ot: 30, perks: ['meals', 'no_fee'], headcount: 5 },
  'Phục vụ - Pha chế': { title: 'Nhân viên phục vụ / pha chế (bán thời gian)', tasks: ['Order, phục vụ khách, pha chế đồ uống cơ bản', 'Vệ sinh quầy và bàn'], reqs: ['Sinh viên, làm được ca tối hoặc cuối tuần', 'Được đào tạo pha chế'], base: 25000, perks: ['meals', 'no_fee'], headcount: 3 },
  'Bán hàng - Thu ngân': { title: 'Nhân viên bán hàng / thu ngân (bán thời gian)', tasks: ['Tư vấn, bán hàng, thu ngân, sắp xếp hàng', 'Kiểm kê cuối ca'], reqs: ['Trung thực, giao tiếp tốt', 'Đăng ký ca cố định mỗi tuần'], base: 25000, perks: ['meals', 'no_fee'], headcount: 3 },
  'Giao hàng': { title: 'Nhân viên giao hàng bán thời gian', tasks: ['Giao đơn trong khu vực gần trường', 'Giữ liên lạc với khách và cửa hàng'], reqs: ['Có xe máy, bằng lái', 'Làm theo ca linh hoạt'], base: 25000, perks: ['no_fee'], headcount: 5 },
  'Gia sư': { title: 'Gia sư', tasks: ['Dạy kèm theo lịch đã thống nhất với phụ huynh', 'Báo cáo tiến độ học tập định kỳ'], reqs: ['Sinh viên/giáo viên giỏi môn dạy', 'Có trách nhiệm, đúng giờ'], base: 150000, perks: ['no_fee'], headcount: 2 },
  'Sự kiện - PG/PB': { title: 'Nhân viên sự kiện / PG-PB', tasks: ['Phát tờ rơi, giới thiệu sản phẩm, hỗ trợ sự kiện', 'Làm theo ca/ngày'], reqs: ['Ngoại hình ưa nhìn là lợi thế, giao tiếp tốt', 'Thể lực tốt'], base: 300000, perks: ['meals', 'no_fee'], headcount: 10 },
  'Nhập liệu - Văn phòng': { title: 'Nhân viên nhập liệu bán thời gian', tasks: ['Nhập dữ liệu vào Excel/phần mềm', 'Đối chiếu và rà soát số liệu'], reqs: ['Gõ nhanh, cẩn thận', 'Biết dùng Excel cơ bản'], base: 25000, perks: ['no_fee'], headcount: 2 },
  'Chăm sóc khách hàng - Telesale': { title: 'Nhân viên chăm sóc khách hàng bán thời gian', tasks: ['Gọi điện/nhắn tin chăm sóc khách hàng theo kịch bản', 'Ghi nhận phản hồi'], reqs: ['Giọng nói rõ ràng', 'Làm được ca cố định'], base: 25000, perks: ['no_fee'], headcount: 4 },
  'Bán thời gian khác': { title: 'Việc làm bán thời gian', tasks: ['Làm việc theo ca linh hoạt', 'Được hướng dẫn trực tiếp'], reqs: ['Sinh viên, chăm chỉ', 'Sắp xếp được ca ngoài giờ học'], base: 25000, perks: ['no_fee'], headcount: 3 },
};
const INTERN: Tpl = { title: 'Thực tập sinh', tasks: ['Hỗ trợ các công việc theo phân công của người hướng dẫn', 'Học quy trình làm việc thực tế'], reqs: ['Sinh viên năm cuối hoặc mới tốt nghiệp', 'Có tinh thần học hỏi'], perks: ['allowance', 'intern_cert', 'convert', 'no_fee'], headcount: 2 };

export interface LaborTemplate { title: string; description: string; requirements: string; benefits: string; perks: string[]; payBase: string; payOt: string; headcount: string; hourly: boolean }
const li = (a: string[]) => `<ul>${a.map((x) => `<li>${x}</li>`).join('')}</ul>`;
/** Mẫu theo nhóm việc; sinh viên tính theo giờ/ngày nên không điền lương cơ bản tháng. */
export function laborTemplate(kind: WorkerKind, group: string): LaborTemplate {
  const t = T[group] ?? (kind === 'intern' ? { ...INTERN, title: `Thực tập sinh ${group.replace(/ - .*/, '')}` } : T['Lao động phổ thông khác']);
  const tpl = kind === 'intern' ? { ...INTERN, title: `Thực tập sinh ${group.replace(/ - .*/, '')}`, tasks: [`Hỗ trợ công việc ${group.toLowerCase()} theo phân công`, ...INTERN.tasks.slice(1)] } : t;
  const benefits =
    kind === 'worker' ? ['Ký hợp đồng lao động, đóng BHXH/BHYT theo luật', 'Tăng ca tính 150%, làm đêm +30%', 'Thưởng lễ tết, chuyên cần'] :
    kind === 'student' ? ['Thanh toán lương đúng hạn', 'Ca làm linh hoạt theo lịch học', 'Được đào tạo miễn phí'] :
    ['Được cấp xác nhận và phiếu nhận xét thực tập', 'Có cơ hội nhận chính thức nếu làm tốt', 'Được hướng dẫn trực tiếp bởi nhân viên chính thức'];
  const hourly = kind === 'student';
  return {
    title: tpl.title,
    description: li(tpl.tasks),
    requirements: li(tpl.reqs),
    benefits: li(benefits),
    perks: tpl.perks ?? [],
    payBase: !hourly && tpl.base ? String(tpl.base).replace('.', ',') : '',
    payOt: !hourly && tpl.ot ? String(tpl.ot) : '',
    headcount: String(tpl.headcount ?? 3),
    hourly,
  };
}
