import { normalizeSearchText, digitsOnly } from './search-text.util';

// Đợt 18b (26/09/2026) — tách nội dung CV (chữ thô từ file PDF/DOCX, hoặc chữ người dùng dán vào) thành
// các trường có cấu trúc, theo QUY TẮC (không dùng AI — lựa chọn người dùng "quy tắc trước, AI sau").
//
// Nguyên tắc: best-effort, KHÔNG BAO GIỜ bỏ mất chữ — mọi đoạn đều nằm lại trong `sections` (và toàn
// văn luôn được lưu riêng để tìm kiếm). Người dùng luôn xem lại/sửa trên form trước khi lưu.
// Độ chính xác dự kiến: email/SĐT gần như tuyệt đối; họ tên, ngày sinh, các mục theo tiêu đề khá tốt;
// tách từng dòng kinh nghiệm thành (công ty / chức danh / thời gian) ở mức tương đối — tuỳ bố cục CV.

export interface ParsedCvExperience {
  position: string;
  companyName?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;
  isCurrent: boolean;
  description?: string;
}

export interface ParsedCvEducation {
  schoolName?: string;
  degree?: string;
  major?: string;
  startDate?: string;
  endDate?: string;
}

export interface ParsedCv {
  fullName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  address?: string;
  province?: string;
  headline?: string;
  careerObjective?: string;
  yearsOfExperience?: number;
  experiences: ParsedCvExperience[];
  educations: ParsedCvEducation[];
  skills: string[];
  languages: { language: string; level?: string }[];
  certificates: string[];
  sections: { key: string; title: string; content: string }[];
}

// Danh mục tỉnh/thành — trùng với apps/web/src/lib/catalogs.ts (PROVINCES) để dữ liệu tách ra khớp
// đúng giá trị lọc trên web. Thêm vài cách viết khác hay gặp trong CV (HCM, Sài Gòn, TP.HCM...).
const PROVINCES = [
  'Hà Nội',
  'Hồ Chí Minh',
  'An Giang',
  'Bạc Liêu',
  'Bến Tre',
  'Cà Mau',
  'Cần Thơ',
  'Đồng Tháp',
  'Hậu Giang',
  'Kiên Giang',
  'Long An',
  'Sóc Trăng',
  'Tiền Giang',
  'Trà Vinh',
  'Vĩnh Long',
  'Bắc Ninh',
  'Hà Nam',
  'Hải Dương',
  'Hải Phòng',
  'Hưng Yên',
  'Nam Định',
  'Ninh Bình',
  'Thái Bình',
  'Vĩnh Phúc',
  'Hà Tĩnh',
  'Nghệ An',
  'Quảng Bình',
  'Quảng Trị',
  'Thanh Hóa',
  'Thừa Thiên Huế',
  'Bắc Giang',
  'Bắc Kạn',
  'Cao Bằng',
  'Hà Giang',
  'Lạng Sơn',
  'Phú Thọ',
  'Quảng Ninh',
  'Thái Nguyên',
  'Tuyên Quang',
  'Bà Rịa - Vũng Tàu',
  'Bình Dương',
  'Bình Phước',
  'Đồng Nai',
  'Tây Ninh',
  'Bình Định',
  'Bình Thuận',
  'Đà Nẵng',
  'Khánh Hòa',
  'Ninh Thuận',
  'Phú Yên',
  'Quảng Nam',
  'Quảng Ngãi',
  'Điện Biên',
  'Hòa Bình',
  'Lai Châu',
  'Lào Cai',
  'Sơn La',
  'Yên Bái',
  'Đắk Lắk',
  'Đắk Nông',
  'Gia Lai',
  'Kon Tum',
  'Lâm Đồng',
];
const PROVINCE_ALIASES: [string, string][] = [
  ['tp hcm', 'Hồ Chí Minh'],
  ['tp.hcm', 'Hồ Chí Minh'],
  ['hcm', 'Hồ Chí Minh'],
  ['sai gon', 'Hồ Chí Minh'],
  ['ho chi minh', 'Hồ Chí Minh'],
  ['ha noi', 'Hà Nội'],
  ['hanoi', 'Hà Nội'],
  ['vung tau', 'Bà Rịa - Vũng Tàu'],
  ['hue', 'Thừa Thiên Huế'],
  ['da nang', 'Đà Nẵng'],
  ['danang', 'Đà Nẵng'],
];

// Tiêu đề mục thường gặp trong CV tiếng Việt/tiếng Anh (đã bỏ dấu, chữ thường).
const SECTION_KEYWORDS: { key: string; words: string[] }[] = [
  {
    key: 'personal',
    words: [
      'thong tin ca nhan',
      'thong tin lien he',
      'lien he',
      'personal information',
      'personal details',
      'contact',
      'contact information',
    ],
  },
  {
    key: 'objective',
    words: [
      'muc tieu nghe nghiep',
      'muc tieu',
      'career objective',
      'objective',
      'gioi thieu ban than',
      'gioi thieu',
      'tom tat',
      'summary',
      'profile',
      'about me',
      'dinh huong nghe nghiep',
    ],
  },
  {
    key: 'experience',
    words: [
      'kinh nghiem lam viec',
      'kinh nghiem',
      'qua trinh lam viec',
      'qua trinh cong tac',
      'work experience',
      'experience',
      'employment history',
      'professional experience',
      'lich su lam viec',
    ],
  },
  {
    key: 'education',
    words: [
      'hoc van',
      'trinh do hoc van',
      'qua trinh hoc tap',
      'education',
      'dao tao',
      'trinh do chuyen mon',
    ],
  },
  {
    key: 'skills',
    words: [
      'ky nang',
      'ky nang chuyen mon',
      'ky nang mem',
      'skills',
      'technical skills',
      'soft skills',
      'nang luc',
    ],
  },
  {
    key: 'languages',
    words: ['ngoai ngu', 'ngon ngu', 'languages', 'language'],
  },
  {
    key: 'certificates',
    words: [
      'chung chi',
      'bang cap',
      'certifications',
      'certificates',
      'certification',
    ],
  },
  {
    key: 'achievements',
    words: [
      'giai thuong',
      'thanh tich',
      'danh hieu',
      'awards',
      'achievements',
      'honors',
    ],
  },
  {
    key: 'activities',
    words: ['hoat dong', 'hoat dong ngoai khoa', 'activities', 'volunteer'],
  },
  { key: 'projects', words: ['du an', 'cac du an', 'projects'] },
  {
    key: 'references',
    words: ['nguoi tham khao', 'nguoi gioi thieu', 'references', 'reference'],
  },
  { key: 'interests', words: ['so thich', 'interests', 'hobbies'] },
];

const SECTION_TITLES: Record<string, string> = {
  intro: 'Phần đầu CV',
  personal: 'Thông tin cá nhân',
  objective: 'Mục tiêu nghề nghiệp',
  experience: 'Kinh nghiệm làm việc',
  education: 'Học vấn',
  skills: 'Kỹ năng',
  languages: 'Ngoại ngữ',
  certificates: 'Chứng chỉ',
  achievements: 'Thành tích & giải thưởng',
  activities: 'Hoạt động',
  projects: 'Dự án',
  references: 'Người tham khảo',
  interests: 'Sở thích',
};

const COMPANY_HINT =
  /(c[oô]ng ty|company|corp|corporation|co\.,?|ltd|jsc|tnhh|c[oổ] ph[aầ]n|t[aậ]p [dđ]o[aà]n|group|ng[aâ]n h[aà]ng|bank|inc\b|chi nh[aá]nh|agency|studio|vi[eệ]n\b)/i;
const SCHOOL_HINT =
  /([dđ][aạ]i h[oọ]c|cao [dđ][aẳ]ng|tr[uư][oờ]ng|h[oọ]c vi[eệ]n|university|college|academy|institute|thpt|trung c[aấ]p|school)/i;
const DEGREE_HINT =
  /(c[uử] nh[aâ]n|k[yỹ] s[uư]|th[aạ]c s[iĩ]|ti[eế]n s[iĩ]|bachelor|master|engineer|phd|mba|cao [dđ][aẳ]ng|trung c[aấ]p|b[aằ]ng)/i;
const BULLET = /^[\s]*([-•●▪◦∙·+*✓✔►➢➤–]|\d+[.)])\s*/;

const MONTH_YEAR = String.raw`(?:(?:0?[1-9]|1[0-2])[\/.\-])?(?:19|20)\d{2}`;
const RANGE_RE = new RegExp(
  String.raw`(${MONTH_YEAR})\s*(?:[-–—~]|đến|den|to)\s*(${MONTH_YEAR}|nay|hiện tại|hien tai|hiện nay|hien nay|present|now|current|đến nay)`,
  'i',
);

function toIsoMonth(token: string): string | undefined {
  const m = token.match(/^(?:(\d{1,2})[/.-])?((?:19|20)\d{2})$/);
  if (!m) return undefined;
  const month = m[1]
    ? String(Math.min(12, Math.max(1, Number(m[1])))).padStart(2, '0')
    : '01';
  return `${m[2]}-${month}-01`;
}

function parseRange(
  line: string,
): { start?: string; end?: string; isCurrent: boolean; rest: string } | null {
  const m = line.match(RANGE_RE);
  if (!m) return null;
  const endRaw = m[2];
  const isCurrent = !/\d/.test(endRaw);
  return {
    start: toIsoMonth(m[1]),
    end: isCurrent ? undefined : toIsoMonth(endRaw),
    isCurrent,
    // Chỉ bỏ phần thời gian + dấu phân cách ở 2 đầu; GIỮ dấu " - " / " | " ở giữa để còn tách được
    // "Chức danh - Công ty" phía sau.
    rest: line
      .replace(m[0], ' ')
      .replace(/^[\s|()[\],:–—-]+|[\s|()[\],:–—-]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  };
}

function stripBullet(line: string): string {
  return line.replace(BULLET, '').trim();
}

function titleCaseIfUpper(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function detectSectionKey(line: string): string | null {
  const raw = line.replace(BULLET, '').trim();
  const plain = normalizeSearchText(raw)
    .replace(/^[ivx]+[.)]\s*/, '')
    .replace(/[:：.\-–—|#*_]+$/g, '')
    .trim();
  if (!plain || plain.length > 40 || plain.split(' ').length > 6) return null;
  // Khớp y hệt từ khoá → chắc chắn là tiêu đề. Chỉ BẮT ĐẦU bằng từ khoá (VD "KỸ NĂNG CHUYÊN MÔN") thì
  // phải viết HOA toàn bộ hoặc kết thúc bằng dấu ":" — tránh nhận nhầm nội dung kiểu "Chứng chỉ Kế
  // toán trưởng" thành tiêu đề mục.
  const headingStyle = raw === raw.toUpperCase() || /[:：]$/.test(raw);
  for (const s of SECTION_KEYWORDS) {
    if (
      s.words.some(
        (w) => plain === w || (headingStyle && plain.startsWith(`${w} `)),
      )
    )
      return s.key;
  }
  return null;
}

function labeled(lines: string[], labels: RegExp): string | undefined {
  for (const line of lines) {
    const m = line.match(
      new RegExp(String.raw`^\s*(?:${labels.source})\s*[:：\-–]\s*(.+)$`, 'i'),
    );
    if (m && m[1].trim()) return m[1].trim();
  }
  return undefined;
}

export function findProvince(
  text: string | undefined | null,
): string | undefined {
  if (!text) return undefined;
  const plain = normalizeSearchText(text);
  for (const p of PROVINCES) {
    if (plain.includes(normalizeSearchText(p))) return p;
  }
  for (const [alias, p] of PROVINCE_ALIASES) {
    if (
      new RegExp(`(^|[^a-z])${alias.replace('.', '\\.')}([^a-z]|$)`).test(plain)
    )
      return p;
  }
  return undefined;
}

export function findEmail(text: string): string | undefined {
  return text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0];
}

export function findPhone(text: string): string | undefined {
  const m = text.match(/(?:\+?84|0)(?:[\s.\-]?\d){8,10}/);
  if (!m) return undefined;
  let d = digitsOnly(m[0]);
  if (d.startsWith('84')) d = `0${d.slice(2)}`;
  return d.length >= 9 && d.length <= 11 ? d : undefined;
}

function findDob(lines: string[]): string | undefined {
  const joined = lines.join('\n');
  const m =
    joined.match(
      /(?:ng[aà]y sinh|n[aă]m sinh|date of birth|d\.?o\.?b|birthday|sinh ng[aà]y)\s*[:：\-]?\s*(\d{1,2})[/.\-](\d{1,2})[/.\-]((?:19|20)\d{2})/i,
    ) ?? null;
  if (!m) return undefined;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), m[3]];
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return undefined;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function looksLikeName(line: string): boolean {
  const s = line.trim();
  if (!s || s.length > 40 || /\d|@|:|\/|http/i.test(s)) return false;
  const words = s.split(/\s+/);
  if (words.length < 2 || words.length > 6) return false;
  if (detectSectionKey(s)) return false;
  if (
    /^(curriculum vitae|cv|resume|s[oơ] y[eế]u l[yý] l[iị]ch|h[oồ] s[oơ])/i.test(
      s,
    )
  )
    return false;
  return words.every((w) => /^[A-ZÀ-Ỹ]/u.test(w) || w === w.toUpperCase());
}

function splitList(content: string): string[] {
  return [
    ...new Set(
      content
        .split(/\n|[,;|•●▪]/)
        .map((s) =>
          stripBullet(s)
            .replace(/[.:]+$/, '')
            .trim(),
        )
        .filter((s) => s.length >= 2 && s.length <= 50 && !detectSectionKey(s)),
    ),
  ];
}

const LANGUAGE_NAMES: [RegExp, string][] = [
  [/ti[eế]ng anh|english|ielts|toeic|toefl/i, 'Tiếng Anh'],
  [/ti[eế]ng nh[aậ]t|japanese|jlpt|\bn[1-5]\b/i, 'Tiếng Nhật'],
  [/ti[eế]ng trung|chinese|mandarin|hsk/i, 'Tiếng Trung'],
  [/ti[eế]ng h[aà]n|korean|topik/i, 'Tiếng Hàn'],
  [/ti[eế]ng ph[aá]p|french|delf/i, 'Tiếng Pháp'],
  [/ti[eế]ng [dđ][uứ]c|german/i, 'Tiếng Đức'],
  [/ti[eế]ng nga|russian/i, 'Tiếng Nga'],
  [/ti[eế]ng t[aâ]y ban nha|spanish/i, 'Tiếng Tây Ban Nha'],
  [/ti[eế]ng th[aá]i|thai/i, 'Tiếng Thái'],
];

function languageLevel(text: string): string | undefined {
  const t = normalizeSearchText(text);
  if (/ban ngu|native/.test(t)) return 'native';
  if (
    /thanh thao|fluent|xuat sac|excellent|ielts [7-9]|toeic ([89]\d\d)|\bn1\b|\bn2\b/.test(
      t,
    )
  )
    return 'excellent';
  if (/\btot\b|good|ielts [56]|toeic [67]\d\d|\bn3\b/.test(t)) return 'good';
  if (/\bkha\b|fair|intermediate|toeic [45]\d\d|\bn4\b/.test(t)) return 'fair';
  if (/co ban|basic|beginner|\bn5\b/.test(t)) return 'beginner';
  return undefined;
}

function parseExperiences(content: string): ParsedCvExperience[] {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const dateIdx = lines
    .map((l, i) => (parseRange(l) ? i : -1))
    .filter((i) => i >= 0);
  if (dateIdx.length === 0) return [];
  const isHeaderish = (l: string) =>
    !BULLET.test(l) &&
    l.length <= 90 &&
    l.split(/\s+/).length <= 12 &&
    !/[.;]$/.test(l);
  const claimed = new Set<number>();
  const result: ParsedCvExperience[] = [];

  dateIdx.forEach((di, k) => {
    const range = parseRange(lines[di])!;
    const nextDi = dateIdx[k + 1] ?? lines.length;
    const headerCandidates: string[] = [];
    if (range.rest) headerCandidates.push(range.rest);
    claimed.add(di);
    // Tiêu đề thường nằm ngay TRƯỚC (bố cục "Công ty / Chức danh / Thời gian") hoặc ngay SAU dòng thời gian.
    for (const j of [di - 1, di - 2]) {
      if (
        j >= 0 &&
        !claimed.has(j) &&
        isHeaderish(lines[j]) &&
        !parseRange(lines[j])
      ) {
        headerCandidates.unshift(lines[j]);
        claimed.add(j);
      }
    }
    for (const j of [di + 1, di + 2]) {
      if (
        j < nextDi &&
        !claimed.has(j) &&
        isHeaderish(lines[j]) &&
        headerCandidates.length < 3
      ) {
        headerCandidates.push(lines[j]);
        claimed.add(j);
      } else break;
    }
    const descLines: string[] = [];
    for (let j = di + 1; j < nextDi; j++) {
      if (claimed.has(j)) continue;
      // Để dành 2 dòng tiêu đề cho mục kế tiếp nếu chúng nằm ngay trước dòng thời gian kế tiếp.
      if (k + 1 < dateIdx.length && j >= nextDi - 2 && isHeaderish(lines[j]))
        continue;
      descLines.push(lines[j]);
      claimed.add(j);
    }
    const parts = headerCandidates
      .flatMap((h) => h.split(/\s[|–—]\s|\s-\s|\s@\s|\s+tại\s+|\s+at\s+/i))
      .map((s) => s.trim())
      .filter(Boolean);
    const company = parts.find((p) => COMPANY_HINT.test(p));
    const labeledPos = parts
      .map(
        (p) =>
          p.match(
            /^(?:v[iị] tr[ií]|ch[uứ]c v[uụ]|ch[uứ]c danh|position|title|role)\s*[:：]\s*(.+)$/i,
          )?.[1],
      )
      .find(Boolean);
    const position =
      labeledPos ??
      parts.find((p) => p !== company) ??
      company ??
      'Chưa rõ chức danh';
    result.push({
      position: position
        .replace(/^(?:v[iị] tr[ií]|ch[uứ]c v[uụ]|position)\s*[:：]\s*/i, '')
        .slice(0, 150),
      companyName: company
        ?.replace(/^(?:c[oô]ng ty|company)\s*[:：]\s*/i, '')
        .slice(0, 200),
      startDate: range.start,
      endDate: range.end,
      isCurrent: range.isCurrent,
      description: descLines.join('\n') || undefined,
    });
  });
  return result;
}

function parseEducations(content: string): ParsedCvEducation[] {
  const lines = content
    .split('\n')
    .map((l) => stripBullet(l))
    .filter(Boolean);
  const out: ParsedCvEducation[] = [];
  let current: ParsedCvEducation | null = null;
  for (const line of lines) {
    const range = parseRange(line);
    const text = range ? range.rest : line;
    const isSchool = SCHOOL_HINT.test(text);
    if (isSchool || (range && !current)) {
      if (current) out.push(current);
      current = {
        schoolName: isSchool
          ? text.replace(/^(?:tr[uư][oờ]ng|school)\s*[:：]\s*/i, '')
          : undefined,
      };
    }
    if (!current) continue;
    if (range) {
      current.startDate = current.startDate ?? range.start;
      current.endDate = current.endDate ?? range.end;
    }
    const major = line.match(
      /(?:chuy[eê]n ng[aà]nh|ng[aà]nh|major)\s*[:：]\s*(.+)/i,
    )?.[1];
    if (major) current.major = major.trim();
    if (!current.degree && DEGREE_HINT.test(line) && !isSchool)
      current.degree = text.slice(0, 120);
  }
  if (current) out.push(current);
  return out.filter((e) => e.schoolName || e.degree || e.major).slice(0, 10);
}

export function parseCvText(input: string): ParsedCv {
  const text = (input ?? '').replace(/\r\n?/g, '\n');
  const allLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Chia đoạn theo tiêu đề mục.
  const sections: { key: string; title: string; lines: string[] }[] = [
    { key: 'intro', title: SECTION_TITLES.intro, lines: [] },
  ];
  for (const line of allLines) {
    const key = detectSectionKey(line);
    if (key)
      sections.push({
        key,
        title: line.replace(/[:：]+$/, '').trim(),
        lines: [],
      });
    else sections[sections.length - 1].lines.push(line);
  }
  const content = (key: string) =>
    sections
      .filter((s) => s.key === key)
      .map((s) => s.lines.join('\n'))
      .join('\n')
      .trim();
  const headLines = [
    ...sections[0].lines,
    ...sections.filter((s) => s.key === 'personal').flatMap((s) => s.lines),
  ];

  // 2. Thông tin cá nhân.
  const email = findEmail(text);
  const phone = findPhone(headLines.join('\n')) ?? findPhone(text);
  const nameLabeled = labeled(
    headLines,
    /h[oọ] v[aà] t[eê]n|h[oọ] t[eê]n|full ?name|name/,
  );
  const nameGuess = headLines.slice(0, 8).find(looksLikeName);
  const fullName = (nameLabeled ?? nameGuess)?.replace(/\s+/g, ' ').trim();
  const headlineLabeled = labeled(
    allLines.slice(0, 40),
    /v[iị] tr[ií] [uứ]ng tuy[eể]n|v[iị] tr[ií] mong mu[oố]n|v[iị] tr[ií]|ch[uứ]c danh|position|job title|applying for/,
  );
  let headline = headlineLabeled;
  if (!headline && nameGuess) {
    const idx = sections[0].lines.indexOf(nameGuess);
    const next = sections[0].lines[idx + 1];
    if (
      next &&
      next.length <= 60 &&
      !findEmail(next) &&
      !findPhone(next) &&
      !/\d{4}/.test(next) &&
      !detectSectionKey(next)
    ) {
      headline = next;
    }
  }
  const genderRaw = labeled(headLines, /gi[oớ]i t[ií]nh|gender|sex/);
  const gender = genderRaw
    ? /n[uữ]|female/i.test(genderRaw)
      ? 'female'
      : /nam|male/i.test(genderRaw)
        ? 'male'
        : undefined
    : undefined;
  const address = labeled(
    headLines,
    /[dđ][iị]a ch[iỉ]|n[oơ]i [oở]|address|ch[oỗ] [oở] hi[eệ]n t[aạ]i/,
  );

  // 3. Các mục chính.
  const experiences = parseExperiences(content('experience'));
  const educations = parseEducations(content('education'));
  const skills = splitList(content('skills')).slice(0, 30);
  const languageText = content('languages');
  const languages: { language: string; level?: string }[] = [];
  for (const line of languageText.split('\n')) {
    for (const [re, name] of LANGUAGE_NAMES) {
      if (re.test(line) && !languages.some((l) => l.language === name)) {
        languages.push({ language: name, level: languageLevel(line) });
      }
    }
  }
  const certificates = splitList(content('certificates')).slice(0, 20);
  const objective = content('objective');

  // 4. Số năm kinh nghiệm: ghi rõ trong CV, hoặc tự tính từ các mốc thời gian kinh nghiệm.
  let yearsOfExperience: number | undefined;
  const yearsLabeled =
    text.match(/(\d{1,2})\+?\s*n[aă]m kinh nghi[eệ]m/i) ??
    text.match(/(\d{1,2})\+?\s*years? of experience/i);
  if (yearsLabeled) yearsOfExperience = Number(yearsLabeled[1]);
  else if (experiences.some((e) => e.startDate)) {
    const starts = experiences
      .map((e) => e.startDate)
      .filter(Boolean)
      .sort() as string[];
    const ends = experiences
      .map((e) =>
        e.isCurrent ? new Date().toISOString().slice(0, 10) : e.endDate,
      )
      .filter(Boolean)
      .sort() as string[];
    if (starts[0] && ends.length) {
      const years =
        (new Date(ends[ends.length - 1]).getTime() -
          new Date(starts[0]).getTime()) /
        (365.25 * 86400000);
      if (years >= 0 && years < 60) yearsOfExperience = Math.floor(years);
    }
  }

  return {
    fullName: fullName ? titleCaseIfUpper(fullName) : undefined,
    email,
    phone,
    dateOfBirth: findDob(headLines.length ? headLines : allLines.slice(0, 30)),
    gender,
    address,
    province: findProvince(address) ?? findProvince(headLines.join(' ')),
    headline,
    careerObjective: objective || undefined,
    yearsOfExperience,
    experiences,
    educations,
    skills,
    languages,
    certificates,
    sections: sections
      .filter((s) => s.lines.length > 0)
      .map((s) => ({
        key: s.key,
        title: SECTION_TITLES[s.key] ?? s.title,
        content: s.lines.join('\n'),
      })),
  };
}
