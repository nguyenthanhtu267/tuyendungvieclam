// Đợt 63 — "Gợi ý viết tin": từ chức danh (và ngành) sinh khung Mô tả / Yêu cầu / Quyền lợi để NTD chỉnh lại.
// Thuần quy tắc, chạy trên trình duyệt, không gọi dịch vụ AI trả phí. Chỉ là bản nháp — NTD phải sửa cho đúng thực tế.
interface Family {
  test: RegExp;
  duties: string[];
  reqs: string[];
  skills: string[];
}
const FAMILIES: Family[] = [
  { test: /kế toán|ke toan|kiểm toán|accountant/i, duties: ['Hạch toán, lập chứng từ và theo dõi sổ sách kế toán hằng ngày', 'Lập báo cáo thuế, báo cáo tài chính theo quy định', 'Theo dõi công nợ, đối chiếu số liệu với các bộ phận', 'Phối hợp kiểm toán, thanh tra thuế khi có yêu cầu'], reqs: ['Tốt nghiệp Cao đẳng/Đại học chuyên ngành Kế toán, Tài chính', 'Thành thạo Excel và phần mềm kế toán (MISA, FAST…)', 'Cẩn thận, trung thực, có trách nhiệm với số liệu'], skills: ['Kế toán tổng hợp', 'Excel', 'MISA'] },
  { test: /bán hàng|kinh doanh|sales|tư vấn bán|business development/i, duties: ['Tìm kiếm, tư vấn và chăm sóc khách hàng để đạt chỉ tiêu doanh số', 'Giới thiệu sản phẩm/dịch vụ, báo giá và đàm phán hợp đồng', 'Theo dõi đơn hàng, công nợ và phản hồi của khách hàng', 'Báo cáo kết quả kinh doanh định kỳ cho quản lý'], reqs: ['Kỹ năng giao tiếp, thuyết phục và đàm phán tốt', 'Có kinh nghiệm bán hàng là lợi thế, sẵn sàng đào tạo người mới', 'Chủ động, chịu được áp lực doanh số'], skills: ['Đàm phán', 'Chăm sóc khách hàng', 'Bán hàng'] },
  { test: /marketing|truyền thông|content|seo|quảng cáo|digital/i, duties: ['Lên kế hoạch và triển khai các chiến dịch marketing/truyền thông', 'Xây dựng nội dung cho website, mạng xã hội và các kênh quảng cáo', 'Theo dõi, đo lường hiệu quả chiến dịch và đề xuất cải thiện', 'Phối hợp thiết kế, kinh doanh để đạt mục tiêu thương hiệu'], reqs: ['Tốt nghiệp chuyên ngành Marketing, Truyền thông hoặc liên quan', 'Nắm vững công cụ quảng cáo số, SEO, Google Analytics', 'Sáng tạo, viết tốt, cập nhật xu hướng'], skills: ['Digital Marketing', 'SEO', 'Content'] },
  { test: /lập trình|developer|kỹ sư phần mềm|software|frontend|backend|fullstack|web|mobile|\bit\b/i, duties: ['Phân tích yêu cầu, thiết kế và phát triển tính năng phần mềm', 'Viết code sạch, có kiểm thử và tài liệu kỹ thuật', 'Phối hợp nhóm sản phẩm, thiết kế, kiểm thử để phát hành đúng hạn', 'Bảo trì, tối ưu hiệu năng và xử lý lỗi hệ thống'], reqs: ['Tốt nghiệp Công nghệ thông tin hoặc có kinh nghiệm tương đương', 'Thành thạo ngôn ngữ/framework liên quan vị trí, biết Git', 'Tư duy logic, chủ động học công nghệ mới'], skills: ['Git', 'SQL', 'REST API'] },
  { test: /nhân sự|tuyển dụng|hr\b|c&b|hành chính/i, duties: ['Đăng tin, sàng lọc hồ sơ, phỏng vấn và hỗ trợ tuyển dụng', 'Quản lý hồ sơ nhân sự, hợp đồng lao động, chấm công', 'Thực hiện chế độ bảo hiểm, lương thưởng, phúc lợi', 'Tổ chức đào tạo, hoạt động nội bộ của công ty'], reqs: ['Tốt nghiệp Quản trị nhân lực, Luật hoặc chuyên ngành liên quan', 'Nắm vững Luật lao động, thành thạo tin học văn phòng', 'Giao tiếp tốt, bảo mật thông tin'], skills: ['Tuyển dụng', 'Luật lao động', 'Excel'] },
  { test: /chăm sóc khách hàng|cskh|customer|tổng đài|support|hỗ trợ khách/i, duties: ['Tiếp nhận, giải đáp thắc mắc và khiếu nại của khách hàng qua điện thoại/chat/email', 'Ghi nhận, theo dõi và xử lý yêu cầu đến khi khách hài lòng', 'Chủ động chăm sóc, giữ mối quan hệ với khách hàng hiện có', 'Báo cáo phản hồi khách hàng để cải thiện sản phẩm/dịch vụ'], reqs: ['Giọng nói rõ ràng, kỹ năng giao tiếp và xử lý tình huống tốt', 'Kiên nhẫn, thái độ tích cực', 'Sử dụng thành thạo máy tính, phần mềm chăm sóc khách hàng'], skills: ['Giao tiếp', 'Xử lý khiếu nại', 'CRM'] },
  { test: /kho|logistics|vận chuyển|giao hàng|xuất nhập khẩu|thu mua|mua hàng|supply/i, duties: ['Tiếp nhận, kiểm đếm, sắp xếp và bảo quản hàng hoá', 'Lập chứng từ nhập – xuất kho, cập nhật hệ thống', 'Điều phối vận chuyển, theo dõi tiến độ giao nhận', 'Kiểm kê định kỳ và báo cáo tồn kho'], reqs: ['Có kinh nghiệm kho/logistics là lợi thế', 'Trung thực, cẩn thận, sức khoẻ tốt', 'Biết sử dụng Excel/phần mềm quản lý kho'], skills: ['Quản lý kho', 'Excel', 'Logistics'] },
  { test: /thiết kế|designer|đồ hoạ|đồ họa|ui\/?ux|creative/i, duties: ['Thiết kế ấn phẩm, hình ảnh và giao diện theo định hướng thương hiệu', 'Phối hợp marketing/sản phẩm để hoàn thiện ý tưởng', 'Chỉnh sửa theo phản hồi và bàn giao file đúng hạn', 'Cập nhật xu hướng thiết kế mới'], reqs: ['Thành thạo Photoshop, Illustrator hoặc Figma', 'Có portfolio thể hiện năng lực', 'Thẩm mỹ tốt, chịu khó nhận phản hồi'], skills: ['Photoshop', 'Illustrator', 'Figma'] },
  { test: /trưởng phòng|giám đốc|quản lý|manager|head of|trưởng nhóm|giám sát|supervisor/i, duties: ['Xây dựng kế hoạch, mục tiêu và điều hành hoạt động của bộ phận', 'Phân công, theo dõi và đánh giá hiệu quả công việc của nhân viên', 'Phối hợp các phòng ban, báo cáo kết quả cho ban lãnh đạo', 'Đề xuất cải tiến quy trình, tối ưu chi phí'], reqs: ['Có kinh nghiệm quản lý đội nhóm tối thiểu 2–3 năm', 'Kỹ năng lãnh đạo, giao tiếp và ra quyết định tốt', 'Tư duy hệ thống, chịu được áp lực'], skills: ['Quản lý đội nhóm', 'Lập kế hoạch', 'Báo cáo'] },
];
const GENERIC: Family = {
  test: /./,
  duties: ['Thực hiện các công việc thuộc vị trí theo phân công của quản lý trực tiếp', 'Phối hợp với các bộ phận liên quan để hoàn thành mục tiêu chung', 'Báo cáo tiến độ và kết quả công việc định kỳ', 'Đề xuất cải tiến giúp công việc hiệu quả hơn'],
  reqs: ['Tốt nghiệp Trung cấp/Cao đẳng/Đại học phù hợp với vị trí', 'Trung thực, chăm chỉ, có tinh thần trách nhiệm', 'Kỹ năng giao tiếp và làm việc nhóm tốt', 'Sẵn sàng học hỏi'],
  skills: [],
};
const BENEFITS = ['Lương thưởng cạnh tranh, xét tăng lương định kỳ', 'Đóng BHXH, BHYT, BHTN đầy đủ theo quy định', 'Thưởng lễ, Tết, tháng 13 theo kết quả kinh doanh', 'Môi trường làm việc thân thiện, được đào tạo nâng cao chuyên môn', 'Cơ hội thăng tiến rõ ràng'];

const ul = (a: string[]) => `<ul>${a.map((t) => `<li>${t}</li>`).join('')}</ul>`;

export interface JobDraft {
  description: string;
  requirements: string;
  benefits: string;
  tags: string[];
}
export function suggestJobContent(title: string, experience?: string): JobDraft {
  const fam = FAMILIES.find((f) => f.test.test(title)) ?? GENERIC;
  const reqs = [...fam.reqs];
  if (experience && !/không yêu cầu|chưa có/i.test(experience)) reqs.unshift(`Kinh nghiệm: ${experience.toLowerCase()}`);
  return { description: ul(fam.duties), requirements: ul(reqs), benefits: ul(BENEFITS), tags: fam.skills };
}
