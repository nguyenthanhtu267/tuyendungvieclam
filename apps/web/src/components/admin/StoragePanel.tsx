'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminStorageApi, ApiError, type StorageStatus } from '@/lib/api';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';

// Đợt 20 (27/09/2026) — Admin "🗄️ Lưu trữ file": kết nối Google Drive của chủ web để lưu mọi file tải lên
// (CV, Kho CV, giấy tờ công ty, ảnh đại diện) thay vì trong CSDL (Supabase miễn phí chỉ 500MB).

function fmtBytes(b: number): string {
  if (b < 1024) return `${formatNumber(b)} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`;
  return `${(b / 1024 ** 3).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} GB`;
}

const SUPABASE_FREE = 500 * 1024 * 1024;

export function StoragePanel({ token }: { token: string }) {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const [st, setSt] = useState<StorageStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    adminStorageApi
      .status(token)
      .then((s) => {
        setSt(s);
        setErr(null);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Không tải được trạng thái lưu trữ'));
  }, [token]);

  useEffect(() => {
    load();
    // Kết quả quay về từ trang cấp quyền của Google.
    try {
      const p = new URLSearchParams(window.location.search);
      const drive = p.get('drive');
      if (drive === 'ok') setNotice({ ok: true, text: 'Đã kết nối Google Drive. File mới sẽ lưu lên Drive; file cũ được chuyển dần trong nền.' });
      if (drive === 'error') setNotice({ ok: false, text: p.get('msg') || 'Kết nối Google Drive không thành công.' });
      if (drive) window.history.replaceState(null, '', '/admin/dashboard');
    } catch {
      /* bỏ qua */
    }
  }, [load]);

  // Đang chuyển file cũ → tự làm mới số liệu mỗi 20 giây.
  const moving = !!st && st.connected && !st.migrationPaused && st.categories.some((c) => c.dbCount > 0);
  useEffect(() => {
    if (!moving) return;
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [moving, load]);

  async function connect() {
    setBusy('connect');
    try {
      const { url } = await adminStorageApi.connectUrl(token, window.location.origin);
      window.location.assign(url);
    } catch (e) {
      setNotice({ ok: false, text: e instanceof ApiError ? e.message : 'Không tạo được liên kết kết nối' });
      setBusy(null);
    }
  }

  async function run(name: string, fn: () => Promise<unknown>) {
    setBusy(name);
    try {
      await fn();
      load();
    } catch (e) {
      setNotice({ ok: false, text: e instanceof ApiError ? e.message : 'Thao tác không thành công' });
    } finally {
      setBusy(null);
    }
  }

  if (err) return <div className="rounded-xl bg-critical-tint text-critical text-xs p-4">{err}</div>;
  if (!st) return <div className="rounded-xl bg-white border border-border p-8 text-center text-xs text-ink-faint">Đang tải…</div>;

  const dbFiles = st.categories.reduce((s, c) => s + c.dbBytes, 0);
  const dbCount = st.categories.reduce((s, c) => s + c.dbCount, 0);
  const driveCount = st.categories.reduce((s, c) => s + c.driveCount, 0);
  const driveBytes = st.categories.reduce((s, c) => s + c.driveBytes, 0);
  const dbPct = Math.min(1, st.databaseBytes / SUPABASE_FREE);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-bold text-base">🗄️ Lưu trữ file</h1>
        <p className="text-xs text-ink-faint mt-0.5 max-w-2xl">
          Lưu mọi file tải lên (CV, Kho CV, giấy tờ công ty, ảnh đại diện) vào Google Drive của bạn thay vì trong cơ sở dữ liệu — web nhẹ, không lo đầy gói
          Supabase miễn phí. File trên Drive không có link công khai: người xem vẫn phải qua web và được kiểm tra quyền như trước.
        </p>
      </div>

      {notice && (
        <div className={`rounded-lg text-[12px] px-3 py-2 ${notice.ok ? 'bg-success-tint text-success' : 'bg-critical-tint text-critical'}`} role="status">
          {notice.text}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3">
        <div className="rounded-xl bg-white border border-border p-4">
          <div className="text-[11.5px] text-ink-muted">Cơ sở dữ liệu (Supabase) đang dùng</div>
          <div className="text-[22px] font-extrabold tabular-nums mt-0.5">{fmtBytes(st.databaseBytes)}</div>
          <div className="mt-2 h-2 rounded-full bg-surface-alt overflow-hidden">
            <div className={`h-full rounded-full ${dbPct > 0.8 ? 'bg-critical' : dbPct > 0.6 ? 'bg-warning' : 'bg-info'}`} style={{ width: `${dbPct * 100}%` }} />
          </div>
          <div className="text-[11px] text-ink-faint mt-1">
            {Math.round(dbPct * 100)}% gói miễn phí 500 MB · trong đó file: {fmtBytes(dbFiles)} ({formatNumber(dbCount)} file)
          </div>
        </div>
        <div className="rounded-xl bg-white border border-border p-4">
          <div className="text-[11.5px] text-ink-muted">Đã lưu trên Google Drive</div>
          <div className="text-[22px] font-extrabold tabular-nums mt-0.5">{formatNumber(driveCount)} file</div>
          <div className="text-[11px] text-ink-faint mt-1">{fmtBytes(driveBytes)}</div>
        </div>
        <div className="rounded-xl bg-white border border-border p-4">
          <div className="text-[11.5px] text-ink-muted">Dung lượng tài khoản Google</div>
          {st.quota ? (
            <>
              <div className="text-[22px] font-extrabold tabular-nums mt-0.5">
                {fmtBytes(st.quota.usage)} <span className="text-[12px] font-semibold text-ink-muted">/ {st.quota.limit ? fmtBytes(st.quota.limit) : 'không giới hạn'}</span>
              </div>
              {st.quota.limit && (
                <div className="mt-2 h-2 rounded-full bg-surface-alt overflow-hidden">
                  <div className="h-full rounded-full bg-info" style={{ width: `${Math.min(100, (st.quota.usage / st.quota.limit) * 100)}%` }} />
                </div>
              )}
              <div className="text-[11px] text-ink-faint mt-1">Dùng chung cho Drive, Gmail, Google Photos</div>
            </>
          ) : (
            <div className="text-[12px] text-ink-faint mt-2">{st.connected ? 'Chưa đọc được (thử tải lại)' : 'Chưa kết nối'}</div>
          )}
        </div>
      </div>

      <section className="rounded-xl bg-white border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold text-[13px]">Google Drive</div>
            {st.connected ? (
              <div className="text-[12px] text-success mt-0.5">
                ✓ Đã kết nối {st.accountEmail ? <b>{st.accountEmail}</b> : ''}
                {st.connectedAt ? <span className="text-ink-faint"> · từ {formatDateTime(st.connectedAt)}</span> : null}
              </div>
            ) : (
              <div className="text-[12px] text-ink-muted mt-0.5">Chưa kết nối — file mới vẫn lưu trong cơ sở dữ liệu như trước.</div>
            )}
            {!st.connected && driveCount > 0 && (
              <div className="text-[12px] text-critical mt-1 max-w-2xl">
                ⚠ {formatNumber(driveCount)} file đang nằm trên Google Drive sẽ KHÔNG mở được trên web cho tới khi kết nối lại đúng tài khoản Google trước đây
                {st.accountEmail ? ` (${st.accountEmail})` : ''}.
              </div>
            )}
            {st.lastError && <div className="text-[12px] text-critical mt-1 max-w-2xl">⚠ {st.lastError}</div>}
          </div>
          {isAdmin && st.configured && (
            <div className="flex flex-wrap gap-2">
              <button onClick={connect} disabled={!!busy} className="tvl-btn-primary !w-auto px-4 text-xs">
                {busy === 'connect' ? 'Đang mở Google…' : st.connected ? 'Kết nối lại' : 'Kết nối Google Drive'}
              </button>
              {st.connected && (
                <button
                  onClick={() => {
                    if (
                      confirm(
                        'Ngắt kết nối: file ĐANG nằm trên Drive sẽ KHÔNG mở được trên web cho tới khi kết nối lại ĐÚNG tài khoản Google này. File mới sẽ lưu vào cơ sở dữ liệu. Vẫn ngắt?',
                      )
                    )
                      void run('disconnect', () => adminStorageApi.disconnect(token));
                  }}
                  disabled={!!busy}
                  className="tvl-btn-ghost !w-auto px-4 text-xs"
                >
                  Ngắt kết nối
                </button>
              )}
            </div>
          )}
        </div>

        {st.connected && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="text-[12px] font-semibold">
                Chuyển file cũ từ cơ sở dữ liệu sang Drive{' '}
                {dbCount === 0 ? (
                  <span className="text-success">— đã xong ✓</span>
                ) : st.migrationPaused ? (
                  <span className="text-warning">— đang tạm dừng</span>
                ) : (
                  <span className="text-info">— đang chạy nền (vài file mỗi 2 phút)</span>
                )}
              </div>
              {isAdmin && dbCount > 0 && (
                <div className="flex gap-2">
                  {!st.migrationPaused && (
                    <button onClick={() => void run('now', () => adminStorageApi.migrateNow(token))} disabled={!!busy} className="tvl-btn-ghost !w-auto px-3 text-xs">
                      {busy === 'now' ? 'Đang chuyển…' : 'Chuyển thêm ngay'}
                    </button>
                  )}
                  <button
                    onClick={() => void run('pause', () => adminStorageApi.setMigrationPaused(token, !st.migrationPaused))}
                    disabled={!!busy}
                    className="tvl-btn-ghost !w-auto px-3 text-xs"
                  >
                    {st.migrationPaused ? 'Tiếp tục chuyển' : 'Tạm dừng'}
                  </button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] min-w-[520px]">
                <thead>
                  <tr className="text-left text-[11px] text-ink-faint border-b border-border">
                    <th className="py-1.5 font-semibold">Loại file</th>
                    <th className="py-1.5 font-semibold text-right">Trên Drive</th>
                    <th className="py-1.5 font-semibold text-right">Còn trong CSDL</th>
                    <th className="py-1.5 font-semibold text-right">Dung lượng còn trong CSDL</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {st.categories.map((c) => (
                    <tr key={c.category} className="border-b border-border/60">
                      <td className="py-1.5">{c.label}</td>
                      <td className="py-1.5 text-right">{formatNumber(c.driveCount)}</td>
                      <td className="py-1.5 text-right">{formatNumber(c.dbCount)}</td>
                      <td className="py-1.5 text-right">{fmtBytes(c.dbBytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-ink-faint mt-2">
              Chỗ trống giải phóng được Postgres tự dùng lại cho dữ liệu mới. File trên Drive nằm trong thư mục “TuyenDungViecLam - File cua web (khong
              xoa)” — đừng xoá/đổi tên các file trong đó. File của CV/tài khoản đã bị xoá trên web được tự dọn khỏi Drive.
            </p>
          </div>
        )}
      </section>

      {!st.configured && <SetupGuide redirectUri={st.redirectUri} copied={copied} onCopy={() => setCopied(true)} />}
      {st.configured && !st.connected && (
        <div className="rounded-xl bg-info-tint text-ink text-[12px] p-4">
          Máy chủ đã có mã ứng dụng Google. Bấm <b>“Kết nối Google Drive”</b>, đăng nhập đúng tài khoản Google bạn muốn dùng để lưu file, tích ô cho phép rồi bấm
          “Tiếp tục”. Nếu Google báo lỗi <i>redirect_uri_mismatch</i>, kiểm tra “Authorized redirect URIs” của ứng dụng trong Google Cloud phải đúng y hệt: <code className="text-[11px]">{st.redirectUri}</code>
        </div>
      )}
    </div>
  );
}

function SetupGuide({ redirectUri, copied, onCopy }: { redirectUri: string | null; copied: boolean; onCopy: () => void }) {
  return (
    <section className="rounded-xl bg-white border border-border p-4 text-[12.5px] leading-relaxed">
      <div className="font-bold text-[13px] mb-2">Cài đặt 1 lần (khoảng 15 phút)</div>
      <ol className="list-decimal pl-5 flex flex-col gap-2">
        <li>
          Vào <b>console.cloud.google.com</b> bằng tài khoản Google sẽ dùng để lưu file → tạo Project mới (VD “TuyenDungViecLam”).
        </li>
        <li>
          Vào <b>APIs &amp; Services → Library</b>, tìm <b>Google Drive API</b> → bấm <b>Enable</b>.
        </li>
        <li>
          Vào <b>Google Auth Platform</b> (hoặc “OAuth consent screen”) → chọn loại <b>External</b>, điền tên ứng dụng + email. Ở mục <b>Audience</b> bấm{' '}
          <b>Publish app</b> để chuyển sang <b>In production</b> (bắt buộc — nếu để “Testing”, Google tự thu hồi quyền sau 7 ngày).
        </li>
        <li>
          Vào <b>Clients</b> (hoặc “Credentials”) → <b>Create client</b> → loại <b>Web application</b>. Ở “Authorized redirect URIs” dán đúng địa chỉ:
          {redirectUri && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="text-[11.5px] bg-surface-alt border border-border rounded px-2 py-1 break-all">{redirectUri}</code>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(redirectUri).then(onCopy).catch(() => undefined);
                }}
                className="tvl-btn-ghost !w-auto px-2.5 py-1 text-[11px]"
              >
                {copied ? 'Đã chép ✓' : 'Chép'}
              </button>
            </div>
          )}
        </li>
        <li>
          Bấm Create → chép <b>Client ID</b> và <b>Client secret</b>. Trên <b>Render</b> → dịch vụ API → <b>Environment</b> → thêm 2 biến{' '}
          <code>GOOGLE_CLIENT_ID</code> và <code>GOOGLE_CLIENT_SECRET</code> → Save (Render tự khởi động lại).
        </li>
        <li>Quay lại trang này, tải lại → bấm “Kết nối Google Drive”.</li>
      </ol>
    </section>
  );
}
