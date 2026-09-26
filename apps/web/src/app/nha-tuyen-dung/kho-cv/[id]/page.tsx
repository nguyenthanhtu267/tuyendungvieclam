'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import EmployerHeader from '@/components/EmployerHeader';
import { CvFileContent } from '@/components/cv/CvFileContent';
import { RichTextView } from '@/components/RichTextView';
import { useAuth } from '@/lib/auth-context';
import { cvArchiveApi, ApiError, type CvArchiveDetail, type CvArchiveSnapshot } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/format';

// Đợt 18a (26/09/2026) — chi tiết 1 người trong Kho CV: danh sách mọi lần ứng tuyển (mỗi lần có bản
// chụp hồ sơ CỐ ĐỊNH đúng lúc nộp + file CV riêng), chọn lần nào thì hiện đúng hồ sơ lúc đó theo bố
// cục 13 mục như trang Tìm CV. Không trừ điểm — đây là ứng viên đã tự gửi hồ sơ cho công ty.

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
  const [y, m, d] = v.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : v;
}
function fmtRange(s?: string | null, e?: string | null, current?: boolean) {
  const from = fmtDate(s);
  const to = current ? 'Hiện tại' : fmtDate(e);
  return [from, to].filter(Boolean).join(' – ');
}
function fmtSalary(min?: number | null, max?: number | null, currency?: string | null) {
  if (!min && !max) return 'Thoả thuận';
  const cur = currency === 'VND' || !currency ? 'triệu' : currency;
  if (min && max) return `${formatNumber(min)} – ${formatNumber(max)} ${cur}`;
  return `${formatNumber((min || max) as number)} ${cur}`;
}

export default function KhoCvDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { me, token } = useAuth();

  const [detail, setDetail] = useState<CvArchiveDetail | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && !me.role.startsWith('employer')) router.replace('/');
  }, [me, router]);

  const load = useCallback(async () => {
    if (!token || !params.id) return;
    try {
      const d = await cvArchiveApi.getDetail(token, params.id);
      setDetail(d);
      setSelectedEntryId((cur) => (cur && d.entries.some((e) => e.id === cur) ? cur : (d.entries[0]?.id ?? null)));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được hồ sơ');
    } finally {
      setLoading(false);
    }
  }, [token, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleTrash() {
    if (!token || !detail) return;
    setBusy(true);
    try {
      if (detail.inTrash) await cvArchiveApi.restore(token, detail.id);
      else await cvArchiveApi.trash(token, detail.id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Thao tác không thành công');
    } finally {
      setBusy(false);
    }
  }

  // Tệp CV trong kho cần đăng nhập mới tải được → mở tab trước (tránh bị chặn popup), tải Blob kèm
  // token rồi chuyển tab đó sang URL tạm của Blob.
  async function openFile(entryId: string) {
    if (!token) return;
    const tab = window.open('', '_blank');
    setOpeningFileId(entryId);
    try {
      const blob = await cvArchiveApi.downloadFile(token, entryId);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      tab?.close();
      setError(err instanceof ApiError ? err.message : 'Không mở được tệp CV');
    } finally {
      setOpeningFileId(null);
    }
  }

  if (!me || !me.role.startsWith('employer')) return null;

  if (loading) {
    return (
      <main className="min-h-screen bg-bg">
        <EmployerHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-ink-faint text-sm">Đang tải...</div>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="min-h-screen bg-bg">
        <EmployerHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <p className="text-critical text-sm font-semibold">{error ?? 'Không tìm thấy hồ sơ'}</p>
          <Link href="/nha-tuyen-dung/kho-cv" className="tvl-btn-ghost !w-auto px-4 mt-4 inline-block text-xs">
            ← Quay lại Kho CV
          </Link>
        </div>
      </main>
    );
  }

  const entry = detail.entries.find((e) => e.id === selectedEntryId) ?? detail.entries[0];
  const s = entry?.snapshot;

  return (
    <main className="min-h-screen bg-bg">
      <EmployerHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
        <Link href="/nha-tuyen-dung/kho-cv" className="text-xs font-semibold text-primary hover:underline w-fit">
          ← Quay lại Kho CV
        </Link>

        {error && <div className="rounded-lg bg-critical-tint text-critical text-xs font-semibold px-3.5 py-2.5">{error}</div>}

        <div className="rounded-xl border border-border bg-white p-5">
          <div className="flex gap-4 items-start flex-wrap">
            <div className="w-16 h-16 rounded-full bg-primary-tint text-primary flex items-center justify-center font-bold text-lg shrink-0">
              {detail.fullName
                .split(/\s+/)
                .filter(Boolean)
                .map((w) => w[0])
                .slice(-2)
                .join('')
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-extrabold text-ink">{detail.fullName}</h1>
                {detail.accountDeleted && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning-tint text-warning">
                    Tài khoản đã xoá
                  </span>
                )}
                {detail.inTrash && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-critical-tint text-critical">
                    Trong thùng rác
                  </span>
                )}
              </div>
              {detail.headline && <div className="text-primary font-bold text-[14px] mt-0.5">{detail.headline}</div>}
              <div className="text-[12.5px] text-ink-muted mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {detail.phone && (
                  <a href={`tel:${detail.phone}`} className="hover:text-primary">
                    📞 {detail.phone}
                  </a>
                )}
                {detail.email && (
                  <a href={`mailto:${detail.email}`} className="hover:text-primary">
                    ✉️ {detail.email}
                  </a>
                )}
                {detail.province && <span>📍 {detail.province}</span>}
              </div>
            </div>
            <button onClick={toggleTrash} disabled={busy} className="tvl-btn-ghost !w-auto px-4 text-xs shrink-0 disabled:opacity-50">
              {busy ? 'Đang xử lý…' : detail.inTrash ? 'Khôi phục về kho' : 'Đưa vào thùng rác'}
            </button>
          </div>
          {detail.accountDeleted && (
            <div className="mt-3 rounded-lg bg-warning-tint text-warning text-[11.5px] font-semibold px-3 py-2">
              Ứng viên này đã xoá tài khoản trên hệ thống. Toàn bộ hồ sơ và file CV họ từng gửi cho công ty bạn vẫn được lưu
              đầy đủ bên dưới.
            </div>
          )}
        </div>

        <Section title={`Các lần ứng tuyển (${formatNumber(detail.entries.length)})`}>
          <div className="flex flex-col gap-2">
            {detail.entries.map((e) => {
              const active = e.id === entry?.id;
              return (
                <div
                  key={e.id}
                  className={`rounded-lg border p-3 text-[12.5px] ${active ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <button onClick={() => setSelectedEntryId(e.id)} className="text-left flex-1 min-w-[180px]">
                      <div className="font-bold text-ink">{e.jobTitle}</div>
                      <div className="text-ink-faint text-[11.5px]">
                        {e.entrySource === 'employer_import' ? 'Nhập từ nguồn ngoài ngày' : 'Nộp ngày'} {formatDate(e.appliedAt)}
                      </div>
                    </button>
                    <div className="flex gap-2 flex-wrap items-center">
                      {e.cvHasFile && (
                        <button
                          onClick={() => openFile(e.id)}
                          disabled={openingFileId === e.id}
                          className="text-[11.5px] font-bold text-primary hover:underline disabled:opacity-50"
                        >
                          {openingFileId === e.id ? 'Đang mở…' : `📄 ${e.cvFileName || 'Xem file CV'}`}
                        </button>
                      )}
                      {e.cvExternalLink && (
                        <a
                          href={e.cvExternalLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11.5px] font-bold text-primary hover:underline"
                        >
                          🔗 Link CV
                        </a>
                      )}
                      {!active && (
                        <button onClick={() => setSelectedEntryId(e.id)} className="text-[11.5px] font-semibold text-ink-muted hover:text-primary">
                          Xem hồ sơ lần này →
                        </button>
                      )}
                    </div>
                  </div>
                  {e.coverLetter && <div className="text-ink-muted italic mt-1.5">&quot;{e.coverLetter}&quot;</div>}
                </div>
              );
            })}
          </div>
        </Section>

        {entry && <CvFileContent entry={entry} />}

        {s && entry && <SnapshotView s={s} appliedAt={entry.appliedAt} multiple={detail.entries.length > 1} />}
      </div>
    </main>
  );
}

function SnapshotView({ s, appliedAt, multiple }: { s: CvArchiveSnapshot; appliedAt: string; multiple: boolean }) {
  const address = [s.address, s.district, s.province, s.country].filter(Boolean).join(', ');
  return (
    <>
      <div className="text-[11.5px] text-ink-faint -mb-1">
        Hồ sơ đúng như lúc ứng viên nộp ngày <span className="font-semibold text-ink-muted">{formatDate(appliedAt)}</span>
        {multiple ? ' — chọn lần ứng tuyển khác ở trên để xem hồ sơ tương ứng.' : '.'}
      </div>

      <Section title="Thông tin cá nhân">
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
          <InfoRow label="Họ và tên" value={s.fullName} />
          <InfoRow label="Tiêu đề hồ sơ" value={s.profileTitle} />
          <InfoRow label="Điện thoại" value={s.phone} />
          <InfoRow label="Email liên hệ" value={s.contactEmail} />
          {s.accountEmail && s.accountEmail !== s.contactEmail && <InfoRow label="Email tài khoản" value={s.accountEmail} />}
          <InfoRow label="Ngày sinh" value={fmtDate(s.dateOfBirth)} />
          <InfoRow label="Giới tính" value={s.gender ? GENDER_LABEL[s.gender] ?? s.gender : undefined} />
          <InfoRow label="Tình trạng hôn nhân" value={s.maritalStatus ? MARITAL_LABEL[s.maritalStatus] ?? s.maritalStatus : undefined} />
          <InfoRow label="Quốc tịch" value={s.nationality} />
          <InfoRow label="Địa chỉ" value={address} />
        </div>
      </Section>

      {s.careerObjective && (
        <Section title="Mục tiêu nghề nghiệp">
          <RichTextView value={s.careerObjective} className="text-[12.5px] text-ink-muted" />
        </Section>
      )}

      <Section title="Công việc mong muốn">
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
          <InfoRow label="Vị trí" value={s.desiredPosition} />
          <InfoRow label="Cấp bậc" value={s.desiredLevel} />
          <InfoRow label="Mức lương" value={fmtSalary(s.desiredSalaryMin, s.desiredSalaryMax, s.salaryCurrency)} />
          <InfoRow
            label="Số năm kinh nghiệm"
            value={s.yearsOfExperience != null ? `${formatNumber(s.yearsOfExperience)} năm` : undefined}
          />
          <InfoRow label="Bằng cấp cao nhất" value={s.highestDegree} />
          <InfoRow label="Cấp bậc hiện tại" value={s.currentLevel} />
          <InfoRow label="Ngành nghề mong muốn" value={s.desiredIndustries?.join(', ')} />
          <InfoRow label="Nơi làm việc mong muốn" value={s.desiredLocations?.join(', ')} />
          <InfoRow label="Hình thức làm việc" value={s.desiredJobTypes?.join(', ')} />
        </div>
      </Section>

      {s.experiences.length > 0 && (
        <Section title="Kinh nghiệm làm việc">
          <div className="flex flex-col gap-3">
            {s.experiences.map((e, i) => (
              <div key={i} className="border-b border-border/60 pb-2.5 last:border-0 last:pb-0">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="font-bold text-[13px] text-ink">{e.position}</span>
                  <span className="text-[11px] text-ink-faint shrink-0">{fmtRange(e.startDate, e.endDate, e.isCurrent)}</span>
                </div>
                {e.companyName && <div className="text-[12px] text-primary font-semibold">{e.companyName}</div>}
                {e.description && <RichTextView value={e.description} className="text-[12px] text-ink-muted mt-0.5" />}
              </div>
            ))}
          </div>
        </Section>
      )}

      {s.educations.length > 0 && (
        <Section title="Học vấn">
          <div className="flex flex-col gap-2.5">
            {s.educations.map((e, i) => (
              <div key={i}>
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

      {s.skills.length > 0 && (
        <Section title="Kỹ năng">
          <div className="flex flex-wrap gap-1.5">
            {s.skills.map((k, i) => (
              <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-alt text-ink-muted">
                {k.skillName} · {SKILL_LEVEL_LABEL[k.level] ?? k.level}
              </span>
            ))}
          </div>
        </Section>
      )}

      {s.languages.length > 0 && (
        <Section title="Ngoại ngữ">
          <div className="flex flex-wrap gap-1.5">
            {s.languages.map((l, i) => (
              <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-info-tint text-info">
                {l.language} · {LANGUAGE_LEVEL_LABEL[l.level] ?? l.level}
              </span>
            ))}
          </div>
        </Section>
      )}

      {s.certificates.length > 0 && (
        <Section title="Chứng chỉ">
          <div className="flex flex-col gap-2">
            {s.certificates.map((c, i) => (
              <div key={i} className="text-[12.5px]">
                <span className="font-semibold text-ink">{c.name}</span>
                {(c.issuer || c.issueDate) && (
                  <span className="text-ink-faint"> — {[c.issuer, fmtDate(c.issueDate)].filter(Boolean).join(' · ')}</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {s.achievements.length > 0 && (
        <Section title="Thành tích & giải thưởng">
          <div className="flex flex-col gap-2.5">
            {s.achievements.map((a, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline gap-2">
                  <span className="font-bold text-[12.5px] text-ink">{a.title}</span>
                  {a.date && <span className="text-[11px] text-ink-faint shrink-0">{fmtDate(a.date)}</span>}
                </div>
                {a.description && <RichTextView value={a.description} className="text-[12px] text-ink-muted mt-0.5" />}
              </div>
            ))}
          </div>
        </Section>
      )}

      {s.activities.length > 0 && (
        <Section title="Hoạt động ngoại khóa">
          <div className="flex flex-col gap-2.5">
            {s.activities.map((a, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline gap-2">
                  <span className="font-bold text-[12.5px] text-ink">{a.title}</span>
                  <span className="text-[11px] text-ink-faint shrink-0">{fmtRange(a.startDate, a.endDate)}</span>
                </div>
                {a.organizationName && <div className="text-[12px] text-primary font-semibold">{a.organizationName}</div>}
                {a.description && <RichTextView value={a.description} className="text-[12px] text-ink-muted mt-0.5" />}
              </div>
            ))}
          </div>
        </Section>
      )}

      {s.references.length > 0 && (
        <Section title="Người tham khảo">
          <div className="flex flex-col gap-2">
            {s.references.map((r, i) => (
              <div key={i} className="text-[12.5px]">
                <span className="font-semibold text-ink">{r.fullName}</span>
                <span className="text-ink-faint">
                  {' '}
                  — {[r.position, r.company, r.phone, r.email].filter(Boolean).join(' · ')}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
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
