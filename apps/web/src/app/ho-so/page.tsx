'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { useAuth } from '@/lib/auth-context';
import {
  candidatesApi,
  applicationsApi,
  jobsApi,
  ApiError,
  type CandidateProfile,
  type CV,
  type SavedJob,
  type BlockedCompany,
  type Application,
  type JobPosting,
} from '@/lib/api';
import { APPLICATION_STATUS_CLASS, APPLICATION_STATUS_LABEL, formatDate, formatSalary } from '@/lib/format';

const NAV_ITEMS = [
  { id: 'overview', label: '👤 Quản lý hồ sơ' },
  { id: 'cvs', label: '📄 CV & tệp đính kèm' },
  { id: 'suggestions', label: '✨ Gợi ý việc làm' },
  { id: 'applications', label: '💼 Việc làm của tôi' },
  { id: 'settings', label: '⚙️ Cài đặt' },
];

export default function MyCenterPage() {
  const router = useRouter();
  const { me, token } = useAuth();

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [blocked, setBlocked] = useState<BlockedCompany[]>([]);
  const [suggestions, setSuggestions] = useState<JobPosting[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
  }, [me, router]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      try {
        const [p, sj, apps, bl] = await Promise.all([
          candidatesApi.getProfile(token),
          candidatesApi.listSavedJobs(token),
          applicationsApi.listOwn(token),
          candidatesApi.listBlockedCompanies(token),
        ]);
        setProfile(p);
        setSavedJobs(sj);
        setApplications(apps);
        setBlocked(bl);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!profile?.desiredPosition) {
      setSuggestions([]);
      return;
    }
    jobsApi
      .list({ q: profile.desiredPosition, pageSize: 3 })
      .then((res) => setSuggestions(res.items))
      .catch(() => setSuggestions([]));
  }, [profile?.desiredPosition]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (me === undefined || (me && loading && !profile)) {
    return (
      <main className="min-h-screen">
        <SiteHeader />
        <div className="max-w-6xl mx-auto px-4 py-16 text-center text-ink-faint text-sm">Đang tải...</div>
      </main>
    );
  }

  if (!me || !profile || !token) return null;

  return (
    <main className="min-h-screen">
      <SiteHeader />

      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-ink text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6">
        <div className="grid md:grid-cols-[210px_1fr] gap-5 items-start">
          <nav className="hidden md:flex flex-col gap-1 rounded-xl border border-border bg-white p-2.5 sticky top-20">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-left text-[12.5px] font-semibold px-3 py-2 rounded-lg hover:bg-surface-alt text-ink-muted hover:text-ink transition-colors"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex flex-col gap-4 min-w-0">
            <OverviewCard
              profile={profile}
              token={token}
              onUpdated={(p) => setProfile(p)}
              savedCount={savedJobs.length}
              appliedCount={applications.length}
              interviewCount={applications.filter((a) => a.status === 'interview').length}
            />

            <CvSection
              profile={profile}
              token={token}
              onChanged={(p) => setProfile(p)}
              onToast={showToast}
            />

            <div id="suggestions" className="rounded-xl border border-border bg-white p-[18px] scroll-mt-20">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-extrabold text-[15px]">Việc làm gợi ý cho bạn</h2>
                <span className="text-[11px] text-ink-faint">Theo vị trí mong muốn trong hồ sơ</span>
              </div>
              {!profile.desiredPosition && (
                <div className="text-[12.5px] text-ink-muted py-3">
                  Điền &ldquo;Vị trí mong muốn&rdquo; ở phần Quản lý hồ sơ để nhận gợi ý việc làm phù hợp.
                </div>
              )}
              {profile.desiredPosition && suggestions === null && (
                <div className="text-[12.5px] text-ink-faint py-3">Đang tải gợi ý...</div>
              )}
              {profile.desiredPosition && suggestions?.length === 0 && (
                <div className="text-[12.5px] text-ink-faint py-3">
                  Chưa có việc làm phù hợp với &ldquo;{profile.desiredPosition}&rdquo; lúc này.
                </div>
              )}
              <div className="flex flex-col">
                {suggestions?.map((job) => (
                  <div
                    key={job.id}
                    className="flex gap-3 items-center py-2.5 border-b border-border last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[12.8px] truncate">{job.title}</div>
                      <div className="text-ink-faint text-[11.3px] truncate">
                        {job.company.name} · {job.location} · {formatSalary(job.salaryMin, job.salaryMax)}
                      </div>
                    </div>
                    <Link href={`/viec-lam/${job.id}`} className="tvl-btn-ghost !w-auto px-3 py-1.5 text-xs shrink-0">
                      Xem
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div id="applications" className="grid lg:grid-cols-2 gap-4 scroll-mt-20">
              <div className="rounded-xl border border-border bg-white p-[18px]">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-extrabold text-[15px]">Việc làm của tôi</h2>
                  <span className="text-[11px] text-ink-faint">{applications.length} đơn ứng tuyển</span>
                </div>
                {applications.length === 0 ? (
                  <div className="text-[12.5px] text-ink-muted py-4">Bạn chưa ứng tuyển việc làm nào.</div>
                ) : (
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-left text-ink-faint border-b border-border">
                          <th className="py-2 px-1 font-semibold">Vị trí</th>
                          <th className="py-2 px-1 font-semibold">Công ty</th>
                          <th className="py-2 px-1 font-semibold">Ngày nộp</th>
                          <th className="py-2 px-1 font-semibold">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applications.map((a) => (
                          <tr key={a.id} className="border-b border-border last:border-0">
                            <td className="py-2 px-1 font-semibold">
                              <Link href={`/viec-lam/${a.jobPostingId}`} className="hover:text-primary">
                                {a.jobPosting.title}
                              </Link>
                            </td>
                            <td className="py-2 px-1 text-ink-muted">{a.jobPosting.company.name}</td>
                            <td className="py-2 px-1 text-ink-muted font-mono tabular-nums">
                              {formatDate(a.appliedAt)}
                            </td>
                            <td className="py-2 px-1">
                              <span
                                className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${APPLICATION_STATUS_CLASS[a.status]}`}
                              >
                                {APPLICATION_STATUS_LABEL[a.status]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-white p-[18px]">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-extrabold text-[15px]">Việc làm đã lưu</h2>
                  <span className="text-[11px] text-ink-faint">{savedJobs.length} việc</span>
                </div>
                {savedJobs.length === 0 ? (
                  <div className="text-[12.5px] text-ink-muted py-4">Bạn chưa lưu việc làm nào.</div>
                ) : (
                  <div className="flex flex-col">
                    {savedJobs.map((sj) => (
                      <div
                        key={sj.id}
                        className="flex items-center justify-between gap-2 py-2.5 border-b border-border last:border-0"
                      >
                        <div className="min-w-0">
                          <Link href={`/viec-lam/${sj.jobPostingId}`} className="font-bold text-[12.5px] hover:text-primary truncate block">
                            {sj.jobPosting.title}
                          </Link>
                          <div className="text-ink-faint text-[11.3px] truncate">{sj.jobPosting.company.name}</div>
                        </div>
                        <button
                          onClick={async () => {
                            await candidatesApi.unsaveJob(token, sj.jobPostingId);
                            setSavedJobs((prev) => prev.filter((x) => x.id !== sj.id));
                          }}
                          className="text-ink-faint hover:text-critical text-xs shrink-0"
                        >
                          Bỏ lưu
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <SettingsSection
              profile={profile}
              token={token}
              onChanged={setProfile}
              blocked={blocked}
              onBlockedChanged={setBlocked}
              onToast={showToast}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function OverviewCard({
  profile,
  token,
  onUpdated,
  savedCount,
  appliedCount,
  interviewCount,
}: {
  profile: CandidateProfile;
  token: string;
  onUpdated: (p: CandidateProfile) => void;
  savedCount: number;
  appliedCount: number;
  interviewCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: profile.fullName,
    desiredPosition: profile.desiredPosition ?? '',
    desiredLevel: profile.desiredLevel ?? '',
    desiredSalaryMin: profile.desiredSalaryMin ?? '',
    desiredSalaryMax: profile.desiredSalaryMax ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await candidatesApi.updateProfile(token, {
        fullName: form.fullName,
        desiredPosition: form.desiredPosition || undefined,
        desiredLevel: form.desiredLevel || undefined,
        desiredSalaryMin: form.desiredSalaryMin ? Number(form.desiredSalaryMin) : undefined,
        desiredSalaryMax: form.desiredSalaryMax ? Number(form.desiredSalaryMax) : undefined,
      });
      onUpdated({ ...updated, cvs: profile.cvs });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const initials = profile.fullName
    .split(/\s+/)
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  return (
    <div id="overview" className="rounded-xl border border-border bg-white p-5 scroll-mt-20">
      <div className="flex gap-4 flex-wrap">
        <div className="w-16 h-16 rounded-full bg-primary-tint text-primary flex items-center justify-center font-bold text-lg shrink-0">
          {initials || 'TU'}
        </div>
        <div className="flex-1 min-w-[200px]">
          {!editing ? (
            <>
              <div className="font-extrabold text-base">{profile.fullName}</div>
              <div className="text-ink-muted text-[12.5px] mt-0.5">
                {[profile.desiredPosition, profile.desiredLevel, formatSalary(profile.desiredSalaryMin, profile.desiredSalaryMax)]
                  .filter(Boolean)
                  .join(' · ') || 'Chưa cập nhật vị trí mong muốn'}
              </div>
              <div className="flex items-center gap-2.5 mt-2.5">
                <div className="flex-1 max-w-[240px] h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success rounded-full transition-all"
                    style={{ width: `${profile.completionPercent}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-success">{profile.completionPercent}% hoàn thiện</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2.5">
              <input
                className="tvl-input"
                placeholder="Họ tên"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  className="tvl-input"
                  placeholder="Vị trí mong muốn"
                  value={form.desiredPosition}
                  onChange={(e) => setForm((f) => ({ ...f, desiredPosition: e.target.value }))}
                />
                <input
                  className="tvl-input"
                  placeholder="Cấp bậc mong muốn"
                  value={form.desiredLevel}
                  onChange={(e) => setForm((f) => ({ ...f, desiredLevel: e.target.value }))}
                />
                <input
                  className="tvl-input"
                  placeholder="Lương tối thiểu (triệu)"
                  type="number"
                  value={form.desiredSalaryMin}
                  onChange={(e) => setForm((f) => ({ ...f, desiredSalaryMin: e.target.value }))}
                />
                <input
                  className="tvl-input"
                  placeholder="Lương tối đa (triệu)"
                  type="number"
                  value={form.desiredSalaryMax}
                  onChange={(e) => setForm((f) => ({ ...f, desiredSalaryMax: e.target.value }))}
                />
              </div>
            </div>
          )}
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="tvl-btn-primary !w-auto px-5 self-start">
            Cập nhật hồ sơ
          </button>
        ) : (
          <div className="flex gap-2 self-start">
            <button onClick={() => setEditing(false)} className="tvl-btn-ghost !w-auto px-4">
              Huỷ
            </button>
            <button onClick={handleSave} disabled={saving} className="tvl-btn-primary !w-auto px-5">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mt-5">
        {[
          [String(savedCount), 'Việc làm đã lưu'],
          [String(appliedCount), 'Việc làm đã nộp'],
          [String(interviewCount), 'Được mời phỏng vấn'],
        ].map(([val, lbl]) => (
          <div key={lbl} className="rounded-lg bg-surface-alt p-3 text-center">
            <div className="font-mono font-extrabold text-base tabular-nums">{val}</div>
            <div className="text-[10.5px] text-ink-muted mt-0.5">{lbl}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CvSection({
  profile,
  token,
  onChanged,
  onToast,
}: {
  profile: CandidateProfile;
  token: string;
  onChanged: (p: CandidateProfile) => void;
  onToast: (msg: string) => void;
}) {
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [linkValue, setLinkValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refreshCvs() {
    const p = await candidatesApi.getProfile(token);
    onChanged(p);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      onToast('Tệp vượt quá 2MB — vui lòng dùng link Google Drive thay thế');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      await candidatesApi.uploadCv(token, file);
      await refreshCvs();
      onToast('Đã tải CV lên thành công');
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'Không thể tải CV lên');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkValue.trim()) return;
    setUploading(true);
    try {
      await candidatesApi.addCvLink(token, linkValue.trim());
      setLinkValue('');
      await refreshCvs();
      onToast('Đã thêm link CV');
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'Link không hợp lệ');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    await candidatesApi.removeCv(token, id);
    await refreshCvs();
  }

  async function handleSetPrimary(id: string) {
    await candidatesApi.setPrimaryCv(token, id);
    await refreshCvs();
  }

  const cvs = profile.cvs ?? [];

  return (
    <div id="cvs" className="rounded-xl border border-border bg-white p-[18px] scroll-mt-20">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-extrabold text-[15px]">CV &amp; tệp đính kèm</h2>
        <span className="text-[11px] text-ink-faint">Tối đa 2MB (PDF/DOC) — hoặc dán link Google Drive</span>
      </div>

      {cvs.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {cvs.map((cv) => (
            <CvRow key={cv.id} cv={cv} onDelete={handleDelete} onSetPrimary={handleSetPrimary} />
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border-strong p-3.5">
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setMode('file')}
            className={`text-xs font-bold px-3 py-1.5 rounded-md ${mode === 'file' ? 'bg-primary text-white' : 'bg-surface-alt text-ink-muted'}`}
          >
            Tải file CV lên
          </button>
          <button
            onClick={() => setMode('link')}
            className={`text-xs font-bold px-3 py-1.5 rounded-md ${mode === 'link' ? 'bg-primary text-white' : 'bg-surface-alt text-ink-muted'}`}
          >
            Dán link Google Drive
          </button>
        </div>

        {mode === 'file' ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              disabled={uploading}
              className="text-[12.5px]"
            />
            <div className="text-[11px] text-ink-faint mt-2">
              Tối đa 2MB — định dạng PDF hoặc Word (.doc, .docx)
            </div>
          </div>
        ) : (
          <form onSubmit={handleAddLink} className="flex gap-2 flex-wrap">
            <input
              className="tvl-input flex-1 min-w-[200px]"
              placeholder="Dán link Google Drive đã bật chia sẻ xem…"
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
            />
            <button type="submit" disabled={uploading} className="tvl-btn-primary !w-auto px-4">
              Thêm
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function CvRow({
  cv,
  onDelete,
  onSetPrimary,
}: {
  cv: CV;
  onDelete: (id: string) => void;
  onSetPrimary: (id: string) => void;
}) {
  const label = cv.fileUrl ? cv.originalFileName ?? cv.fileUrl.split('/').pop() : cv.externalLinkUrl;
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-surface-alt px-3 py-2.5">
      <span className="text-base">📄</span>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold truncate">{label}</div>
        <div className="text-[10.5px] text-ink-faint">{cv.fileUrl ? 'Tệp đính kèm' : 'Link Google Drive'}</div>
      </div>
      {cv.isPrimary ? (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success-tint text-success shrink-0">
          Chính
        </span>
      ) : (
        <button onClick={() => onSetPrimary(cv.id)} className="text-[11px] font-semibold text-primary shrink-0">
          Đặt làm chính
        </button>
      )}
      <button onClick={() => onDelete(cv.id)} className="text-ink-faint hover:text-critical text-xs shrink-0">
        Xoá
      </button>
    </div>
  );
}

function SettingsSection({
  profile,
  token,
  onChanged,
  blocked,
  onBlockedChanged,
  onToast,
}: {
  profile: CandidateProfile;
  token: string;
  onChanged: (p: CandidateProfile) => void;
  blocked: BlockedCompany[];
  onBlockedChanged: (b: BlockedCompany[]) => void;
  onToast: (msg: string) => void;
}) {
  const [companyInput, setCompanyInput] = useState('');

  async function toggleVisibility() {
    const next = profile.visibility === 'locked' ? 'public' : 'locked';
    const updated = await candidatesApi.updateProfile(token, { visibility: next });
    onChanged({ ...updated, cvs: profile.cvs });
  }

  async function toggleNotifications() {
    const updated = await candidatesApi.updateProfile(token, {
      allowJobNotifications: !profile.allowJobNotifications,
    });
    onChanged({ ...updated, cvs: profile.cvs });
  }

  async function addBlocked(e: React.FormEvent) {
    e.preventDefault();
    if (!companyInput.trim()) return;
    try {
      const row = await candidatesApi.blockCompany(token, { companyNameText: companyInput.trim() });
      onBlockedChanged([row, ...blocked]);
      setCompanyInput('');
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'Không thể thêm');
    }
  }

  async function removeBlocked(id: string) {
    await candidatesApi.unblockCompany(token, id);
    onBlockedChanged(blocked.filter((b) => b.id !== id));
  }

  return (
    <div id="settings" className="grid md:grid-cols-2 gap-4 scroll-mt-20">
      <div className="flex flex-col gap-4">
        <ToggleCard
          title="Cho phép tìm kiếm hồ sơ"
          desc="Nhà tuyển dụng có thể tìm thấy hồ sơ của bạn"
          on={profile.visibility !== 'locked'}
          onToggle={toggleVisibility}
        />
        <ToggleCard
          title="Nhận thông báo việc làm"
          desc="Theo ngành nghề & vị trí đã lưu trong hồ sơ"
          on={profile.allowJobNotifications}
          onToggle={toggleNotifications}
        />
      </div>

      <div className="rounded-xl border border-border bg-white p-[18px]">
        <div className="font-bold text-[13px] mb-0.5">Chặn công ty xem hồ sơ</div>
        <div className="text-ink-faint text-[11.3px] mb-3">Công ty trong danh sách sẽ không thấy hồ sơ của bạn</div>
        <form onSubmit={addBlocked} className="flex gap-2">
          <input
            className="tvl-input flex-1"
            placeholder="Nhập tên công ty…"
            value={companyInput}
            onChange={(e) => setCompanyInput(e.target.value)}
          />
          <button type="submit" className="tvl-btn-primary !w-auto px-4">
            Thêm
          </button>
        </form>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {blocked.map((b) => (
            <span
              key={b.id}
              className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-surface-alt text-ink-muted flex items-center gap-1.5"
            >
              {b.company?.name ?? b.companyNameText}
              <button onClick={() => removeBlocked(b.id)} className="hover:text-critical">
                ✕
              </button>
            </span>
          ))}
          {blocked.length === 0 && <span className="text-[11.5px] text-ink-faint">Chưa chặn công ty nào</span>}
        </div>
      </div>
    </div>
  );
}

function ToggleCard({
  title,
  desc,
  on,
  onToggle,
}: {
  title: string;
  desc: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-bold text-[13px]">{title}</div>
          <div className="text-ink-faint text-[11.3px] mt-0.5">{desc}</div>
        </div>
        <button
          onClick={onToggle}
          className={`w-10 h-6 rounded-full relative shrink-0 transition-colors ${on ? 'bg-primary' : 'bg-border-strong'}`}
          aria-pressed={on}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`}
          />
        </button>
      </div>
    </div>
  );
}
