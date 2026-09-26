'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  adminApi,
  adminPeopleApi,
  ApiError,
  type AdminPersonDetail,
  type AdminPersonRow,
  type ProfileVisibility,
} from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/format';
import { INDUSTRIES, PROVINCES } from '@/lib/catalogs';
import { Modal } from '@/components/profile/ui';
import { startImpersonation } from '@/lib/impersonation';
import { Pager } from './CvSourcingPanel';

// Đợt 18e (26/09/2026) — Admin "Người dùng": sửa được MỌI thông tin của ứng viên, nhà tuyển dụng và quản
// trị viên. Sửa nhanh ngay tại đây (tài khoản, công ty, thông tin chính của hồ sơ), đặt lại mật khẩu,
// khoá/mở khoá; phần còn lại (hồ sơ 13 mục, tin đăng, đội ngũ…) dùng “Đăng nhập thay” để sửa qua đúng
// giao diện của người dùng đó. Thay cho ô tra cứu theo email cũ (Đợt 12a).

const ROLE_LABEL: Record<string, string> = {
  candidate: 'Ứng viên',
  employer_main: 'NTD (chủ)',
  employer_sub: 'NTD (thành viên)',
  admin: 'Admin',
  moderator: 'Moderator',
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: 'Hoạt động', cls: 'bg-success-tint text-success' },
  suspended: { label: 'Đã khoá', cls: 'bg-critical-tint text-critical' },
  pending_verification: { label: 'Chờ xác thực', cls: 'bg-warning-tint text-warning' },
};

const VISIBILITY_LABEL: Record<ProfileVisibility, string> = {
  public: 'Công khai',
  urgent: 'Tìm việc gấp',
  locked: 'Khoá (NTD không tìm được)',
};

export function PeoplePanel({ token }: { token: string }) {
  const [role, setRole] = useState<'' | 'candidate' | 'employer' | 'admin'>('');
  const [status, setStatus] = useState('');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: AdminPersonRow[]; total: number; pageSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await adminPeopleApi.list(token, { q, role: role || undefined, status: status || undefined, page, pageSize: 20 }));
    } finally {
      setLoading(false);
    }
  }, [token, q, role, status, page]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="font-bold text-base">Người dùng</h1>
        <p className="text-xs text-ink-faint mt-1 max-w-3xl">
          Tìm mọi tài khoản theo email, họ tên, SĐT, tên công ty (gõ không dấu được). Bấm “Sửa” để sửa nhanh tài khoản, thông tin công
          ty, hồ sơ ứng viên, đặt lại mật khẩu, khoá tài khoản — hoặc “Đăng nhập thay” để sửa mọi thứ qua đúng giao diện của người dùng.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5">
          {(
            [
              ['', 'Tất cả'],
              ['candidate', 'Ứng viên'],
              ['employer', 'Nhà tuyển dụng'],
              ['admin', 'Quản trị'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => {
                setRole(k);
                setPage(1);
              }}
              className={`text-[11.5px] font-bold rounded-full px-3 py-1.5 border ${
                role === k ? 'bg-primary text-white border-primary' : 'bg-white text-ink-muted border-border'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <select
          className="tvl-input !w-auto text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Lọc trạng thái"
        >
          <option value="">Mọi trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="suspended">Đã khoá</option>
        </select>
        <input
          className="tvl-input !w-auto flex-1 min-w-[220px] text-sm"
          placeholder="Email, họ tên, SĐT, tên công ty…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
      </div>
      <div className="text-xs text-ink-faint">{data ? `${formatNumber(data.total)} tài khoản` : ''}</div>
      <div className="rounded-xl bg-white border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-ink-faint bg-surface-alt">
                <th className="py-2.5 px-4 font-semibold">Tài khoản</th>
                <th className="py-2.5 px-3 font-semibold">Vai trò</th>
                <th className="py-2.5 px-3 font-semibold">Công ty</th>
                <th className="py-2.5 px-3 font-semibold">Trạng thái</th>
                <th className="py-2.5 px-3 font-semibold">Ngày tạo</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody className={loading ? 'opacity-60' : ''}>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-ink-faint py-10">
                    Không tìm thấy tài khoản nào.
                  </td>
                </tr>
              )}
              {data?.items.map((u) => {
                const st = STATUS_LABEL[u.status] ?? { label: u.status, cls: 'bg-surface-alt text-ink-muted' };
                return (
                  <tr key={u.id} className="border-t border-border">
                    <td className="py-3 px-4">
                      <div className="font-bold">{u.fullName ?? '—'}</div>
                      <div className="text-ink-muted">{u.email}</div>
                      {u.phone && <div className="text-ink-faint">{u.phone}</div>}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">{ROLE_LABEL[u.role] ?? u.role}</td>
                    <td className="py-3 px-3">{u.companyName ?? '—'}</td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="py-3 px-3 tabular-nums whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setOpenId(u.id)}
                        className="text-[11px] font-bold rounded-md bg-primary text-white px-3 py-1.5"
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {data && totalPages > 1 && <Pager page={page} totalPages={totalPages} onPage={setPage} />}
      {openId && (
        <PersonModal
          token={token}
          userId={openId}
          onClose={() => setOpenId(null)}
          onSaved={() => load().catch(() => undefined)}
        />
      )}
    </div>
  );
}

function PersonModal({
  token,
  userId,
  onClose,
  onSaved,
}: {
  token: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { me } = useAuth();
  const [d, setD] = useState<AdminPersonDetail | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [u, setU] = useState({ fullName: '', email: '', phone: '', status: '', role: '' });
  const [c, setC] = useState({ name: '', taxCode: '', industry: '', size: '', website: '', logoUrl: '', description: '' });
  const [p, setP] = useState({
    fullName: '',
    profileTitle: '',
    phone: '',
    contactEmail: '',
    province: '',
    desiredPosition: '',
    visibility: 'public' as ProfileVisibility,
    hideContactInfo: false,
  });

  const fill = useCallback((x: AdminPersonDetail) => {
    setD(x);
    setU({
      fullName: x.user.fullName ?? '',
      email: x.user.email,
      phone: x.user.phone ?? '',
      status: x.user.status,
      role: x.user.role,
    });
    if (x.company)
      setC({
        name: x.company.name,
        taxCode: x.company.taxCode,
        industry: x.company.industry ?? '',
        size: x.company.size ?? '',
        website: x.company.website ?? '',
        logoUrl: x.company.logoUrl ?? '',
        description: x.company.description ?? '',
      });
    if (x.profile)
      setP({
        fullName: x.profile.fullName,
        profileTitle: x.profile.profileTitle ?? '',
        phone: x.profile.phone ?? '',
        contactEmail: x.profile.contactEmail ?? '',
        province: x.profile.province ?? '',
        desiredPosition: x.profile.desiredPosition ?? '',
        visibility: x.profile.visibility,
        hideContactInfo: x.profile.hideContactInfo,
      });
  }, []);

  useEffect(() => {
    adminPeopleApi
      .detail(token, userId)
      .then(fill)
      .catch((err) => setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Không tải được tài khoản' }));
  }, [token, userId, fill]);

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
      onSaved();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Không lưu được' });
    } finally {
      setBusy(null);
    }
  }

  const isAdminTarget = d && (d.user.role === 'admin' || d.user.role === 'moderator');
  const iAmAdmin = me?.role === 'admin';
  const isSelf = d?.user.id === me?.id;
  const canImpersonate = iAmAdmin && d && !isAdminTarget && d.user.status !== 'suspended';

  async function impersonate() {
    if (!d) return;
    if (!confirm(`Đăng nhập thay ${d.user.email}? Bạn sẽ thấy và thao tác đúng như người dùng này (tối đa 2 giờ, có ghi nhật ký).`)) return;
    setBusy('imp');
    try {
      const res = await adminPeopleApi.impersonate(token, d.user.id);
      startImpersonation(token, { email: res.user.email, role: res.user.role, expiresInMinutes: res.expiresInMinutes });
      // Đợt 19 (26/09/2026) — tải lại TRANG MỚI HOÀN TOÀN với token người dùng (thay vì đổi token tại chỗ
      // rồi điều hướng nội bộ): tránh hẳn cảnh trang Admin còn đang hiển thị kịp đọc danh tính mới (không
      // phải Admin) và tự chuyển hướng về trang chủ trước khi điều hướng sang trang NTD/ứng viên xong.
      localStorage.setItem('tvl_token', res.accessToken);
      window.location.assign(res.user.role === 'candidate' ? '/ho-so' : '/nha-tuyen-dung/dashboard');
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Không đăng nhập thay được' });
      setBusy(null);
    }
  }

  return (
    <Modal title={d ? `Sửa tài khoản: ${d.user.email}` : 'Đang tải…'} onClose={onClose} wide>
      {!d ? (
        msg ? (
          <div className="rounded-lg bg-critical-tint text-critical text-xs font-semibold px-3.5 py-2.5">{msg.text}</div>
        ) : (
          <div className="text-center text-ink-faint text-sm py-10">Đang tải…</div>
        )
      ) : (
        <div className="flex flex-col gap-4 text-xs">
          {msg && (
            <div
              className={`rounded-lg text-xs font-semibold px-3.5 py-2.5 break-words ${
                msg.ok ? 'bg-success-tint text-success' : 'bg-critical-tint text-critical'
              }`}
            >
              {msg.text}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {canImpersonate && (
              <button onClick={impersonate} disabled={!!busy} className="tvl-btn-accent !w-auto px-4 text-xs">
                👤 Đăng nhập thay
              </button>
            )}
            {(!isAdminTarget || iAmAdmin) && (
              <button
                disabled={!!busy}
                onClick={() => {
                  if (!confirm('Đặt lại mật khẩu tạm cho tài khoản này?')) return;
                  run('pw', async () => {
                    const r = await adminApi.resetUserPassword(token, d.user.id);
                    return `Mật khẩu tạm cho ${r.email}: ${r.tempPassword} — chỉ hiện 1 lần, hãy báo cho người dùng.`;
                  });
                }}
                className="tvl-btn-ghost !w-auto px-4 text-xs"
              >
                🔑 Đặt lại mật khẩu tạm
              </button>
            )}
            {!isSelf && (!isAdminTarget || iAmAdmin) && (
              <button
                disabled={!!busy}
                onClick={() => {
                  const next = d.user.status === 'suspended' ? 'active' : 'suspended';
                  if (next === 'suspended' && !confirm('Khoá tài khoản này? Người dùng sẽ bị đăng xuất và không đăng nhập được nữa.')) return;
                  run('status', async () => {
                    fill(await adminPeopleApi.updateUser(token, d.user.id, { status: next }));
                    return next === 'suspended' ? 'Đã khoá tài khoản.' : 'Đã mở khoá tài khoản.';
                  });
                }}
                className={`!w-auto px-4 text-xs rounded-lg font-bold py-2.5 ${
                  d.user.status === 'suspended' ? 'bg-success-tint text-success' : 'bg-critical-tint text-critical'
                }`}
              >
                {d.user.status === 'suspended' ? '🔓 Mở khoá tài khoản' : '🔒 Khoá tài khoản'}
              </button>
            )}
          </div>

          <Box title="Tài khoản đăng nhập">
            <div className="grid sm:grid-cols-2 gap-3">
              <L label="Họ tên">
                <input className="tvl-input text-sm" value={u.fullName} onChange={(e) => setU({ ...u, fullName: e.target.value })} />
              </L>
              <L label="Email đăng nhập">
                <input className="tvl-input text-sm" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} />
              </L>
              <L label="Số điện thoại">
                <input className="tvl-input text-sm" value={u.phone} onChange={(e) => setU({ ...u, phone: e.target.value })} />
              </L>
              {isAdminTarget && iAmAdmin && !isSelf && (
                <L label="Vai trò quản trị">
                  <select className="tvl-input text-sm" value={u.role} onChange={(e) => setU({ ...u, role: e.target.value })}>
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                  </select>
                </L>
              )}
            </div>
            <div className="flex items-center justify-between mt-2 text-ink-faint">
              <span>
                {ROLE_LABEL[d.user.role] ?? d.user.role} · tạo ngày {formatDate(d.user.createdAt)}
              </span>
              <button
                disabled={!!busy || (!!isAdminTarget && !iAmAdmin)}
                onClick={() =>
                  run('user', async () => {
                    const payload: Record<string, string> = { fullName: u.fullName, email: u.email, phone: u.phone };
                    if (isAdminTarget && iAmAdmin && !isSelf && u.role !== d.user.role) payload.role = u.role;
                    fill(await adminPeopleApi.updateUser(token, d.user.id, payload));
                    return 'Đã lưu tài khoản.';
                  })
                }
                className="tvl-btn-primary !w-auto px-4 text-xs"
              >
                Lưu tài khoản
              </button>
            </div>
          </Box>

          {d.company && (
            <Box title="Thông tin công ty">
              <div className="grid sm:grid-cols-2 gap-3">
                <L label="Tên công ty">
                  <input className="tvl-input text-sm" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
                </L>
                <L label="Mã số thuế">
                  <input className="tvl-input text-sm" value={c.taxCode} onChange={(e) => setC({ ...c, taxCode: e.target.value })} />
                </L>
                <L label="Ngành nghề">
                  <select className="tvl-input text-sm" value={c.industry} onChange={(e) => setC({ ...c, industry: e.target.value })}>
                    <option value="">—</option>
                    {(INDUSTRIES.includes(c.industry) || !c.industry ? INDUSTRIES : [c.industry, ...INDUSTRIES]).map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </L>
                <L label="Quy mô">
                  <input className="tvl-input text-sm" value={c.size} onChange={(e) => setC({ ...c, size: e.target.value })} />
                </L>
                <L label="Website">
                  <input className="tvl-input text-sm" value={c.website} onChange={(e) => setC({ ...c, website: e.target.value })} />
                </L>
                <L label="Logo (URL)">
                  <input className="tvl-input text-sm" value={c.logoUrl} onChange={(e) => setC({ ...c, logoUrl: e.target.value })} />
                </L>
              </div>
              <L label="Giới thiệu công ty">
                <textarea
                  className="tvl-input text-sm min-h-[90px]"
                  value={c.description}
                  onChange={(e) => setC({ ...c, description: e.target.value })}
                />
              </L>
              <div className="flex justify-end mt-2">
                <button
                  disabled={!!busy}
                  onClick={() =>
                    run('company', async () => {
                      await adminPeopleApi.updateCompany(token, d.company!.id, c);
                      return 'Đã lưu thông tin công ty.';
                    })
                  }
                  className="tvl-btn-primary !w-auto px-4 text-xs"
                >
                  Lưu công ty
                </button>
              </div>
            </Box>
          )}

          {d.profile && (
            <Box title={`Hồ sơ ứng viên (hoàn thiện ${formatNumber(d.profile.completionPercent)}%)`}>
              <div className="grid sm:grid-cols-2 gap-3">
                <L label="Họ tên trên hồ sơ">
                  <input className="tvl-input text-sm" value={p.fullName} onChange={(e) => setP({ ...p, fullName: e.target.value })} />
                </L>
                <L label="Chức danh hồ sơ">
                  <input className="tvl-input text-sm" value={p.profileTitle} onChange={(e) => setP({ ...p, profileTitle: e.target.value })} />
                </L>
                <L label="Vị trí mong muốn">
                  <input
                    className="tvl-input text-sm"
                    value={p.desiredPosition}
                    onChange={(e) => setP({ ...p, desiredPosition: e.target.value })}
                  />
                </L>
                <L label="Tỉnh/thành">
                  <select className="tvl-input text-sm" value={p.province} onChange={(e) => setP({ ...p, province: e.target.value })}>
                    <option value="">—</option>
                    {PROVINCES.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </L>
                <L label="SĐT liên hệ">
                  <input className="tvl-input text-sm" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} />
                </L>
                <L label="Email liên hệ">
                  <input className="tvl-input text-sm" value={p.contactEmail} onChange={(e) => setP({ ...p, contactEmail: e.target.value })} />
                </L>
                <L label="Chế độ hồ sơ">
                  <select
                    className="tvl-input text-sm"
                    value={p.visibility}
                    onChange={(e) => setP({ ...p, visibility: e.target.value as ProfileVisibility })}
                  >
                    {(Object.keys(VISIBILITY_LABEL) as ProfileVisibility[]).map((v) => (
                      <option key={v} value={v}>
                        {VISIBILITY_LABEL[v]}
                      </option>
                    ))}
                  </select>
                </L>
                <label className="flex items-center gap-2 mt-5">
                  <input type="checkbox" checked={p.hideContactInfo} onChange={(e) => setP({ ...p, hideContactInfo: e.target.checked })} />
                  Ẩn thông tin liên hệ với NTD
                </label>
              </div>
              <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                <span className="text-ink-faint">
                  Kinh nghiệm, học vấn, kỹ năng… (13 mục) → dùng “Đăng nhập thay” để sửa đầy đủ.
                  {d.profile.isAdminSourced && ` · Hồ sơ nguồn tổng hợp (${d.profile.sourceLabel ?? '—'})`}
                </span>
                <button
                  disabled={!!busy}
                  onClick={() =>
                    run('profile', async () => {
                      await adminPeopleApi.updateCandidate(token, d.profile!.id, p);
                      fill(await adminPeopleApi.detail(token, d.user.id));
                      return 'Đã lưu hồ sơ ứng viên.';
                    })
                  }
                  className="tvl-btn-primary !w-auto px-4 text-xs"
                >
                  Lưu hồ sơ
                </button>
              </div>
            </Box>
          )}
        </div>
      )}
    </Modal>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border p-3.5 flex flex-col gap-2">
      <h4 className="text-[12.5px] font-extrabold uppercase tracking-wide">{title}</h4>
      {children}
    </section>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11.5px] font-bold text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
