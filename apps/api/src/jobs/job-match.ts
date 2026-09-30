// Đợt 38 — chấm điểm "độ phù hợp" việc làm ↔ hồ sơ (thuần quy tắc, không gọi dịch vụ AI trả phí).
// Dùng chung: thẻ tin có % phù hợp, "Việc gợi ý cho bạn", cảnh báo việc mới, gợi ý hồ sơ cho nhà tuyển dụng.
// Cùng thang điểm/trọng số với "Đánh giá mức độ tương thích" ở trang chi tiết tin (JobsService.getCompatibility).
export const EXPERIENCE_LEVEL_YEARS: {
  label: string;
  min: number;
  max: number;
}[] = [
  { label: 'Không yêu cầu kinh nghiệm', min: 0, max: Infinity },
  { label: 'Chưa có kinh nghiệm', min: 0, max: 0 },
  { label: 'Đến dưới 1 năm', min: 0, max: 1 },
  { label: 'Từ 1 đến 4 năm', min: 1, max: 4 },
  { label: 'Từ 5 đến 7 năm', min: 5, max: 7 },
  { label: 'Từ 7 đến 10 năm', min: 7, max: 10 },
  { label: 'Từ 11 năm', min: 11, max: Infinity },
];
export const LEVEL_ORDER: string[] = [
  'Sinh viên / Thực tập sinh',
  'Mới tốt nghiệp',
  'Nhân viên',
  'Trưởng nhóm / Giám sát',
  'Quản lý',
  'Quản lý cấp cao',
  'Điều hành cấp cao',
];

export interface MatchProfile {
  yearsOfExperience?: number | null;
  desiredLevel?: string | null;
  currentLevel?: string | null;
  desiredSalaryMin?: number | null;
  province?: string | null;
  desiredLocations?: string[] | null;
  desiredIndustries?: string[] | null;
  desiredPosition?: string | null;
  profileTitle?: string | null;
  skillNames: string[];
}
export interface MatchJob {
  title: string;
  tags?: string[] | null;
  requirements?: string | null;
  description?: string | null;
  experienceLevel?: string | null;
  level?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  location?: string | null;
  provinces?: string[] | null;
  industry?: string | null;
}
export interface MatchResult {
  score: number; // 0–100
  reasons: string[]; // vì sao phù hợp (tối đa 3)
  gaps: string[]; // điểm chưa khớp (tối đa 2)
}

const strip = (h?: string | null) => (h ?? '').replace(/<[^>]*>/g, ' ');
const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));
const norm = (v?: string | null) => (v ?? '').toLowerCase().trim();

export function scoreMatch(p: MatchProfile, j: MatchJob): MatchResult {
  const skills = p.skillNames.map(norm).filter(Boolean);
  const jobText = [
    ...(j.tags ?? []),
    j.title,
    strip(j.requirements),
    strip(j.description),
  ]
    .join(' ')
    .toLowerCase();
  const matchedSkills = skills.filter((s) => jobText.includes(s));
  const skillScore = skills.length
    ? clamp(Math.round((matchedSkills.length / skills.length) * 100))
    : 40;

  let expScore = 60;
  const bucket = EXPERIENCE_LEVEL_YEARS.find(
    (b) => b.label === j.experienceLevel,
  );
  if (bucket && p.yearsOfExperience != null) {
    const y = p.yearsOfExperience;
    if (y >= bucket.min && y <= bucket.max) expScore = 100;
    else if (y < bucket.min) expScore = clamp(100 - (bucket.min - y) * 20);
    else expScore = clamp(100 - (y - bucket.max) * 5, 40);
  } else if (bucket && bucket.max === Infinity && bucket.min === 0)
    expScore = 100;

  let levelScore = 50;
  const ci = LEVEL_ORDER.indexOf(p.desiredLevel ?? p.currentLevel ?? '');
  const ji = LEVEL_ORDER.indexOf(j.level ?? '');
  if (ci >= 0 && ji >= 0) levelScore = clamp(100 - Math.abs(ci - ji) * 25);

  let salaryScore = 60;
  if (p.desiredSalaryMin != null && j.salaryMax != null)
    salaryScore =
      j.salaryMax >= p.desiredSalaryMin
        ? 100
        : clamp(100 - (p.desiredSalaryMin - j.salaryMax) * 5);
  else if (p.desiredSalaryMin == null && j.salaryMax == null) salaryScore = 60;
  else salaryScore = 70;

  let locScore = 60;
  const cLoc = [p.province, ...(p.desiredLocations ?? [])]
    .filter(Boolean)
    .map((v) => norm(v));
  const jLoc = [j.location, ...(j.provinces ?? [])]
    .filter(Boolean)
    .map((v) => norm(v));
  if (cLoc.length && jLoc.length)
    locScore = cLoc.some((c) =>
      jLoc.some((x) => x.includes(c) || c.includes(x)),
    )
      ? 100
      : 25;

  let indScore = 60;
  if (p.desiredIndustries?.length && j.industry)
    indScore = p.desiredIndustries.some((i) => norm(i) === norm(j.industry))
      ? 100
      : 30;

  // Chức danh: cộng thêm nhẹ (tối đa +6) khi tên vị trí mong muốn trùng từ khoá với tiêu đề tin.
  const STOP = new Set([
    'trưởng',
    'phó',
    'nhân',
    'viên',
    'phòng',
    'chuyên',
    'giám',
    'đốc',
    'quản',
    'lý',
    'nhóm',
    'cấp',
    'cao',
    'the',
    'and',
  ]);
  const titleWords = Array.from(
    new Set(
      norm([p.desiredPosition, p.profileTitle].filter(Boolean).join(' '))
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP.has(w)),
    ),
  );
  const hits = titleWords.filter((w) => norm(j.title).includes(w)).length;
  const titleHit =
    titleWords.length > 0 &&
    hits >= Math.max(1, Math.ceil(titleWords.length / 2));

  const base = Math.round(
    (skillScore * 30 +
      expScore * 20 +
      levelScore * 15 +
      salaryScore * 15 +
      locScore * 10 +
      indScore * 10) /
      100,
  );
  const score = clamp(base + (titleHit ? 6 : 0));

  const reasons: string[] = [];
  const gaps: string[] = [];
  if (titleHit) reasons.push('Chức danh gần với vị trí bạn mong muốn');
  if (indScore === 100) reasons.push(`Đúng ngành bạn quan tâm (${j.industry})`);
  if (locScore === 100) reasons.push('Đúng khu vực bạn muốn làm việc');
  if (matchedSkills.length)
    reasons.push(
      `Khớp ${matchedSkills.length} kỹ năng: ${matchedSkills.slice(0, 3).join(', ')}`,
    );
  if (salaryScore === 100 && p.desiredSalaryMin != null && j.salaryMax != null)
    reasons.push('Lương đáp ứng mức mong muốn');
  if (
    expScore === 100 &&
    p.yearsOfExperience != null &&
    bucket &&
    !(bucket.max === Infinity && bucket.min === 0)
  )
    reasons.push('Kinh nghiệm đúng yêu cầu');
  if (levelScore === 100) reasons.push('Đúng cấp bậc');

  if (indScore <= 30) gaps.push('Khác ngành bạn mong muốn');
  if (locScore <= 25) gaps.push('Khác khu vực bạn chọn');
  if (salaryScore < 70 && p.desiredSalaryMin != null)
    gaps.push('Lương thấp hơn mong muốn');
  if (expScore < 70) gaps.push('Kinh nghiệm chưa đạt yêu cầu');
  const missing = (j.tags ?? [])
    .filter((t) => !skills.includes(norm(t)))
    .slice(0, 2);
  if (skills.length && missing.length && skillScore < 60)
    gaps.push(`Còn thiếu kỹ năng: ${missing.join(', ')}`);

  return { score, reasons: reasons.slice(0, 3), gaps: gaps.slice(0, 2) };
}
