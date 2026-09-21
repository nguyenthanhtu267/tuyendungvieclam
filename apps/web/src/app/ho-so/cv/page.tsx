'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { RichTextView } from '@/components/RichTextView';
import { useAuth } from '@/lib/auth-context';
import {
  profileApi,
  type FullProfile,
  type ProfileSections,
  type Gender,
  type MaritalStatus,
  type LanguageLevel,
  type SkillLevel,
} from '@/lib/api';

// Đợt 8 — Trang CV: tự sinh CV 1 mẫu từ dữ liệu hồ sơ trực tuyến (/ho-so/truc-tuyen).
// Xuất PDF bằng hộp thoại in của trình duyệt (window.print) — không dùng thư viện PDF trên máy chủ
// để giữ đúng dấu tiếng Việt và chạy được trên hosting miễn phí (theo quyết định đã chốt).

const GENDER_LABEL: Record<Gender, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };
const MARITAL_LABEL: Record<MaritalStatus, string> = { single: 'Độc thân', married: 'Đã kết hôn', other: 'Khác' };
const LANGUAGE_LEVEL_LABEL: Record<LanguageLevel, string> = {
  native: 'Bản ngữ',
  excellent: 'Rất tốt',
  good: 'Tốt',
  fair: 'Khá',
  beginner: 'Cơ bản',
};
const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  beginner: 'Cơ bản',
  intermediate: 'Trung bình',
  advanced: 'Thành thạo',
  expert: 'Chuyên gia',
};

function fmtDate(v?: string | null) {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return d && m && y ? `${m}/${y}` : v;
}
function fmtRange(s?: string | null, e?: string | null, current?: boolean) {
  const from = fmtDate(s);
  const to = current ? 'Hiện tại' : fmtDate(e);
  return [from, to].filter(Boolean).join(' – ');
}
function fmtSalary(min?: number, max?: number, currency?: string) {
  if (!min && !max) return '';
  const cur = currency === 'VND' || !currency ? 'triệu VNĐ' : currency;
  if (min && max) return `${min} – ${max} ${cur}`;
  return `${min || max} ${cur}`;
}

export default function CvBuilderPage() {
  const router = useRouter();
  const { me, token } = useAuth();

  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [sections, setSections] = useState<ProfileSections | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedOnce = useRef(false);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && me.role !== 'candidate') router.replace('/');
  }, [me, router]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      if (!loadedOnce.current) setLoading(true);
      try {
        const res = await profileApi.getFull(token);
        setProfile(res.profile);
        setSections(res.sections);
        loadedOnce.current = true;
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (me === undefined || (me && loading && !loadedOnce.current)) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-ink-faint text-sm">Đang tải...</div>
      </main>
    );
  }

  if (!me || !profile || !sections || !token) return null;

  const fullName = profile.fullName || [profile.lastName, profile.firstName].filter(Boolean).join(' ');
  const address = [profile.address, profile.district, profile.province, profile.country].filter(Boolean).join(', ');

  return (
    <main className="min-h-screen bg-surface-alt print:bg-white">
      <div className="print:hidden">
        <SiteHeader />
      </div>

      <div className="max-w-[850px] mx-auto px-4 py-6 print:px-0 print:py-0 print:max-w-none">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <div>
            <h1 className="font-extrabold text-lg">CV của tôi</h1>
            <p className="text-ink-faint text-[12.5px] mt-0.5">
              Tự động tạo từ hồ sơ trực tuyến —{' '}
              <Link href="/ho-so/truc-tuyen" className="text-primary hover:underline">
                chỉnh sửa hồ sơ
              </Link>{' '}
              để cập nhật CV.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/ho-so" className="tvl-btn-ghost !w-auto px-4 text-xs">
              ← Quay lại
            </Link>
            <button onClick={() => window.print()} className="tvl-btn-primary !w-auto px-4 text-xs">
              Tải CV (PDF)
            </button>
          </div>
        </div>

        {/* Trang CV — khổ A4, nội dung in được */}
        <div className="rounded-xl border border-border bg-white p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none print:p-10 cv-page">
          <header className="flex gap-5 items-start border-b-2 border-primary pb-5">
            {profile.avatarMimeType ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profileApi.avatarUrl(profile.id)}
                alt={fullName}
                className="w-24 h-24 rounded-lg object-cover border border-border shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-primary-tint text-primary flex items-center justify-center font-bold text-2xl shrink-0">
                {fullName
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(-2)
                  .join('')
                  .toUpperCase() || 'CV'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-extrabold text-ink">{fullName || 'Chưa cập nhật họ tên'}</h2>
              <p className="text-primary font-bold text-[15px] mt-0.5">
                {profile.profileTitle || profile.desiredPosition || 'Chưa cập nhật vị trí ứng tuyển'}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[12px] text-ink-muted">
                {!profile.hideContactInfo && profile.phone && <span>📞 {profile.phone}</span>}
                {!profile.hideContactInfo && (profile.contactEmail || me.email) && (
                  <span>✉️ {profile.contactEmail || me.email}</span>
                )}
                {address && <span>📍 {address}</span>}
                {profile.dateOfBirth && <span>🎂 {fmtDate(profile.dateOfBirth)}</span>}
              </div>
              {profile.hideContactInfo && (
                <p className="text-[11px] text-ink-faint mt-1.5 italic">
                  Thông tin liên hệ đang được ẩn trong hồ sơ trực tuyến.
                </p>
              )}
            </div>
          </header>

          <div className="grid grid-cols-[1fr_220px] gap-8 mt-5">
            <div className="flex flex-col gap-5 min-w-0">
              {profile.careerObjective && (
                <CvSection title="Mục tiêu nghề nghiệp">
                  <RichTextView value={profile.careerObjective} className="text-[12.5px] text-ink-muted leading-relaxed" />
                </CvSection>
              )}

              {sections.experiences.length > 0 && (
                <CvSection title="Kinh nghiệm làm việc">
                  <div className="flex flex-col gap-3">
                    {sections.experiences.map((it) => (
                      <div key={it.id}>
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="font-bold text-[13px] text-ink">{it.position}</span>
                          <span className="text-[11px] text-ink-faint shrink-0">
                            {fmtRange(it.startDate, it.endDate, it.isCurrent)}
                          </span>
                        </div>
                        {it.companyName && <div className="text-[12px] text-primary font-semibold">{it.companyName}</div>}
                        {it.description && (
                          <RichTextView value={it.description} className="text-[12px] text-ink-muted mt-0.5 leading-relaxed" />
                        )}
                      </div>
                    ))}
                  </div>
                </CvSection>
              )}

              {sections.educations.length > 0 && (
                <CvSection title="Học vấn">
                  <div className="flex flex-col gap-3">
                    {sections.educations.map((it) => (
                      <div key={it.id}>
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="font-bold text-[13px] text-ink">{it.schoolName}</span>
                          <span className="text-[11px] text-ink-faint shrink-0">{fmtRange(it.startDate, it.endDate)}</span>
                        </div>
                        {(it.degree || it.major) && (
                          <div className="text-[12px] text-ink-muted">{[it.degree, it.major].filter(Boolean).join(' · ')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </CvSection>
              )}

              {sections.achievements.length > 0 && (
                <CvSection title="Thành tích & giải thưởng">
                  <div className="flex flex-col gap-2.5">
                    {sections.achievements.map((it) => (
                      <div key={it.id}>
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="font-bold text-[12.5px] text-ink">{it.title}</span>
                          {it.date && <span className="text-[11px] text-ink-faint shrink-0">{fmtDate(it.date)}</span>}
                        </div>
                        {it.description && <RichTextView value={it.description} className="text-[12px] text-ink-muted mt-0.5" />}
                      </div>
                    ))}
                  </div>
                </CvSection>
              )}

              {sections.activities.length > 0 && (
                <CvSection title="Hoạt động ngoại khóa">
                  <div className="flex flex-col gap-2.5">
                    {sections.activities.map((it) => (
                      <div key={it.id}>
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="font-bold text-[12.5px] text-ink">{it.title}</span>
                          <span className="text-[11px] text-ink-faint shrink-0">{fmtRange(it.startDate, it.endDate)}</span>
                        </div>
                        {it.organizationName && <div className="text-[12px] text-primary font-semibold">{it.organizationName}</div>}
                        {it.description && <RichTextView value={it.description} className="text-[12px] text-ink-muted mt-0.5" />}
                      </div>
                    ))}
                  </div>
                </CvSection>
              )}

              {sections.references.length > 0 && (
                <CvSection title="Người tham chiếu">
                  <div className="flex flex-col gap-2.5">
                    {sections.references.map((it) => (
                      <div key={it.id}>
                        <div className="font-bold text-[12.5px] text-ink">{it.fullName}</div>
                        <div className="text-[12px] text-ink-muted">
                          {[it.position, it.company].filter(Boolean).join(' · ')}
                        </div>
                        <div className="text-[11.5px] text-ink-faint">{[it.phone, it.email].filter(Boolean).join(' · ')}</div>
                      </div>
                    ))}
                  </div>
                </CvSection>
              )}
            </div>

            <aside className="flex flex-col gap-5 min-w-0">
              <CvSection title="Thông tin cá nhân">
                <div className="flex flex-col gap-1 text-[12px] text-ink-muted">
                  {profile.gender && <div>{GENDER_LABEL[profile.gender]}</div>}
                  {profile.maritalStatus && <div>{MARITAL_LABEL[profile.maritalStatus]}</div>}
                  {profile.nationality && <div>{profile.nationality}</div>}
                </div>
              </CvSection>

              {(profile.desiredLevel || profile.desiredSalaryMin || profile.desiredSalaryMax || (profile.desiredJobTypes?.length ?? 0) > 0) && (
                <CvSection title="Công việc mong muốn">
                  <div className="flex flex-col gap-1 text-[12px] text-ink-muted">
                    {profile.desiredLevel && <div>Cấp bậc: {profile.desiredLevel}</div>}
                    {(profile.desiredSalaryMin || profile.desiredSalaryMax) && (
                      <div>Mức lương: {fmtSalary(profile.desiredSalaryMin, profile.desiredSalaryMax, profile.salaryCurrency)}</div>
                    )}
                    {(profile.desiredJobTypes?.length ?? 0) > 0 && <div>Hình thức: {profile.desiredJobTypes!.join(', ')}</div>}
                    {(profile.desiredIndustries?.length ?? 0) > 0 && <div>Ngành nghề: {profile.desiredIndustries!.join(', ')}</div>}
                    {(profile.desiredLocations?.length ?? 0) > 0 && <div>Nơi làm việc: {profile.desiredLocations!.join(', ')}</div>}
                  </div>
                </CvSection>
              )}

              {sections.skills.length > 0 && (
                <CvSection title="Kỹ năng">
                  <div className="flex flex-col gap-1.5">
                    {sections.skills.map((it) => (
                      <div key={it.id} className="flex justify-between text-[12px]">
                        <span className="text-ink-muted">{it.skillName}</span>
                        <span className="text-ink-faint text-[11px]">{SKILL_LEVEL_LABEL[it.level]}</span>
                      </div>
                    ))}
                  </div>
                </CvSection>
              )}

              {sections.languages.length > 0 && (
                <CvSection title="Ngoại ngữ">
                  <div className="flex flex-col gap-1.5">
                    {sections.languages.map((it) => (
                      <div key={it.id} className="flex justify-between text-[12px]">
                        <span className="text-ink-muted">{it.language}</span>
                        <span className="text-ink-faint text-[11px]">{LANGUAGE_LEVEL_LABEL[it.level]}</span>
                      </div>
                    ))}
                  </div>
                </CvSection>
              )}

              {sections.certificates.length > 0 && (
                <CvSection title="Chứng chỉ">
                  <div className="flex flex-col gap-2">
                    {sections.certificates.map((it) => (
                      <div key={it.id} className="text-[12px]">
                        <div className="font-semibold text-ink">{it.name}</div>
                        <div className="text-ink-faint text-[11px]">
                          {[it.issuer, fmtDate(it.issueDate)].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </CvSection>
              )}
            </aside>
          </div>
        </div>

        <p className="text-center text-[11px] text-ink-faint mt-3 print:hidden">
          Nhấn &ldquo;Tải CV (PDF)&rdquo; rồi chọn &ldquo;Lưu thành PDF&rdquo; trong hộp thoại in để tải về.
        </p>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </main>
  );
}

function CvSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[12px] font-extrabold uppercase tracking-wide text-primary border-b border-border pb-1 mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}
