'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import EmployerHeader from '@/components/EmployerHeader';
import { useAuth } from '@/lib/auth-context';
import { employerApi, ApiError, type Company, type TeamMember, type WorkLocation } from '@/lib/api';
import { formatDate } from '@/lib/format';
import ChangePasswordCard from '@/components/ChangePasswordCard';
import FacebookConnectCard from '@/components/FacebookConnectCard';
import PasswordInput from '@/components/PasswordInput';
import { CompanyLogo } from '@/components/CompanyLogo';

const LEGAL_DOC_MAX_BYTES = 3 * 1024 * 1024;

export default function TaiKhoanPage() {
  const router = useRouter();
  const { me, token } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [workLocations, setWorkLocations] = useState<WorkLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && !me.role.startsWith('employer')) router.replace('/');
  }, [me, router]);

  // Chỉ hiện màn hình "Đang tải…" toàn trang ở lần tải đầu tiên — các lần gọi lại sau khi lưu
  // (cập nhật công ty, upload giấy tờ, thêm/xoá tài khoản phụ) không được unmount lại các card,
  // nếu không sẽ mất trạng thái UI cục bộ (tab đang chọn, form đang mở) ngay sau khi lưu thành công.
  const loadAll = useCallback(async () => {
    if (!token) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [c, t, wl] = await Promise.all([
        employerApi.getCompany(token),
        employerApi.listTeam(token),
        employerApi.listWorkLocations(token),
      ]);
      setCompany(c);
      setTeam(t);
      setWorkLocations(wl);
      hasLoadedRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function notify(msg: string) {
    setToast(msg);
  }

  if (!me || !me.role.startsWith('employer') || !token) return null;

  return (
    <main className="min-h-screen bg-bg">
      <EmployerHeader />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col gap-4">
        {toast && (
          <div className="rounded-lg bg-info-tint text-info text-xs font-semibold px-3.5 py-2.5">{toast}</div>
        )}
        {loading || !company ? (
          <div className="text-center text-ink-faint py-10 text-sm">Đang tải…</div>
        ) : (
          <>
            <CompanyInfoCard token={token} company={company} onSaved={loadAll} onToast={notify} />
            <WorkLocationsCard token={token} locations={workLocations} onSaved={loadAll} onToast={notify} />
            <LegalDocCard token={token} company={company} onSaved={loadAll} onToast={notify} />
            <TeamCard token={token} team={team} onSaved={loadAll} onToast={notify} />
            <ChangePasswordCard token={token} />
            <FacebookConnectCard />
          </>
        )}
      </div>
    </main>
  );
}

function CompanyInfoCard({
  token,
  company,
  onSaved,
  onToast,
}: {
  token: string;
  company: Company;
  onSaved: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [size, setSize] = useState(company.size ?? '');
  const [industry, setIndustry] = useState(company.industry ?? '');
  const [website, setWebsite] = useState(company.website ?? '');
  const [logoUrl, setLogoUrl] = useState(company.logoUrl ?? '');
  const [description, setDescription] = useState(company.description ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await employerApi.updateCompany(token, {
        size: size.trim() || undefined,
        industry: industry.trim() || undefined,
        website: website.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        description: description.trim() || undefined,
      });
      onToast('Đã lưu thông tin công ty');
      await onSaved();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'Không thể lưu, vui lòng thử lại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="rounded-xl border border-border bg-white p-[18px] flex flex-col gap-4">
      <h2 className="font-extrabold text-[15px]">Thông tin công ty</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-ink-faint mb-1 block">Tên công ty</label>
          <input className="tvl-input opacity-70" value={company.name} disabled />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-faint mb-1 block">Mã số thuế</label>
          <input className="tvl-input opacity-70" value={company.taxCode} disabled />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="tk-size" className="text-xs font-semibold text-ink-faint mb-1 block">
            Quy mô
          </label>
          <input
            id="tk-size"
            className="tvl-input"
            placeholder="VD: 100–499 nhân viên"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="tk-website" className="text-xs font-semibold text-ink-faint mb-1 block">
            Website
          </label>
          <input
            id="tk-website"
            className="tvl-input"
            placeholder="VD: congty.vn"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label htmlFor="tk-industry" className="text-xs font-semibold text-ink-faint mb-1 block">
          Ngành nghề
        </label>
        <input
          id="tk-industry"
          className="tvl-input"
          placeholder="VD: Công nghệ thông tin"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
        />
      </div>
      {/* Đợt 12ab (24/09/2026) — logo công ty qua link ảnh (URL, quyết định đã chốt), hiện trên thẻ
          việc làm/trang chi tiết tin/trang công ty. Có xem trước ngay để NTD biết dán đúng link ảnh. */}
      <div>
        <label htmlFor="tk-logo" className="text-xs font-semibold text-ink-faint mb-1 block">
          Logo công ty (link ảnh URL, không bắt buộc)
        </label>
        <div className="flex items-center gap-3">
          <CompanyLogo name={company.name} logoUrl={logoUrl} size={44} className="text-xs" />
          <input
            id="tk-logo"
            className="tvl-input flex-1"
            placeholder="https://..."
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
          />
        </div>
        <div className="text-[10.5px] text-ink-faint mt-1.5">
          Dán link ảnh logo công ty (PNG/JPG) đã đăng ở nơi khác — nếu link lỗi hoặc chưa có logo, hệ thống tự hiện chữ cái đầu tên công ty.
        </div>
      </div>
      {/* Đợt 12ac (24/09/2026) — "Giới thiệu công ty", hiện ở tab Tổng quan công ty (trang chi tiết
          tin), có mở rộng/thu gọn khi dài, theo mẫu careerviet.vn. */}
      <div>
        <label htmlFor="tk-description" className="text-xs font-semibold text-ink-faint mb-1 block">
          Giới thiệu công ty (không bắt buộc)
        </label>
        <textarea
          id="tk-description"
          className="tvl-input !h-auto"
          rows={5}
          placeholder="Giới thiệu ngắn về công ty — lịch sử, lĩnh vực hoạt động, văn hoá làm việc…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="text-[10.5px] text-ink-faint mt-1.5">
          Hiển thị ở tab &quot;Tổng quan công ty&quot; trên trang chi tiết tin tuyển dụng.
        </div>
      </div>
      <div className="flex justify-end pt-2 border-t border-border">
        <button type="submit" disabled={saving} className="tvl-btn-primary !w-auto px-6">
          {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
        </button>
      </div>
    </form>
  );
}

// Đợt 12ac (24/09/2026) — "Quản lý địa điểm làm việc": lưu sẵn các địa điểm hay dùng để chọn nhanh
// khi đăng tin (autofill tỉnh/thành, quận/huyện, địa chỉ), thay vì gõ lại mỗi lần. Text thuần, CHƯA
// tích hợp bản đồ thật (Goong Maps là API trả phí — theo quyết định đã chốt).
function WorkLocationsCard({
  token,
  locations,
  onSaved,
  onToast,
}: {
  token: string;
  locations: WorkLocation[];
  onSaved: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await employerApi.createWorkLocation(token, {
        label: label.trim(),
        province: province.trim(),
        district: district.trim() || undefined,
        address: address.trim() || undefined,
      });
      setLabel('');
      setProvince('');
      setDistrict('');
      setAddress('');
      setShowForm(false);
      onToast('Đã thêm địa điểm làm việc');
      await onSaved();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'Không thể thêm địa điểm');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      await employerApi.deleteWorkLocation(token, id);
      onToast('Đã xoá địa điểm làm việc');
      await onSaved();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'Không thể xoá địa điểm này');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-[18px] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold text-[15px]">Địa điểm làm việc</h2>
        <button onClick={() => setShowForm((v) => !v)} className="text-xs font-bold text-primary">
          {showForm ? 'Đóng' : '+ Thêm địa điểm'}
        </button>
      </div>
      <div className="text-[11px] text-ink-faint -mt-1.5">
        Lưu sẵn địa điểm hay dùng để chọn nhanh khi đăng tin tuyển dụng.
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-lg border border-border-strong p-3.5 flex flex-col gap-2.5">
          <input
            className="tvl-input"
            placeholder="Tên gợi nhớ (VD: Văn phòng Quận 1)"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <div className="grid sm:grid-cols-2 gap-2.5">
            <input
              className="tvl-input"
              placeholder="Tỉnh/Thành phố"
              required
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            />
            <input
              className="tvl-input"
              placeholder="Quận/Huyện (không bắt buộc)"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            />
          </div>
          <input
            className="tvl-input"
            placeholder="Địa chỉ chi tiết (không bắt buộc)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button type="submit" disabled={saving} className="tvl-btn-primary !w-auto px-5 self-end">
            {saving ? 'Đang thêm…' : 'Thêm địa điểm'}
          </button>
        </form>
      )}

      {locations.length === 0 ? (
        <div className="text-[12px] text-ink-faint text-center py-4">Bạn chưa lưu địa điểm làm việc nào.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {locations.map((loc) => (
            <div key={loc.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-alt px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-[12.5px] font-bold truncate">{loc.label}</div>
                <div className="text-[11px] text-ink-faint truncate">
                  {[loc.address, loc.district, loc.province].filter(Boolean).join(', ')}
                </div>
              </div>
              <button
                disabled={removingId === loc.id}
                onClick={() => handleRemove(loc.id)}
                className="shrink-0 text-[11px] font-bold rounded-md bg-critical-tint text-critical px-2.5 py-1.5 disabled:opacity-50"
              >
                Xoá
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LegalDocCard({
  token,
  company,
  onSaved,
  onToast,
}: {
  token: string;
  company: Company;
  onSaved: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [linkValue, setLinkValue] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > LEGAL_DOC_MAX_BYTES) {
      onToast('Tệp vượt quá 3MB — vui lòng dán link Google Drive thay thế');
      e.target.value = '';
      return;
    }
    setBusy(true);
    try {
      await employerApi.uploadLegalDoc(token, file);
      onToast('Đã tải giấy tờ pháp lý lên thành công');
      await onSaved();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'Không thể tải tệp lên');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkValue.trim()) return;
    setBusy(true);
    try {
      await employerApi.addLegalDocLink(token, linkValue.trim());
      setLinkValue('');
      onToast('Đã lưu link giấy tờ pháp lý');
      await onSaved();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'Link không hợp lệ');
    } finally {
      setBusy(false);
    }
  }

  const currentLabel = company.legalDocUrl
    ? company.legalDocOriginalFileName ?? company.legalDocUrl.split('/').pop()
    : company.legalDocExternalLink;

  return (
    <div className="rounded-xl border border-border bg-white p-[18px] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold text-[15px]">Giấy tờ pháp lý doanh nghiệp</h2>
        <span className="text-[11px] text-ink-faint">Dùng để Admin xác thực tài khoản NTD</span>
      </div>

      {currentLabel && (
        <div className="flex items-center gap-2.5 rounded-lg bg-surface-alt px-3 py-2.5">
          <span className="text-base">📄</span>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold truncate">{currentLabel}</div>
            <div className="text-[10.5px] text-ink-faint">
              {company.legalDocUrl ? 'Tệp đính kèm' : 'Link Google Drive'}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border-strong p-3.5">
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setMode('file')}
            className={`text-xs font-bold px-3 py-1.5 rounded-md ${mode === 'file' ? 'bg-primary text-white' : 'bg-surface-alt text-ink-muted'}`}
          >
            Tải tệp lên
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
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              disabled={busy}
              className="text-[12.5px]"
            />
            <div className="text-[11px] text-ink-faint mt-2">
              Tối đa 3MB — PDF, Word hoặc ảnh (JPG/PNG). Vượt ngưỡng vui lòng dùng tab &quot;Dán link Google Drive&quot;.
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
            <button type="submit" disabled={busy} className="tvl-btn-primary !w-auto px-5">
              Lưu
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function TeamCard({
  token,
  team,
  onSaved,
  onToast,
}: {
  token: string;
  team: TeamMember[];
  onSaved: () => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await employerApi.addSubAccount(token, {
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
      });
      setEmail('');
      setPassword('');
      setFullName('');
      setPhone('');
      setShowForm(false);
      onToast('Đã thêm tài khoản phụ');
      await onSaved();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'Không thể thêm tài khoản phụ');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      await employerApi.removeSubAccount(token, id);
      onToast('Đã xoá tài khoản phụ');
      await onSaved();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'Không thể xoá tài khoản này');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-[18px] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold text-[15px]">Tài khoản phụ</h2>
        <button onClick={() => setShowForm((v) => !v)} className="text-xs font-bold text-primary">
          {showForm ? 'Đóng' : '+ Thêm tài khoản phụ'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-lg border border-border-strong p-3.5 flex flex-col gap-2.5">
          <div className="grid sm:grid-cols-2 gap-2.5">
            <input
              className="tvl-input"
              placeholder="Họ và tên"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <input
              className="tvl-input"
              placeholder="Số điện thoại (không bắt buộc)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              className="tvl-input"
              type="email"
              placeholder="Email đăng nhập"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <PasswordInput
              className="tvl-input"
              placeholder="Mật khẩu (tối thiểu 8 ký tự)"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="text-[10.5px] text-ink-faint">
            Do hệ thống chưa gửi email mời (Giai đoạn 1), bạn cấp trực tiếp email và mật khẩu đăng nhập cho nhân sự.
          </div>
          <button type="submit" disabled={saving} className="tvl-btn-primary !w-auto px-5 self-end">
            {saving ? 'Đang thêm…' : 'Thêm tài khoản'}
          </button>
        </form>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink-faint bg-surface-alt">
                <th className="py-2.5 px-4 font-semibold">Họ tên</th>
                <th className="py-2.5 px-3 font-semibold">Email</th>
                <th className="py-2.5 px-3 font-semibold">Vai trò</th>
                <th className="py-2.5 px-3 font-semibold">Ngày thêm</th>
                <th className="py-2.5 px-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="py-3 px-4 font-bold">{m.user.fullName ?? '—'}</td>
                  <td className="py-3 px-3 text-ink-faint">{m.user.email}</td>
                  <td className="py-3 px-3">{m.type === 'main' ? 'Tài khoản Chính' : 'Tài khoản Phụ'}</td>
                  <td className="py-3 px-3 tabular-nums whitespace-nowrap">{formatDate(m.createdAt)}</td>
                  <td className="py-3 px-4 text-right">
                    {m.type === 'sub' && (
                      <button
                        disabled={removingId === m.id}
                        onClick={() => handleRemove(m.id)}
                        className="text-[11px] font-bold rounded-md bg-critical-tint text-critical px-2.5 py-1.5 disabled:opacity-50"
                      >
                        Xoá
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
