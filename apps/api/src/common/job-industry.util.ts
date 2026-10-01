// Đợt 126 — đoán NGÀNH NGHỀ (đúng tên trong danh mục INDUSTRIES của web) từ chức danh + mô tả + ngành ghi trên trang gốc.
// Chấm điểm theo từ khóa (chức danh nặng gấp 4 lần mô tả); không đủ chắc chắn thì trả về undefined để Admin tự chọn.
const RULES: { industry: string; kw: string[] }[] = [
  { industry: 'CNTT / Phần mềm', kw: ['lap trinh', 'developer', 'software', 'phan mem', 'it helpdesk', 'devops', 'tester', 'qa qc phan mem', 'data engineer', 'data analyst', 'frontend', 'backend', 'fullstack', 'java', 'python', 'react', 'mobile app', 'cntt', 'he thong thong tin', 'quan tri mang', 'an ninh mang'] },
  { industry: 'Kế toán / Kiểm toán', kw: ['ke toan', 'kiem toan', 'thue', 'accountant', 'auditor', 'thu quy', 'ke toan truong'] },
  { industry: 'Nhân sự', kw: ['nhan su', 'tuyen dung', 'hr ', 'human resource', 'c&b', 'tien luong', 'dao tao noi bo', 'recruiter'] },
  { industry: 'Hành chính / Văn phòng', kw: ['hanh chinh', 'van phong', 'tro ly', 'thu ky', 'le tan', 'van thu', 'admin ', 'nhap lieu'] },
  { industry: 'Marketing', kw: ['marketing', 'seo', 'content', 'digital', 'social media', 'brand', 'thuong hieu', 'quang cao online', 'chay ads', 'facebook ads'] },
  { industry: 'Quảng cáo / Truyền thông / Đối ngoại', kw: ['truyen thong', 'pr ', 'quan he cong chung', 'bien tap', 'phong vien', 'dao dien', 'sang tao noi dung'] },
  { industry: 'Thiết kế / Mỹ thuật', kw: ['thiet ke', 'designer', 'do hoa', 'ui/ux', 'ui ux', 'my thuat', 'kien truc su noi that', 'photoshop'] },
  { industry: 'Ngân hàng', kw: ['ngan hang', 'giao dich vien', 'tin dung', 'bank', 'the tin dung', 'quan he khach hang ca nhan'] },
  { industry: 'Tài chính / Đầu tư', kw: ['tai chinh', 'dau tu', 'chung khoan', 'quan ly quy', 'tu van tai chinh', 'phan tich tai chinh', 'financial'] },
  { industry: 'Bảo hiểm', kw: ['bao hiem', 'tu van bao hiem', 'giam dinh bao hiem', 'dai ly bao hiem'] },
  { industry: 'Bất động sản', kw: ['bat dong san', 'moi gioi nha dat', 'du an bds', 'tu van bds', 'cho thue nha', 'bds'] },
  { industry: 'Xây dựng', kw: ['xay dung', 'giam sat cong trinh', 'ky su xay dung', 'chi huy truong', 'du toan', 'thi cong', 'kien truc su', 'quan ly du an xay'] },
  { industry: 'Y tế / Dược', kw: ['y te', 'duoc si', 'duoc', 'bac si', 'dieu duong', 'benh vien', 'phong kham', 'nha thuoc', 'y ta', 'ky thuat vien xet nghiem', 'tram y te'] },
  { industry: 'Giáo dục / Đào tạo', kw: ['giao vien', 'giang vien', 'gia su', 'dao tao', 'giao duc', 'tro giang', 'mam non', 'trung tam anh ngu', 'giao vien tieng anh'] },
  { industry: 'Biên phiên dịch', kw: ['bien dich', 'phien dich', 'translator', 'interpreter', 'tieng nhat bien', 'tieng han bien'] },
  { industry: 'Logistics', kw: ['logistics', 'kho van', 'thu kho', 'quan ly kho', 'chuoi cung ung', 'supply chain', 'forwarder', 'giao nhan', 'dieu phoi van tai kho'] },
  { industry: 'Xuất nhập khẩu', kw: ['xuat nhap khau', 'xnk', 'hai quan', 'import', 'export', 'chung tu xuat'] },
  { industry: 'Vận tải', kw: ['tai xe', 'lai xe', 'van tai', 'xe tai', 'xe container', 'giao hang', 'shipper', 'xe khach'] },
  { industry: 'Nhà hàng / Khách sạn', kw: ['nha hang', 'khach san', 'phuc vu', 'bep ', 'dau bep', 'pha che', 'barista', 'bartender', 'resort', 'buong phong', 'f&b', 'quan ca phe', 'cafe'] },
  { industry: 'Du lịch', kw: ['du lich', 'huong dan vien', 'tour', 'dieu hanh tour', 've may bay', 'travel'] },
  { industry: 'Bán lẻ', kw: ['ban le', 'cua hang', 'sieu thi', 'nhan vien ban hang tai cua hang', 'thu ngan', 'retail', 'cua hang truong', 'quan ly cua hang'] },
  { industry: 'Kinh doanh / Bán hàng', kw: ['kinh doanh', 'ban hang', 'sales', 'phat trien thi truong', 'nhan vien tu van', 'truong phong kinh doanh', 'kenh phan phoi', 'nha phan phoi', 'khach hang doanh nghiep', 'business development', 'telesales', 'tu van vien'] },
  { industry: 'Dịch vụ khách hàng', kw: ['cham soc khach hang', 'cskh', 'customer service', 'call center', 'tong dai', 'hotline', 'ho tro khach hang', 'kiem duyet noi dung', 'kiem duyet mang'] },
  { industry: 'Sản xuất / Cơ khí', kw: ['san xuat', 'co khi', 'cong nhan', 'van hanh may', 'qc ', 'qa ', 'quan ly chat luong', 'xuong', 'nha may', 'cnc', 'han ', 'tien ', 'phay', 'ky thuat vien co khi'] },
  { industry: 'Điện / Điện tử / Điện lạnh', kw: ['dien tu', 'dien lanh', 'dien cong nghiep', 'ky su dien', 'tu dong hoa', 'plc', 'bao tri dien', 'dien lanh'] },
  { industry: 'Bảo trì / Sửa chữa', kw: ['bao tri', 'sua chua', 'ky thuat vien', 'bao duong'] },
  { industry: 'Dệt may / Da giày', kw: ['det may', 'may mac', 'da giay', 'giay da', 'quan ao', 'sewing', 'thoi trang san xuat', 'garment'] },
  { industry: 'Thực phẩm & Đồ uống', kw: ['thuc pham', 'do uong', 'fmcg', 'che bien', 'nuoc giai khat', 'sua ', 'banh keo'] },
  { industry: 'Nông nghiệp', kw: ['nong nghiep', 'thuy san', 'chan nuoi', 'thu y', 'trong trot', 'phan bon', 'thuc an chan nuoi', 'lam nghiep'] },
  { industry: 'An ninh / Bảo vệ', kw: ['bao ve', 'an ninh', 'security', 've sy'] },
  { industry: 'Luật / Pháp lý', kw: ['phap che', 'luat su', 'phap ly', 'tro ly luat', 'legal', 'compliance'] },
  { industry: 'Viễn thông', kw: ['vien thong', 'vien thong', 'mang cap quang', 'telecom', 'ky thuat vien mang'] },
  { industry: 'Công nghệ sinh học', kw: ['cong nghe sinh hoc', 'sinh hoc', 'biotech', 'phong thi nghiem'] },
  { industry: 'Khoáng sản', kw: ['khoang san', 'mo dia chat', 'dau khi'] },
  { industry: 'Hàng hải', kw: ['hang hai', 'thuy thu', 'tau bien', 'cang bien'] },
  { industry: 'Tư vấn', kw: ['tu van quan ly', 'consultant', 'tu van chien luoc'] },
  { industry: 'Thương mại điện tử', kw: ['thuong mai dien tu', 'shopee', 'lazada', 'tiktok shop', 'ecommerce', 'e-commerce', 'san thuong mai'] },
  { industry: 'Mới tốt nghiệp / Thực tập', kw: ['thuc tap sinh', 'intern', 'fresher', 'moi tot nghiep'] },
  { industry: 'Lao động phổ thông', kw: ['lao dong pho thong', 'pho thong', 'boc xep', 'tap vu', 'giup viec'] },
];

function norm(s: string): string {
  return ' ' + s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9&/ ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
}

export function inferIndustry(title?: string, description?: string, siteIndustry?: string): string | undefined {
  const t = norm(title ?? '');
  const d = norm((description ?? '').replace(/<[^>]+>/g, ' ').slice(0, 4000));
  const s = norm(siteIndustry ?? '');
  const score = new Map<string, number>();
  for (const r of RULES) {
    let n = 0;
    for (const k of r.kw) {
      const kk = ' ' + norm(k).trim() + (k.endsWith(' ') ? ' ' : '');
      if (t.includes(kk)) n += 4;
      if (s.includes(kk)) n += 3;
      if (d.includes(kk)) n += 1;
    }
    if (n) score.set(r.industry, n);
  }
  let best: string | undefined;
  let bs = 0;
  for (const [k, v] of score) if (v > bs) { best = k; bs = v; }
  return bs >= 2 ? best : undefined;
}
