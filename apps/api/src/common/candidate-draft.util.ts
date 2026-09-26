import { CvArchiveSnapshot } from '../database/entities/cv-archive.entity';
import { CandidateDraftDto } from './dto/candidate-draft.dto';
import { ParsedCv } from './cv-parser.util';

// Đợt 18c/18d (26/09/2026) — chuyển đổi qua lại giữa "bản nháp hồ sơ" (form người dùng xem lại), bản
// chụp hồ sơ trong Kho CV (CvArchiveSnapshot) và kết quả tách CV tự động (ParsedCv).

const trimOrNull = (v?: string | null) => (v && v.trim() ? v.trim() : null);

export function draftToSnapshot(d: CandidateDraftDto): CvArchiveSnapshot {
  return {
    accountEmail: null,
    fullName: d.fullName.trim(),
    profileTitle: trimOrNull(d.profileTitle),
    dateOfBirth: d.dateOfBirth ?? null,
    gender: d.gender ?? null,
    phone: trimOrNull(d.phone),
    contactEmail: trimOrNull(d.email),
    province: trimOrNull(d.province),
    address: trimOrNull(d.address),
    careerObjective: trimOrNull(d.careerObjective),
    desiredPosition: trimOrNull(d.desiredPosition),
    desiredLevel: trimOrNull(d.desiredLevel),
    desiredSalaryMin: d.desiredSalaryMin ?? null,
    desiredSalaryMax: d.desiredSalaryMax ?? null,
    salaryCurrency: 'VND',
    desiredIndustries: d.desiredIndustries?.length ? d.desiredIndustries : null,
    desiredLocations: d.desiredLocations?.length ? d.desiredLocations : null,
    desiredJobTypes: null,
    yearsOfExperience: d.yearsOfExperience ?? null,
    currentLevel: null,
    highestDegree: trimOrNull(d.highestDegree),
    experiences: (d.experiences ?? []).map((e) => ({
      position: e.position.trim(),
      companyName: trimOrNull(e.companyName),
      startDate: e.startDate ?? null,
      endDate: e.isCurrent ? null : (e.endDate ?? null),
      isCurrent: !!e.isCurrent,
      description: trimOrNull(e.description),
    })),
    educations: (d.educations ?? []).map((e) => ({
      schoolName: trimOrNull(e.schoolName),
      degree: trimOrNull(e.degree),
      major: trimOrNull(e.major),
      startDate: e.startDate ?? null,
      endDate: e.endDate ?? null,
    })),
    certificates: (d.certificates ?? [])
      .filter((c) => c.trim())
      .map((name) => ({ name: name.trim(), issuer: null, issueDate: null })),
    languages: (d.languages ?? []).map((l) => ({
      language: l.language,
      level: l.level ?? 'fair',
    })),
    skills: [
      ...new Set((d.skills ?? []).map((s) => s.trim()).filter(Boolean)),
    ].map((skillName) => ({
      skillName,
      level: 'intermediate',
    })),
    achievements: [],
    activities: [],
    references: [],
  };
}

// Bản chụp Kho CV (+ kết quả đọc file CV nếu có) → bản nháp để Admin xem lại trước khi tạo hồ sơ nguồn
// tổng hợp. Ưu tiên dữ liệu hồ sơ online (ứng viên tự nhập, chính xác hơn); chỉ lấy từ file CV những
// trường hồ sơ online còn trống.
export function snapshotToDraft(
  s: CvArchiveSnapshot,
  parsed?: Partial<ParsedCv> | null,
  fallbackTitle?: string | null,
): CandidateDraftDto {
  const p = parsed ?? {};
  const experiences = s.experiences.length
    ? s.experiences.map((e) => ({
        position: e.position,
        companyName: e.companyName ?? undefined,
        startDate: e.startDate ?? undefined,
        endDate: e.endDate ?? undefined,
        isCurrent: e.isCurrent,
        description: e.description ?? undefined,
      }))
    : (p.experiences ?? []);
  const educations = s.educations.length
    ? s.educations.map((e) => ({
        schoolName: e.schoolName ?? undefined,
        degree: e.degree ?? undefined,
        major: e.major ?? undefined,
        startDate: e.startDate ?? undefined,
        endDate: e.endDate ?? undefined,
      }))
    : (p.educations ?? []);
  return {
    fullName: s.fullName || p.fullName || 'Ứng viên',
    profileTitle:
      s.profileTitle ||
      s.desiredPosition ||
      p.headline ||
      fallbackTitle ||
      undefined,
    phone: s.phone || p.phone || undefined,
    email: s.contactEmail || s.accountEmail || p.email || undefined,
    dateOfBirth: s.dateOfBirth || p.dateOfBirth || undefined,
    gender: s.gender || p.gender || undefined,
    province: s.province || p.province || undefined,
    address: s.address || p.address || undefined,
    desiredPosition:
      s.desiredPosition || p.headline || fallbackTitle || undefined,
    desiredLevel: s.desiredLevel || undefined,
    desiredSalaryMin: s.desiredSalaryMin ?? undefined,
    desiredSalaryMax: s.desiredSalaryMax ?? undefined,
    yearsOfExperience: s.yearsOfExperience ?? p.yearsOfExperience ?? undefined,
    highestDegree: s.highestDegree || undefined,
    careerObjective: s.careerObjective || p.careerObjective || undefined,
    desiredIndustries: s.desiredIndustries ?? undefined,
    desiredLocations: s.desiredLocations ?? undefined,
    experiences,
    educations,
    skills: s.skills.length
      ? s.skills.map((k) => k.skillName)
      : (p.skills ?? []),
    languages: s.languages.length
      ? s.languages.map((l) => ({ language: l.language, level: l.level }))
      : (p.languages ?? []),
    certificates: s.certificates.length
      ? s.certificates.map((c) => c.name)
      : (p.certificates ?? []),
  };
}

// Kết quả tách CV (dán nội dung / file / link) → bản nháp cho form "Xem lại trước khi lưu".
export function parsedToDraft(
  p: ParsedCv | null,
  rawText?: string,
): Partial<CandidateDraftDto> {
  if (!p)
    return {
      rawText: rawText || undefined,
      experiences: [],
      educations: [],
      skills: [],
      languages: [],
      certificates: [],
    };
  return {
    fullName: p.fullName ?? '',
    profileTitle: p.headline,
    desiredPosition: p.headline,
    phone: p.phone,
    email: p.email,
    dateOfBirth: p.dateOfBirth,
    gender: p.gender,
    province: p.province,
    address: p.address,
    yearsOfExperience: p.yearsOfExperience,
    careerObjective: p.careerObjective,
    experiences: p.experiences ?? [],
    educations: p.educations ?? [],
    skills: p.skills ?? [],
    languages: p.languages ?? [],
    certificates: p.certificates ?? [],
    rawText: rawText || undefined,
  };
}
