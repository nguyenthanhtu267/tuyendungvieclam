'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import EmployerHeader from '@/components/EmployerHeader';
import { useAuth } from '@/lib/auth-context';
import { employerApi, type EmployerJob, type EmployerJobStatus, type EmployerJobStatusCounts } from '@/lib/api';
import { EMPLOYER_JOB_STATUS_CLASS, EMPLOYER_JOB_STATUS_LABEL, formatDate } from '@/lib/format';
import { jobShareUrl, openFacebookShare } from '@/lib/social';

// Đợt 11b — Mục #4 ATS: trang quản lý tin đăng của NTD, 4 tab trạng thái (đang đăng/chờ đăng/
// tạm ngưng/hết hạn) + số lượng từng trạng thái, thao tác tạm ngưng/đăng lại/nhân bản tin.
const TABS: { value: EmployerJobStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'dang_dang', label: 'Đang đăng' },
  { value: 'cho_dang', label: 'Chờ đăng' },
  { value: 'tam_ngung', label: 'Tạm ngưng' },
  { value: 'het_han', label: 'Hết hạn' },
];

export default function TinDangPage() {
  const router = useRouter();
  const { me, token } = useAuth();
  const [tab, setTab] = useState<EmployerJobStatus | 'all'>('all');
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [counts, setCounts] = useState<EmployerJobStatusCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && !me.role.startsWith('employer')) router.replace('/');
  }, [me, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [list, c] = await Promise.all([
        employerApi.listJobs(token, tab === 'all' ? undefined : tab),
        employerApi.getJobStatusCounts(token),
      ]);
      setJobs(list);
      setCounts(c);
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePauseToggle(job: EmployerJob) {
    if (!token) return;
    setActingId(job.id);
    setErrorMsg('');
    try {
      if (job.employerStatus === 'tam_ngung') await employerApi.resumeJob(token, job.id);
      else await employerApi.pauseJob(token, job.id);
      await load();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
    } finally {
      setActingId(null);
    }
  }

  async function handleDuplicate(job: EmployerJob) {
    if (!token) return;
    setActingId(job.id);
    setErrorMsg('');
    try {
      await employerApi.duplicateJob(token, job.id);
      await load();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
    } finally {
      setActingId(null);
    }
  }

  if (!me || !me.role.startsWith('employer')) return null;

  return (
    <main className="min-h-screen bg-bg">
      <EmployerHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="font-extrabold text-base uppercase">Quản lý tin đăng</h1>
          <Link href="/nha-tuyen-dung/dang-tin" className="tvl-btn-primary !w-auto px-5">
            + Đăng tin mới
          </Link>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-critical-tint text-critical text-xs font-semibold px-3.5 py-2.5">{errorMsg}</div>
        )}

        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3.5 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 -mb-px flex items-center gap-1.5 ${
                tab === t.value ? 'text-primary border-primary' : 'text-ink-faint border-transparent'
              }`}
            >
              {t.label}
              {counts && t.value !== 'all' && (
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                    tab === t.value ? 'bg-primary text-white' : 'bg-surface-alt text-ink-faint'
                  }`}
                >
                  {counts[t.value]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-white border border-border overflow-hidden">
          {loading ? (
            <div className="text-center text-ink-faint py-10 text-sm">Đang tải…</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center gap-3">
              <div className="text-ink-faint text-sm">Không có tin đăng nào ở trạng thái này.</div>
              <Link href="/nha-tuyen-dung/dang-tin" className="tvl-btn-primary !w-auto px-5">
                + Đăng tin đầu tiên
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-faint bg-surface-alt">
                    <th className="py-2.5 px-4 font-semibold">Vị trí</th>
                    <th className="py-2.5 px-3 font-semibold">Ngày đăng</th>
                    <th className="py-2.5 px-3 font-semibold">Hạn nộp</th>
                    <th className="py-2.5 px-3 font-semibold">Trạng thái</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Hồ sơ</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const status = job.employerStatus ?? 'khac';
                    const canPauseResume = status === 'dang_dang' || status === 'tam_ngung';
                    return (
                      <tr key={job.id} className="border-t border-border align-top">
                        <td className="py-3 px-4 font-bold max-w-xs">{job.title}</td>
                        <td className="py-3 px-3 tabular-nums whitespace-nowrap">{formatDate(job.createdAt)}</td>
                        <td className="py-3 px-3 tabular-nums whitespace-nowrap">
                          {job.deadline ? formatDate(job.deadline) : '—'}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${EMPLOYER_JOB_STATUS_CLASS[status]}`}
                          >
                            {EMPLOYER_JOB_STATUS_LABEL[status]}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          <Link
                            href={`/nha-tuyen-dung/ung-vien?jobId=${job.id}`}
                            className="text-primary font-bold hover:underline"
                          >
                            {job.applicationCount}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <Link
                              href={`/nha-tuyen-dung/ung-vien?jobId=${job.id}`}
                              className="rounded-lg border border-border px-2.5 py-1.5 font-semibold text-ink-muted hover:bg-surface-alt whitespace-nowrap"
                            >
                              Xem ứng viên
                            </Link>
                            {/* Đợt 12l (21/09/2026) — "Xem trước" mở tab mới, xem tin đúng như ứng
                                viên sẽ thấy, hoạt động với MỌI trạng thái (kể cả chờ duyệt/tạm ngưng)
                                vì dùng trang preview riêng của NTD (/nha-tuyen-dung/xem-tin/[id]),
                                khác trang công khai /viec-lam/[id] chỉ xem được khi tin đang đăng. */}
                            <Link
                              href={`/nha-tuyen-dung/xem-tin/${job.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-border px-2.5 py-1.5 font-semibold text-ink-muted hover:bg-surface-alt whitespace-nowrap"
                            >
                              Xem trước
                            </Link>
                            <Link
                              href={`/nha-tuyen-dung/dang-tin?edit=${job.id}`}
                              className="rounded-lg border border-border px-2.5 py-1.5 font-semibold text-ink-muted hover:bg-surface-alt whitespace-nowrap"
                            >
                              Sửa
                            </Link>
                            {/* Đợt 12e — chỉ hiện khi tin đang đăng công khai thật (link mới xem được,
                                khớp với jobs.service.ts baseQuery: approvalStatus=APPROVED && !isPaused). */}
                            {status === 'dang_dang' && (
                              <button
                                onClick={() => openFacebookShare(jobShareUrl(job.id))}
                                className="rounded-lg border border-info/30 px-2.5 py-1.5 font-semibold text-info hover:bg-info-tint whitespace-nowrap"
                              >
                                Chia sẻ Facebook
                              </button>
                            )}
                            {canPauseResume && (
                              <button
                                onClick={() => handlePauseToggle(job)}
                                disabled={actingId === job.id}
                                className="rounded-lg border border-border px-2.5 py-1.5 font-semibold text-ink-muted hover:bg-surface-alt whitespace-nowrap disabled:opacity-50"
                              >
                                {status === 'tam_ngung' ? 'Đăng lại' : 'Tạm ngưng'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDuplicate(job)}
                              disabled={actingId === job.id}
                              className="rounded-lg border border-border px-2.5 py-1.5 font-semibold text-ink-muted hover:bg-surface-alt whitespace-nowrap disabled:opacity-50"
                            >
                              Sao chép tin
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
