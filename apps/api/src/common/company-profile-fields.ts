import type { Company } from '../database/entities/company.entity';

// Đợt 49 — áp các trường "Tổng quan công ty" (dùng chung NTD tự sửa + Admin sửa hộ). Chuỗi rỗng = xoá.
export interface CompanyProfileFields {
  address?: string;
  contactPerson?: string;
  companyType?: string;
  vision?: string;
  mission?: string;
  galleryUrls?: string[];
}

export function applyCompanyProfileFields(company: Company, dto: CompanyProfileFields) {
  const txt = (v?: string) => (v === undefined ? undefined : v.trim() || null);
  if (dto.address !== undefined) company.address = txt(dto.address);
  if (dto.contactPerson !== undefined) company.contactPerson = txt(dto.contactPerson);
  if (dto.companyType !== undefined) company.companyType = txt(dto.companyType);
  if (dto.vision !== undefined) company.vision = txt(dto.vision);
  if (dto.mission !== undefined) company.mission = txt(dto.mission);
  if (dto.galleryUrls !== undefined) {
    const urls = dto.galleryUrls.map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u));
    company.galleryUrls = urls.length ? urls.slice(0, 12) : null;
  }
}
