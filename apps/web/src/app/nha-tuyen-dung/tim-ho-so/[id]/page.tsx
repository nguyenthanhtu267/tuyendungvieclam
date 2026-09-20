'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import EmployerHeader from '@/components/EmployerHeader';
import { useAuth } from '@/lib/auth-context';
import { cvSearchApi, ApiError, type CandidateDetail } from '@/lib/api';
import { formatDate } from '@/lib/format';

// Đợt 9 — Trang chi tiết hồ sơ ứng viên cho nhà tuyển dụng (/nha-tuyen-dung/tim-ho-so/[id]).

const GENDER_LABEL: Record<string, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' };
const MARITAL_LABEL: Record<string, string> = { single: 'Độc thân', married: 'Đã kết hôn', other: 'Khác' };
const LANGUAGE_LEVEL_LABEL: Record<string, string> = {
  native: 'Bản ngữ',
  excellent: 'Rất tốt',
  good: 'Tốt',
  fair: 'Khá',
  beginner: 'Cơ bản',
};
const SKILL_LEVEL_LABEL: Record<string, string> = {
  beginner: 'Cơ bản',
  intermediate: 'Trung bình',
  advanced: 'Thành thạo',
  expert: 'Chuyên gia',
};

function fmtDate(v?: string | null) {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return d && m && y ? `${d}/${m}/${y}` : v;
}
function fmtRange(s?: string | null, e?: string | null, current?: boolean) {
  const from = fmtDate(s);
  const to = current ? 'Hiện tại' : fmtDate(e);
  return [from, to].filter(Boolean).join(' – ');
}
function fmtSalary(min?: number, max?: number, currency?: string) {
  if (!min && !max) return 'Thoả thuận';
  const cur = currency === 'VND' || !currency ? 'triệu' : currency;
  if (min && max) return `${min} – ${max} ${cur}`;
  return `${min || max} ${cur}`;
}

export default function CandidateDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { me, token } = useAuth();

  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && !me.role.startsWith('employer')) router.replace('/');
  }, [me, router]);

  useEffect(() => {
    if (!token || !params.id) return;
    (async () => {
      if (!loadedOnce.current) setLoading(true);
      try {
        setDetail(await cvSearchApi.getDetail(token, params.id));
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Không thể tải hồ sơ');
      } finally {
        setLoading(false);
        loadedOnce.current = true;
      }
    })();
  }, [token, params.id]);

  async function handleUnlock() {
    if (!token || !params.id) return;
    setUnlocking(true);
    try {
      setDetail(await cvSearchApi.unlock(token, params.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể mở hồ sơ');
    } finally {
      setUnlocking(false);
    }
  }

  if (!me || !me.role.startsWith('employer')) return null;

  if (loading && !loadedOnce.current) {
    return (
      <main className="min-h-screen bg-bg">
        <EmployerHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-ink-faint text-sm">Đang tải...</div>
      </main>
    );
  }

  if (error && !detail) {
    return (
      <main className="min-h-screen bg-bg">
        <EmployerHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <p className="text-critical text-sm font-semibold">{error}</p>
          <Link href="/nha-tuyen-dung/tim-ho-so" className="tvl-btn-ghost !w-auto px-4 mt-4 inline-block text-xs">
            ← Quay lại tìm kiếm
          </Link>
        </div>
      </main>
    );
  }

  if (!detail) return null;

  const address = [detail.address, detail.district, detail.province, detail.country].filter(Boolean).join(', ');

  return (
    <main className="min-h-screen bg-bg">
      <EmployerHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
        <Link href="/nha-tuyen-dung/tim-ho-so" className="text-xs font-semibold text-primary hover:underline w-fit">
          ← Quay lại tìm kiếm
        </Link>

        {error && <div className="rounded-lg bg-critical-tint text-critical text-xs font-semibold px-3.5 py-2.5">{error}</div>}

        <div className="rounded-xl border border-border bg-white p-5">
          <div className="flex gap-4 items-start flex-wrap">
            {detail.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${detail.avatarUrl}`}
                alt={detail.fullName}
                className="w-20 h-20 rounded-full object-cover border border-border shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-tint text-primary flex items-center justify-center font-bold text-xl shrink-0">
                {detail.fullName
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(-2)
                  .join('')
                  .toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-extrabold text-ink">{detail.fullName}</h1>
                {detail.visibility === 'urgent' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-critical-tint text-critical">Khẩn cấp</span>
                )}
                {detail.unlocked && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success-tint text-success">Đã mở</span>
                )}
              </div>
              <div className="text-primary font-bold text-[14px] mt-0.5">{detail.profileTitle}</div>
              <div className="text-ink-faint text-[12px] mt-1.5">
                {[detail.desiredPosition, detail.desiredLevel, fmtSalary(detail.desiredSalaryMin, detail.desiredSalaryMax, detail.salaryCurrency)]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            {!detail.unlocked && (
              <button onClick={handleUnlock} disabled={unlocking} className="tvl-btn-primary !w-auto px-5 shrink-0">
                {unlocking ? 'Đang mở…' : 'Mở hồ sơ (−1 điểm)'}
              </button>
            )}
          </div>

          {!detail.unlocked ? (
            <div className="mt-4 rounded-lg bg-surface-alt px-3.5 py-3 text-[11.5px] text-ink-muted">
              Họ tên đầy đủ, số điện thoại, email, địa chỉ, ngày sinh và tên công ty/trường học cụ thể đang được ẩn.
              Mở hồ sơ (trừ 1 điểm từ gói dịch vụ) để xem đầy đủ — chỉ trừ điểm lần đầu, xem lại sau đó hoàn toàn
              miễn phí.
            </div>
          ) : (
            <div className="mt-4 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
              <InfoRow label="Điện thoại" value={detail.phone} />
              <InfoRow label="Email" value={detail.contactEmail} />
              <InfoRow label="Ngày sinh" value={fmtDate(detail.dateOfBirth)} />
              <InfoRow label="Giới tính" value={detail.gender && GENDER_LABEL[detail.gender]} />
              <InfoRow label="Tình trạng hôn nhân" value={detail.maritalStatus && MARITAL_LABEL[detail.maritalStatus]} />
              <InfoRow label="Quốc tịch" value={detail.nationality} />
              <InfoRow label="Địa chỉ" value={address} />
              {detail.contactHiddenByCandidate && (
                <div className="sm:col-span-2 mt-1 rounded-lg bg-warning-tint text-warning text-[11px] font-semibold px-3 py-2">
                  Ứng viên đã bật &quot;Ẩn thông tin liên hệ&quot; — điện thoại/email/địa chỉ vẫn được giữ kín kể cả
                  khi bạn đã mở hồ sơ. Đây là lựa chọn riêng tư của ứng viên, không phải thứ mua được.
                </div>
              )}
            </div>
          )}
        </div>

        {detail.careerObjective && (
          <Section title="Mục tiêu nghề nghiệp">
            <p className="text-[12.5px] text-ink-muted leading-relaxed whitespace-pre-line">{detail.careerObjective}</p>
          </Section>
        )}

        <Section title="Công việc mong muốn">
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
            <InfoRow label="Vị trí" value={detail.desiredPosition} />
            <InfoRow label="Cấp bậc" value={detail.desiredLevel} />
            <InfoRow label="Mức lương" value={fmtSalary(detail.desiredSalaryMin, detail.desiredSalaryMax, detail.salaryCurrency)} />
            <InfoRow label="Số năm kinh nghiệm" value={detail.yearsOfExperience != null ? `${detail.yearsOfExperience} năm` : undefined} />
            <InfoRow label="Bằng cấp cao nhất" value={detail.highestDegree} />
            <InfoRow label="Cấp bậc hiện tại" value={detail.currentLevel} />
            <InfoRow label="Ngành nghề mong muốn" value={detail.desiredIndustries?.join(', ')} />
            <InfoRow label="Nơi làm việc mong muốn" value={detail.desiredLocations?.join(', ')} />
            <InfoRow label="Hình thức làm việc" value={detail.desiredJobTypes?.join(', ')} />
          </div>
        </Section>

        {detail.experiences.length > 0 && (
          <Section title="Kinh nghiệm làm việc">
            <div className="flex flex-col gap-3">
              {detail.experiences.map((e) => (
                <div key={e.id} className="border-b border-border/60 pb-2.5 last:border-0 last:pb-0">
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-bold text-[13px] text-ink">{e.position}</span>
                    <span className="text-[11px] text-ink-faint shrink-0">{fmtRange(e.startDate, e.endDate, e.isCurrent)}</span>
                  </div>
                  {e.companyName && <div className="text-[12px] text-primary font-semibold">{e.companyName}</div>}
                  {e.description && <p className="text-[12px] text-ink-muted mt-0.5 whitespace-pre-line">{e.description}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {detail.educations.length > 0 && (
          <Section title="Học vấn">
            <div className="flex flex-col gap-2.5">
              {detail.educations.map((e) => (
                <div key={e.id}>
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-bold text-[13px] text-ink">{e.schoolName}</span>
                    <span className="text-[11px] text-ink-faint shrink-0">{fmtRange(e.startDate, e.endDate)}</span>
                  </div>
                  {(e.degree || e.major) && (
                    <div className="text-[12px] text-ink-muted">{[e.degree, e.major].filter(Boolean).join(' · ')}</div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {detail.skills.length > 0 && (
          <Section title="Kỹ năng">
            <div className="flex flex-wrap gap-1.5">
              {detail.skills.map((s) => (
                <span key={s.id} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-alt text-ink-muted">
                  {s.skillName} · {SKILL_LEVEL_LABEL[s.level] ?? s.level}
                </span>
              ))}
            </div>
          </Section>
        )}

        {detail.languages.length > 0 && (
          <Section title="Ngoại ngữ">
            <div className="flex flex-wrap gap-1.5">
              {detail.languages.map((l) => (
                <span key={l.id} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-info-tint text-info">
                  {l.language} · {LANGUAGE_LEVEL_LABEL[l.level] ?? l.level}
                </span>
              ))}
            </div>
          </Section>
        )}

        {detail.certificates.length > 0 && (
          <Section title="Chứng chỉ">
            <div className="flex flex-col gap-2">
              {detail.certificates.map((c) => (
                <div key={c.id} className="text-[12.5px]">
                  <span className="font-semibold text-ink">{c.name}</span>
                  <span className="text-ink-faint"> — {[c.issuer, fmtDate(c.issueDate)].filter(Boolean).join(' · ')}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {detail.achievements.length > 0 && (
          <Section title="Thành tích & giải thưởng">
            <div className="flex flex-col gap-2.5">
              {detail.achievements.map((a) => (
                <div key={a.id}>
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-bold text-[12.5px] text-ink">{a.title}</span>
                    {a.date && <span className="text-[11px] text-ink-faint shrink-0">{fmtDate(a.date)}</span>}
                  </div>
                  {a.description && <p className="text-[12px] text-ink-muted mt-0.5">{a.description}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {detail.activities.length > 0 && (
          <Section title="Hoạt động ngoại khóa">
            <div className="flex flex-col gap-2.5">
              {detail.activities.map((a) => (
                <div key={a.id}>
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-bold text-[12.5px] text-ink">{a.title}</span>
                    <span className="text-[11px] text-ink-faint shrink-0">{fmtRange(a.startDate, a.endDate)}</span>
                  </div>
                  {a.organizationName && <div className="text-[12px] text-primary font-semibold">{a.organizationName}</div>}
                  {a.description && <p className="text-[12px] text-ink-muted mt-0.5">{a.description}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-white p-5">
      <h2 className="text-sm font-extrabold text-ink mb-3">{title}</h2>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 py-1">
      <span className="w-[150px] shrink-0 font-semibold text-ink">{label}</span>
      <span className="text-ink-muted">{value || <span className="text-ink-faint">Chưa cập nhật</span>}</span>
    </div>
  );
}
