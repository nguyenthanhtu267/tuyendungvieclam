import { LABOR_GROUPS } from '../workers/labor-groups';
import { guessProvince, oldDistricts } from '../workers/vn-geo';

// Đợt 135 — tin nhập từ email/link: tự nhận KÊNH (văn phòng / công nhân / sinh viên / thực tập), nhóm việc,
// phúc lợi đặc thù (KTX, xe đưa đón, bao cơm) và nơi làm việc (tỉnh + quận/huyện cũ) để đăng đúng khu.
const fold = (s: string) => ` ${s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;

const WORKER_TITLE = /( cong nhan | lao dong pho thong | ldpt | boc xep | boc vac | phu kho | thu kho| kho van | dong goi | phan loai | may cong nghiep | tho may | cat chi | ui do | dung may | van hanh may | lap rap | xe nang | bao ve | tap vu | ve sinh cong nghiep | giup viec | phu bep | rua chen | phu ho | tho ho | tho han | tho tien | tho dien | tho son | tho moc | tai xe | lai xe | giao hang | shipper | nhan vien giao nhan | dong thung | che bien | soan hang | kiem hang )/;
const MANAGER = /( truong phong | quan ly | giam doc | truong nhom | giam sat | ky su | chuyen vien | ke toan | manager | director | leader | supervisor | engineer )/;
const STUDENT = /( sinh vien | part ?time | ban thoi gian | lam them | thoi vu | ca toi | cuoi tuan )/;
const INTERN = /( thuc tap sinh | thuc tap | intern | internship )/;

const KEYWORDS: [string[], string][] = [
  [['may', 'det', 'giay', 'da giay', 'cat chi', 'ui do', 'vat so'], 'May mặc - Giày da'],
  [['dien tu', 'lap rap', 'linh kien', 'han thiec', 'smt', 'bo mach', 'dung may', 'dung chuyen'], 'Điện tử - Lắp ráp'],
  [['co khi', 'han', 'tien', 'phay', 'cnc', 'dot dap', 'son tinh dien'], 'Cơ khí - Hàn - Tiện'],
  [['thuc pham', 'che bien', 'thuy san', 'dong lanh', 'banh keo', 'tom'], 'Chế biến thực phẩm'],
  [['kho', 'boc vac', 'boc xep', 'xe nang', 'phu kho', 'soan hang', 'kiem hang'], 'Kho vận - Bốc xếp'],
  [['dong goi', 'phan loai', 'dan tem', 'dong thung'], 'Đóng gói - Phân loại'],
  [['nhua', 'bao bi', 'in an', 'ep nhua', 'thoi mang'], 'Nhựa - Bao bì - In ấn'],
  [['go', 'noi that', 'cha nham', 'son go', 'moc'], 'Gỗ - Nội thất'],
  [['bao ve', 'an ninh', 'giu xe'], 'Bảo vệ'],
  [['tap vu', 've sinh', 'lau don', 'giup viec'], 'Tạp vụ - Vệ sinh'],
  [['lai xe', 'tai xe', 'giao hang', 'shipper', 'xe tai', 'giao nhan'], 'Lái xe - Giao hàng'],
  [['phu bep', 'phuc vu', 'rua chen', 'bep', 'nau an'], 'Phụ bếp - Phục vụ'],
  [['phu ho', 'xay dung', 'tho ho', 'cong trinh', 'son nha', 'thach cao'], 'Xây dựng'],
  [['pha che', 'barista', 'chay ban', 'cafe', 'tra sua', 'phuc vu', 'nha hang'], 'Phục vụ - Pha chế'],
  [['ban hang', 'thu ngan', 'sieu thi', 'cua hang'], 'Bán hàng - Thu ngân'],
  [['gia su', 'day kem', 'tro giang'], 'Gia sư'],
  [['pg', 'pb', 'su kien', 'phat to roi'], 'Sự kiện - PG/PB'],
  [['nhap lieu', 'van phong', 'danh may'], 'Nhập liệu - Văn phòng'],
  [['cskh', 'telesale', 'tong dai', 'cham soc khach hang'], 'Chăm sóc khách hàng - Telesale'],
  [['ke toan', 'tai chinh', 'kiem toan'], 'Kế toán - Tài chính'],
  [['it', 'lap trinh', 'cntt', 'phan mem', 'web', 'tester'], 'Công nghệ thông tin'],
  [['marketing', 'truyen thong', 'content', 'thiet ke do hoa'], 'Marketing - Truyền thông'],
  [['kinh doanh', 'sales'], 'Kinh doanh - Bán hàng'],
  [['nhan su', 'hanh chinh', 'tuyen dung'], 'Nhân sự - Hành chính'],
  [['ky thuat', 'co khi', 'bao tri'], 'Kỹ thuật - Cơ khí'],
  [['dien', 'dien tu', 'tu dong hoa'], 'Điện - Điện tử'],
  [['thiet ke', 'do hoa', 'my thuat'], 'Thiết kế - Mỹ thuật'],
  [['tieng anh', 'tieng nhat', 'tieng han', 'tieng trung', 'phien dich', 'bien dich'], 'Ngoại ngữ - Biên phiên dịch'],
  [['xuat nhap khau', 'logistics', 'chung tu'], 'Logistics - Xuất nhập khẩu'],
];
const FALLBACK: Record<string, string> = { worker: 'Lao động phổ thông khác', student: 'Bán thời gian khác', intern: 'Ngành khác' };

export function guessLaborGroup(kind: 'worker' | 'student' | 'intern', ...texts: string[]): string {
  const allowed = LABOR_GROUPS[kind];
  for (const t of texts.map(fold)) {
    let best: { g: string; at: number } | null = null;
    for (const [words, g] of KEYWORDS) {
      if (!allowed.includes(g)) continue;
      for (const w of words) {
        const at = t.indexOf(` ${w} `);
        if (at >= 0 && (!best || at < best.at)) best = { g, at };
      }
    }
    if (best) return best.g;
  }
  return FALLBACK[kind];
}

export interface ChannelGuess {
  channel: 'office' | 'worker' | 'student' | 'intern';
  laborGroup?: string;
  laborPerks?: string[];
  workPlace?: { province: string; mode: 'old'; oldDistrict?: string | null } | null;
}

export function inferChannel(title: string, description = '', location = ''): ChannelGuess {
  const t = fold(title);
  const d = fold(description.replace(/<[^>]+>/g, ' ').slice(0, 5000));
  let channel: ChannelGuess['channel'] = 'office';
  if (INTERN.test(t)) channel = 'intern';
  else if (WORKER_TITLE.test(t) && !MANAGER.test(t)) channel = 'worker';
  else if (STUDENT.test(t) && !MANAGER.test(t)) channel = 'student';
  if (channel === 'office') return { channel };
  const perks: string[] = [];
  const pd = `${t}${d}`;
  if (/( ky tuc xa | ktx | cho o | nha o | ho tro o | phong tro mien phi )/.test(pd)) perks.push('housing');
  if (/( xe dua don | xe dua ruoc | xe dua )/.test(pd)) perks.push('shuttle');
  if (/( bao com | com trua | suat an | bua an | ho tro com | an ca )/.test(pd)) perks.push('meals');
  const province = guessProvince(location) ?? guessProvince(description.replace(/<[^>]+>/g, ' ').slice(0, 3000));
  let workPlace: ChannelGuess['workPlace'] = null;
  if (province) {
    const loc = fold(location);
    const dist = oldDistricts(province).find((x) => {
      const f = fold(x).replace(/ (quan|huyen|thi xa|thanh pho|tp) /g, ' ').trim();
      return f.length >= 2 && loc.includes(` ${f} `);
    });
    workPlace = { province, mode: 'old', oldDistrict: dist ?? null };
  }
  return { channel, laborGroup: guessLaborGroup(channel, title, description), laborPerks: perks, workPlace };
}
