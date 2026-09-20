'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { useAuth } from '@/lib/auth-context';
import {
  ApiError,
  profileApi,
  type ActivityItem,
  type AchievementItem,
  type CertificateItem,
  type EducationItem,
  type ExperienceItem,
  type FullProfile,
  type FullProfileResponse,
  type LanguageItem,
  type ReferenceItem,
  type SectionKey,
  type SkillItem,
} from '@/lib/api';
import {
  CheckboxRow,
  ChipsInput,
  EmptyBox,
  Field,
  GhostButton,
  InfoRow,
  ListRow,
  Modal,
  PrimaryButton,
  Select,
  StatusBadge,
  SectionCard,
  TextArea,
  TextInput,
} from '@/components/profile/ui';

// Đợt 8 — Hồ sơ trực tuyến 13 mục. Cuộn dài + mục lục bên phải (giống CareerViet); sửa từng mục
// mở trong popup gọn 1 khung hình (dung hòa với nguyên tắc "1 khung hình, hạn chế cuộn" của SRS).

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
const VISIBILITY_LABEL: Record<string, string> = { locked: 'Khóa', public: 'Công khai', urgent: 'Khẩn cấp' };

const TOC = [
  { id: 'muc-1', key: 'profileTitle', label: 'Tiêu đề hồ sơ' },
  { id: 'muc-2', key: 'avatar', label: 'Ảnh đại diện' },
  { id: 'muc-3', key: 'personalInfo', label: 'Thông tin cá nhân' },
  { id: 'muc-4', key: 'careerObjective', label: 'Mục tiêu nghề nghiệp' },
  { id: 'muc-5', key: 'careerInfo', label: 'Công việc mong muốn' },
  { id: 'muc-6', key: 'experiences', label: 'Kinh nghiệm làm việc' },
  { id: 'muc-7', key: 'educations', label: 'Học vấn' },
  { id: 'muc-8', key: 'certificates', label: 'Chứng chỉ' },
  { id: 'muc-9', key: 'languages', label: 'Ngoại ngữ' },
  { id: 'muc-10', key: 'skills', label: 'Kỹ năng chuyên môn' },
  { id: 'muc-11', key: 'achievements', label: 'Thành tích' },
  { id: 'muc-12', key: 'activities', label: 'Hoạt động' },
  { id: 'muc-13', key: 'references', label: 'Người tham khảo' },
] as const;

const REQUIRED_KEYS = ['profileTitle', 'personalInfo', 'careerInfo', 'experiences', 'educations', 'skills'];

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

type ModalState =
  | null
  | { type: 'profileTitle' }
  | { type: 'avatar' }
  | { type: 'personalInfo' }
  | { type: 'careerObjective' }
  | { type: 'careerInfo' }
  | { type: SectionKey; mode: 'add' }
  | { type: SectionKey; mode: 'edit'; item: any };

export default function OnlineProfilePage() {
  const { me, token } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<FullProfileResponse | null>(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await profileApi.getFull(token);
      setData(res);
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tải được hồ sơ');
    } finally {
      loadedOnce.current = true;
    }
  }, [token]);

  useEffect(() => {
    if (me === undefined) return;
    if (me === null) {
      router.replace('/dang-nhap');
      return;
    }
    if (me.role !== 'candidate') {
      router.replace('/');
      return;
    }
    load();
  }, [me, router, load]);

  async function quickUpdate(patch: Record<string, unknown>) {
    if (!token) return;
    await profileApi.updateQuick(token, patch);
    await load();
  }

  if (error) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center text-critical">{error}</main>
      </>
    );
  }
  if (!data && !loadedOnce.current) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center text-ink-muted">Đang tải hồ sơ…</main>
      </>
    );
  }
  if (!data) return null;

  const { profile, sections, status } = data;
  const requiredDone = REQUIRED_KEYS.filter((k) => status[k] === 'completed').length;

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-bg pb-20">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-4 py-6 lg:grid-cols-[1fr_260px]">
          <div className="flex flex-col gap-4">
            {/* Thẻ tổng quan */}
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start gap-4">
                <div className="relative">
                  <div className="h-16 w-16 overflow-hidden rounded-full bg-primary-tint">
                    {profile.avatarMimeType ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profileApi.avatarUrl(profile.id)} alt="Ảnh đại diện" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-bold text-primary">
                        {profile.fullName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'avatar' })}
                    className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white"
                  >
                    Sửa
                  </button>
                </div>
                <div className="min-w-[200px] flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-extrabold text-ink">{profile.profileTitle || profile.fullName}</h1>
                    <button type="button" onClick={() => setModal({ type: 'profileTitle' })} className="text-xs font-semibold text-primary hover:underline">
                      Sửa
                    </button>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {[profile.desiredPosition, profile.currentLevel, profile.province].filter(Boolean).join(' · ') || 'Chưa cập nhật thông tin'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                    <label className="flex items-center gap-1.5 font-semibold text-ink-muted">
                      Chế độ hiển thị:
                      <select
                        value={profile.visibility}
                        onChange={(e) => quickUpdate({ visibility: e.target.value })}
                        className="rounded-md border border-border-strong px-1.5 py-0.5 text-[11px] font-bold text-ink"
                      >
                        {Object.entries(VISIBILITY_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <CheckboxRow
                      label="Nhận thông báo việc làm"
                      checked={profile.allowJobNotifications}
                      onChange={(v) => quickUpdate({ allowJobNotifications: v })}
                    />
                    <CheckboxRow
                      label="Ẩn thông tin liên hệ với NTD"
                      checked={profile.hideContactInfo}
                      onChange={(v) => profileApi.updatePersonal(token!, { hideContactInfo: v } as any).then(load)}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-ink-muted">
                  <span>Mức độ hoàn thành hồ sơ</span>
                  <span>{profile.completionPercent}%</span>
                </div>
                <div className="flex gap-1">
                  {REQUIRED_KEYS.map((k) => (
                    <div key={k} className={`h-1.5 flex-1 rounded-full ${status[k] === 'completed' ? 'bg-success' : 'bg-border'}`} />
                  ))}
                </div>
                {requiredDone < REQUIRED_KEYS.length && (
                  <p className="mt-1.5 text-[11px] text-warning">Còn {REQUIRED_KEYS.length - requiredDone} mục bắt buộc chưa hoàn thành.</p>
                )}
              </div>
            </section>

            <SectionCard id="muc-4" title="Mục tiêu nghề nghiệp" status={status.careerObjective} onEdit={() => setModal({ type: 'careerObjective' })}>
              {profile.careerObjective ? (
                <p className="whitespace-pre-line text-sm text-ink-muted">{profile.careerObjective}</p>
              ) : (
                <EmptyBox text="Chưa có mục tiêu nghề nghiệp" />
              )}
            </SectionCard>

            <SectionCard
              id="muc-3"
              title="Thông tin cá nhân"
              status={status.personalInfo}
              tip="Điền đầy đủ họ tên, ngày sinh, điện thoại để nhà tuyển dụng liên hệ nhanh hơn."
              onEdit={() => setModal({ type: 'personalInfo' })}
            >
              <InfoRow label="Họ và tên" value={[profile.lastName, profile.firstName].filter(Boolean).join(' ') || profile.fullName} />
              <InfoRow label="Ngày sinh" value={fmtDate(profile.dateOfBirth)} />
              <InfoRow label="Giới tính" value={profile.gender && GENDER_LABEL[profile.gender]} />
              <InfoRow label="Điện thoại" value={profile.phone} />
              <InfoRow label="Email liên hệ" value={profile.contactEmail} />
              <InfoRow label="Quốc tịch" value={profile.nationality} />
              <InfoRow label="Tình trạng hôn nhân" value={profile.maritalStatus && MARITAL_LABEL[profile.maritalStatus]} />
              <InfoRow label="Địa chỉ" value={[profile.address, profile.district, profile.province, profile.country].filter(Boolean).join(', ')} />
            </SectionCard>

            <SectionCard
              id="muc-5"
              title="Công việc mong muốn"
              status={status.careerInfo}
              onEdit={() => setModal({ type: 'careerInfo' })}
            >
              <InfoRow label="Vị trí mong muốn" value={profile.desiredPosition} />
              <InfoRow label="Cấp bậc mong muốn" value={profile.desiredLevel} />
              <InfoRow
                label="Mức lương mong muốn"
                value={
                  profile.desiredSalaryMin || profile.desiredSalaryMax
                    ? `${profile.desiredSalaryMin ?? '?'} – ${profile.desiredSalaryMax ?? '?'} ${profile.salaryCurrency ?? 'VND'}`
                    : undefined
                }
              />
              <InfoRow label="Ngành nghề mong muốn" value={profile.desiredIndustries?.join(', ')} />
              <InfoRow label="Nơi làm việc mong muốn" value={profile.desiredLocations?.join(', ')} />
              <InfoRow label="Hình thức làm việc" value={profile.desiredJobTypes?.join(', ')} />
              <InfoRow label="Số năm kinh nghiệm" value={profile.yearsOfExperience != null ? `${profile.yearsOfExperience} năm` : undefined} />
              <InfoRow label="Cấp bậc hiện tại" value={profile.currentLevel} />
              <InfoRow label="Bằng cấp cao nhất" value={profile.highestDegree} />
            </SectionCard>

            <SectionCard
              id="muc-6"
              title="Kinh nghiệm làm việc"
              status={status.experiences}
              tip="Liệt kê theo thứ tự gần nhất trước, mô tả kết quả cụ thể thay vì chỉ liệt kê nhiệm vụ."
              onEdit={() => setModal({ type: 'experiences', mode: 'add' })}
              editLabel="+ Thêm"
            >
              {sections.experiences.length === 0 && <EmptyBox text="Chưa có kinh nghiệm làm việc" />}
              {sections.experiences.map((it) => (
                <ListRow
                  key={it.id}
                  title={it.position}
                  subtitle={it.companyName}
                  meta={fmtRange(it.startDate, it.endDate, it.isCurrent)}
                  onEdit={() => setModal({ type: 'experiences', mode: 'edit', item: it })}
                  onRemove={() => removeItem('experiences', it.id)}
                />
              ))}
            </SectionCard>

            <SectionCard
              id="muc-7"
              title="Học vấn"
              status={status.educations}
              onEdit={() => setModal({ type: 'educations', mode: 'add' })}
              editLabel="+ Thêm"
            >
              {sections.educations.length === 0 && <EmptyBox text="Chưa có thông tin học vấn" />}
              {sections.educations.map((it) => (
                <ListRow
                  key={it.id}
                  title={it.schoolName || '(Chưa nhập tên trường)'}
                  subtitle={[it.degree, it.major].filter(Boolean).join(' – ')}
                  meta={fmtRange(it.startDate, it.endDate)}
                  onEdit={() => setModal({ type: 'educations', mode: 'edit', item: it })}
                  onRemove={() => removeItem('educations', it.id)}
                />
              ))}
            </SectionCard>

            <SectionCard
              id="muc-8"
              title="Chứng chỉ"
              status={status.certificates}
              onEdit={() => setModal({ type: 'certificates', mode: 'add' })}
              editLabel="+ Thêm"
            >
              {sections.certificates.length === 0 && <EmptyBox text="Chưa có chứng chỉ" />}
              {sections.certificates.map((it) => (
                <ListRow
                  key={it.id}
                  title={it.name}
                  subtitle={it.issuer}
                  meta={fmtDate(it.issueDate)}
                  onEdit={() => setModal({ type: 'certificates', mode: 'edit', item: it })}
                  onRemove={() => removeItem('certificates', it.id)}
                />
              ))}
            </SectionCard>

            <SectionCard
              id="muc-9"
              title="Ngoại ngữ"
              status={status.languages}
              onEdit={() => setModal({ type: 'languages', mode: 'add' })}
              editLabel="+ Thêm"
            >
              {sections.languages.length === 0 && <EmptyBox text="Chưa có ngoại ngữ" />}
              {sections.languages.map((it) => (
                <ListRow
                  key={it.id}
                  title={it.language}
                  subtitle={LANGUAGE_LEVEL_LABEL[it.level]}
                  onEdit={() => setModal({ type: 'languages', mode: 'edit', item: it })}
                  onRemove={() => removeItem('languages', it.id)}
                />
              ))}
            </SectionCard>

            <SectionCard
              id="muc-10"
              title="Kỹ năng chuyên môn"
              status={status.skills}
              onEdit={() => setModal({ type: 'skills', mode: 'add' })}
              editLabel="+ Thêm"
            >
              {sections.skills.length === 0 && <EmptyBox text="Chưa có kỹ năng" />}
              <div className="flex flex-wrap gap-2">
                {sections.skills.map((it) => (
                  <span key={it.id} className="group inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1.5 text-xs font-semibold text-primary">
                    {it.skillName} · {SKILL_LEVEL_LABEL[it.level]}
                    <button type="button" onClick={() => setModal({ type: 'skills', mode: 'edit', item: it })} className="text-primary/70 hover:text-primary">
                      ✎
                    </button>
                    <button type="button" onClick={() => removeItem('skills', it.id)} className="text-primary/70 hover:text-critical">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              id="muc-11"
              title="Thành tích"
              status={status.achievements}
              onEdit={() => setModal({ type: 'achievements', mode: 'add' })}
              editLabel="+ Thêm"
            >
              {sections.achievements.length === 0 && <EmptyBox text="Chưa có thành tích" />}
              {sections.achievements.map((it) => (
                <ListRow
                  key={it.id}
                  title={it.title}
                  subtitle={it.description}
                  meta={fmtDate(it.date)}
                  onEdit={() => setModal({ type: 'achievements', mode: 'edit', item: it })}
                  onRemove={() => removeItem('achievements', it.id)}
                />
              ))}
            </SectionCard>

            <SectionCard
              id="muc-12"
              title="Hoạt động"
              status={status.activities}
              onEdit={() => setModal({ type: 'activities', mode: 'add' })}
              editLabel="+ Thêm"
            >
              {sections.activities.length === 0 && <EmptyBox text="Chưa có hoạt động" />}
              {sections.activities.map((it) => (
                <ListRow
                  key={it.id}
                  title={it.title}
                  subtitle={it.organizationName}
                  meta={fmtRange(it.startDate, it.endDate)}
                  onEdit={() => setModal({ type: 'activities', mode: 'edit', item: it })}
                  onRemove={() => removeItem('activities', it.id)}
                />
              ))}
            </SectionCard>

            <SectionCard
              id="muc-13"
              title="Người tham khảo"
              status={status.references}
              onEdit={() => setModal({ type: 'references', mode: 'add' })}
              editLabel="+ Thêm"
            >
              {sections.references.length === 0 && <EmptyBox text="Chưa có người tham khảo" />}
              {sections.references.map((it) => (
                <ListRow
                  key={it.id}
                  title={it.fullName}
                  subtitle={[it.position, it.company].filter(Boolean).join(' – ')}
                  meta={[it.phone, it.email].filter(Boolean).join(' · ')}
                  onEdit={() => setModal({ type: 'references', mode: 'edit', item: it })}
                  onRemove={() => removeItem('references', it.id)}
                />
              ))}
            </SectionCard>
          </div>

          {/* Mục lục bên phải */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 rounded-2xl border border-border bg-white p-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-primary">Mục lục hồ sơ</div>
              <nav className="flex flex-col gap-1">
                {TOC.map((t) => (
                  <a key={t.id} href={`#${t.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-ink-muted hover:bg-surface-alt">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        status[t.key] === 'completed' ? 'bg-success' : status[t.key] === 'optional' ? 'bg-border-strong' : 'bg-warning'
                      }`}
                    />
                    {t.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        </div>
      </main>

      {modal && (
        <ProfileModals
          modal={modal}
          profile={profile}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await load();
          }}
        />
      )}
    </>
  );

  async function removeItem(section: SectionKey, id: string) {
    if (!token) return;
    if (!window.confirm('Bạn chắc chắn muốn xóa mục này?')) return;
    await profileApi.removeItem(token, section, id);
    await load();
  }
}

// ================= Popup sửa từng mục =================

function ProfileModals({
  modal,
  profile,
  onClose,
  onSaved,
}: {
  modal: NonNullable<ModalState>;
  profile: FullProfile;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { token } = useAuth();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const isEdit = 'mode' in modal && modal.mode === 'edit';
  const initialItem = isEdit ? (modal as any).item : {};
  const [form, setForm] = useState<Record<string, any>>(() => buildInitialForm(modal, profile));

  function set(k: string, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!token) return;
    setSaving(true);
    setErr('');
    try {
      switch (modal.type) {
        case 'profileTitle':
          await profileApi.updatePersonal(token, { profileTitle: form.profileTitle });
          break;
        case 'personalInfo':
          await profileApi.updatePersonal(token, form as any);
          break;
        case 'careerObjective':
          await profileApi.updateCareer(token, { careerObjective: form.careerObjective });
          break;
        case 'careerInfo':
          await profileApi.updateCareer(token, form as any);
          break;
        case 'avatar':
          if (form.file) await profileApi.uploadAvatar(token, form.file);
          break;
        default: {
          const section = modal.type as SectionKey;
          if (isEdit) await profileApi.updateItem(token, section, initialItem.id, form);
          else await profileApi.addItem(token, section, form);
        }
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Không lưu được, vui lòng thử lại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={modalTitle(modal)} onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        {err && <div className="rounded-lg bg-critical-tint px-3 py-2 text-xs text-critical">{err}</div>}
        {renderFields(modal, form, set)}
        <div className="mt-2 flex justify-end gap-2 border-t border-border pt-3.5">
          <GhostButton onClick={onClose}>Hủy</GhostButton>
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

function modalTitle(modal: NonNullable<ModalState>): string {
  const labels: Record<string, string> = {
    profileTitle: 'Sửa tiêu đề hồ sơ',
    avatar: 'Cập nhật ảnh đại diện',
    personalInfo: 'Sửa thông tin cá nhân',
    careerObjective: 'Sửa mục tiêu nghề nghiệp',
    careerInfo: 'Sửa công việc mong muốn',
    experiences: 'Kinh nghiệm làm việc',
    educations: 'Học vấn',
    certificates: 'Chứng chỉ',
    languages: 'Ngoại ngữ',
    skills: 'Kỹ năng chuyên môn',
    achievements: 'Thành tích',
    activities: 'Hoạt động',
    references: 'Người tham khảo',
  };
  const base = labels[modal.type] ?? modal.type;
  if ('mode' in modal) return `${base} — ${modal.mode === 'add' ? 'Thêm mới' : 'Chỉnh sửa'}`;
  return base;
}

function buildInitialForm(modal: NonNullable<ModalState>, profile: FullProfile): Record<string, any> {
  if (modal.type === 'profileTitle') return { profileTitle: profile.profileTitle ?? '' };
  if (modal.type === 'personalInfo') {
    return {
      lastName: profile.lastName ?? '',
      firstName: profile.firstName ?? '',
      dateOfBirth: profile.dateOfBirth ?? '',
      gender: profile.gender ?? '',
      phone: profile.phone ?? '',
      contactEmail: profile.contactEmail ?? '',
      nationality: profile.nationality ?? '',
      maritalStatus: profile.maritalStatus ?? '',
      country: profile.country ?? '',
      province: profile.province ?? '',
      district: profile.district ?? '',
      address: profile.address ?? '',
    };
  }
  if (modal.type === 'careerObjective') return { careerObjective: profile.careerObjective ?? '' };
  if (modal.type === 'careerInfo') {
    return {
      desiredPosition: profile.desiredPosition ?? '',
      desiredLevel: profile.desiredLevel ?? '',
      desiredSalaryMin: profile.desiredSalaryMin ?? '',
      desiredSalaryMax: profile.desiredSalaryMax ?? '',
      salaryCurrency: profile.salaryCurrency ?? 'VND',
      desiredIndustries: profile.desiredIndustries ?? [],
      desiredLocations: profile.desiredLocations ?? [],
      desiredJobTypes: profile.desiredJobTypes ?? [],
      yearsOfExperience: profile.yearsOfExperience ?? '',
      currentLevel: profile.currentLevel ?? '',
      highestDegree: profile.highestDegree ?? '',
    };
  }
  if (modal.type === 'avatar') return {};
  if ('mode' in modal && modal.mode === 'edit') return { ...modal.item };
  // add mode — giá trị khởi tạo theo từng loại mục
  switch (modal.type) {
    case 'experiences':
      return { position: '', companyName: '', startDate: '', endDate: '', isCurrent: false, description: '' };
    case 'educations':
      return { schoolName: '', degree: '', major: '', startDate: '', endDate: '' };
    case 'certificates':
      return { name: '', issuer: '', issueDate: '' };
    case 'languages':
      return { language: '', level: 'good' };
    case 'skills':
      return { skillName: '', level: 'intermediate' };
    case 'achievements':
      return { title: '', description: '', date: '' };
    case 'activities':
      return { title: '', organizationName: '', startDate: '', endDate: '', description: '' };
    case 'references':
      return { fullName: '', position: '', company: '', phone: '', email: '' };
    default:
      return {};
  }
}

function renderFields(modal: NonNullable<ModalState>, form: Record<string, any>, set: (k: string, v: any) => void) {
  switch (modal.type) {
    case 'profileTitle':
      return (
        <Field label="Tiêu đề hồ sơ" htmlFor="f-profileTitle" hint="VD: Trưởng nhóm Kinh doanh B2B 5 năm kinh nghiệm">
          <TextInput id="f-profileTitle" value={form.profileTitle} onChange={(e) => set('profileTitle', e.target.value)} />
        </Field>
      );
    case 'avatar':
      return (
        <Field label="Chọn ảnh đại diện" htmlFor="f-avatar" hint="tối đa 1MB">
          <input id="f-avatar" type="file" accept="image/*" onChange={(e) => set('file', e.target.files?.[0])} />
        </Field>
      );
    case 'personalInfo':
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Họ" htmlFor="f-lastName">
            <TextInput id="f-lastName" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
          </Field>
          <Field label="Tên" htmlFor="f-firstName">
            <TextInput id="f-firstName" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </Field>
          <Field label="Ngày sinh" htmlFor="f-dob">
            <TextInput id="f-dob" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
          </Field>
          <Field label="Giới tính" htmlFor="f-gender">
            <Select id="f-gender" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">— Chọn —</option>
              {Object.entries(GENDER_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Điện thoại" htmlFor="f-phone">
            <TextInput id="f-phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Email liên hệ" htmlFor="f-cemail">
            <TextInput id="f-cemail" type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
          </Field>
          <Field label="Quốc tịch" htmlFor="f-nat">
            <TextInput id="f-nat" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
          </Field>
          <Field label="Tình trạng hôn nhân" htmlFor="f-marital">
            <Select id="f-marital" value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}>
              <option value="">— Chọn —</option>
              {Object.entries(MARITAL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quốc gia" htmlFor="f-country">
            <TextInput id="f-country" value={form.country} onChange={(e) => set('country', e.target.value)} />
          </Field>
          <Field label="Tỉnh/Thành phố" htmlFor="f-province">
            <TextInput id="f-province" value={form.province} onChange={(e) => set('province', e.target.value)} />
          </Field>
          <Field label="Quận/Huyện" htmlFor="f-district">
            <TextInput id="f-district" value={form.district} onChange={(e) => set('district', e.target.value)} />
          </Field>
          <Field label="Địa chỉ" htmlFor="f-address">
            <TextInput id="f-address" value={form.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
        </div>
      );
    case 'careerObjective':
      return (
        <Field label="Mục tiêu nghề nghiệp" htmlFor="f-objective">
          <TextArea id="f-objective" value={form.careerObjective} onChange={(e) => set('careerObjective', e.target.value)} />
        </Field>
      );
    case 'careerInfo':
      return (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vị trí mong muốn" htmlFor="f-dpos">
              <TextInput id="f-dpos" value={form.desiredPosition} onChange={(e) => set('desiredPosition', e.target.value)} />
            </Field>
            <Field label="Cấp bậc mong muốn" htmlFor="f-dlevel">
              <TextInput id="f-dlevel" value={form.desiredLevel} onChange={(e) => set('desiredLevel', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Lương từ" htmlFor="f-smin">
              <TextInput id="f-smin" type="number" value={form.desiredSalaryMin} onChange={(e) => set('desiredSalaryMin', e.target.value)} />
            </Field>
            <Field label="Lương đến" htmlFor="f-smax">
              <TextInput id="f-smax" type="number" value={form.desiredSalaryMax} onChange={(e) => set('desiredSalaryMax', e.target.value)} />
            </Field>
            <Field label="Đơn vị tiền tệ" htmlFor="f-cur">
              <Select id="f-cur" value={form.salaryCurrency} onChange={(e) => set('salaryCurrency', e.target.value)}>
                <option value="VND">VND</option>
                <option value="USD">USD</option>
              </Select>
            </Field>
          </div>
          <Field label="Ngành nghề mong muốn" htmlFor="f-industries">
            <ChipsInput inputId="f-industries" value={form.desiredIndustries} onChange={(v) => set('desiredIndustries', v)} placeholder="Nhập rồi Enter" />
          </Field>
          <Field label="Nơi làm việc mong muốn" htmlFor="f-locations">
            <ChipsInput inputId="f-locations" value={form.desiredLocations} onChange={(v) => set('desiredLocations', v)} placeholder="Nhập rồi Enter" />
          </Field>
          <Field label="Hình thức làm việc" htmlFor="f-jobtypes">
            <ChipsInput inputId="f-jobtypes" value={form.desiredJobTypes} onChange={(v) => set('desiredJobTypes', v)} placeholder="Nhập rồi Enter" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Số năm kinh nghiệm" htmlFor="f-years">
              <TextInput id="f-years" type="number" value={form.yearsOfExperience} onChange={(e) => set('yearsOfExperience', e.target.value)} />
            </Field>
            <Field label="Cấp bậc hiện tại" htmlFor="f-curlevel">
              <TextInput id="f-curlevel" value={form.currentLevel} onChange={(e) => set('currentLevel', e.target.value)} />
            </Field>
            <Field label="Bằng cấp cao nhất" htmlFor="f-degree">
              <TextInput id="f-degree" value={form.highestDegree} onChange={(e) => set('highestDegree', e.target.value)} />
            </Field>
          </div>
        </div>
      );
    case 'experiences':
      return (
        <div className="flex flex-col gap-3">
          <Field label="Chức danh" htmlFor="f-position">
            <TextInput id="f-position" value={form.position} onChange={(e) => set('position', e.target.value)} />
          </Field>
          <Field label="Tên công ty" htmlFor="f-company">
            <TextInput id="f-company" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Từ ngày" htmlFor="f-start">
              <TextInput id="f-start" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </Field>
            <Field label="Đến ngày" htmlFor="f-end">
              <TextInput id="f-end" type="date" disabled={form.isCurrent} value={form.isCurrent ? '' : form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </Field>
          </div>
          <CheckboxRow label="Tôi đang làm việc ở đây" checked={!!form.isCurrent} onChange={(v) => set('isCurrent', v)} />
          <Field label="Mô tả công việc" htmlFor="f-desc">
            <TextArea id="f-desc" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
      );
    case 'educations':
      return (
        <div className="flex flex-col gap-3">
          <Field label="Tên trường" htmlFor="f-school">
            <TextInput id="f-school" value={form.schoolName} onChange={(e) => set('schoolName', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bằng cấp" htmlFor="f-degree2">
              <TextInput id="f-degree2" value={form.degree} onChange={(e) => set('degree', e.target.value)} />
            </Field>
            <Field label="Chuyên ngành" htmlFor="f-major">
              <TextInput id="f-major" value={form.major} onChange={(e) => set('major', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Từ ngày" htmlFor="f-estart">
              <TextInput id="f-estart" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </Field>
            <Field label="Đến ngày" htmlFor="f-eend">
              <TextInput id="f-eend" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </Field>
          </div>
        </div>
      );
    case 'certificates':
      return (
        <div className="flex flex-col gap-3">
          <Field label="Tên chứng chỉ" htmlFor="f-cname">
            <TextInput id="f-cname" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Tổ chức cấp" htmlFor="f-issuer">
            <TextInput id="f-issuer" value={form.issuer} onChange={(e) => set('issuer', e.target.value)} />
          </Field>
          <Field label="Ngày cấp" htmlFor="f-issuedate">
            <TextInput id="f-issuedate" type="date" value={form.issueDate} onChange={(e) => set('issueDate', e.target.value)} />
          </Field>
        </div>
      );
    case 'languages':
      return (
        <div className="flex flex-col gap-3">
          <Field label="Ngôn ngữ" htmlFor="f-lang">
            <TextInput id="f-lang" value={form.language} onChange={(e) => set('language', e.target.value)} />
          </Field>
          <Field label="Trình độ" htmlFor="f-langlevel">
            <Select id="f-langlevel" value={form.level} onChange={(e) => set('level', e.target.value)}>
              {Object.entries(LANGUAGE_LEVEL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      );
    case 'skills':
      return (
        <div className="flex flex-col gap-3">
          <Field label="Tên kỹ năng" htmlFor="f-skillname">
            <TextInput id="f-skillname" value={form.skillName} onChange={(e) => set('skillName', e.target.value)} />
          </Field>
          <Field label="Mức độ" htmlFor="f-skilllevel">
            <Select id="f-skilllevel" value={form.level} onChange={(e) => set('level', e.target.value)}>
              {Object.entries(SKILL_LEVEL_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      );
    case 'achievements':
      return (
        <div className="flex flex-col gap-3">
          <Field label="Tên thành tích" htmlFor="f-atitle">
            <TextInput id="f-atitle" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Mô tả" htmlFor="f-adesc">
            <TextArea id="f-adesc" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Field label="Ngày đạt được" htmlFor="f-adate">
            <TextInput id="f-adate" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
        </div>
      );
    case 'activities':
      return (
        <div className="flex flex-col gap-3">
          <Field label="Tên hoạt động" htmlFor="f-acttitle">
            <TextInput id="f-acttitle" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Tổ chức" htmlFor="f-actorg">
            <TextInput id="f-actorg" value={form.organizationName} onChange={(e) => set('organizationName', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Từ ngày" htmlFor="f-actstart">
              <TextInput id="f-actstart" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </Field>
            <Field label="Đến ngày" htmlFor="f-actend">
              <TextInput id="f-actend" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </Field>
          </div>
          <Field label="Mô tả" htmlFor="f-actdesc">
            <TextArea id="f-actdesc" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
      );
    case 'references':
      return (
        <div className="flex flex-col gap-3">
          <Field label="Họ tên" htmlFor="f-refname">
            <TextInput id="f-refname" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Chức danh" htmlFor="f-refpos">
              <TextInput id="f-refpos" value={form.position} onChange={(e) => set('position', e.target.value)} />
            </Field>
            <Field label="Công ty" htmlFor="f-refcompany">
              <TextInput id="f-refcompany" value={form.company} onChange={(e) => set('company', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Điện thoại" htmlFor="f-refphone">
              <TextInput id="f-refphone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="f-refemail">
              <TextInput id="f-refemail" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
          </div>
        </div>
      );
    default:
      return null;
  }
}
