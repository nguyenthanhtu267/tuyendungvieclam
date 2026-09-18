'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import EmployerHeader from '@/components/EmployerHeader';
import { useAuth } from '@/lib/auth-context';
import { employerApi, type EmployerJob, type EmployerApplication, type ApplicationStatus } from '@/lib/api';
import { APPLICATION_STATUS_CLASS, APPLICATION_STATUS_LABEL, formatDate } from '@/lib/format';

const STATUS_TABS: { value: ApplicationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'new', label: 'Mới ứng tuyển' },
  { value: 'reviewing', label: 'Đang xem xét' },
  { value: 'suitable', label: 'Phù hợp' },
  { value: 'interview', label: 'Mời phỏng vấn' },
  { value: 'rejected', label: 'Từ chối' },
];

export default function UngVienPage() {
  const router = useRouter();
  const { me, token } = useAuth();
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [jobId, setJobId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [applicants, setApplicants] = useState<EmployerApplication[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (me === null) router.replace('/dang-nhap');
    else if (me && !me.role.startsWith('employer')) router.replace('/');
  }, [me, router]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoadingJobs(true);
      try {
        const list = await employerApi.listJobs(token);
        setJobs(list);
        if (list.length > 0) setJobId(list[0].id);
      } finally {
        setLoadingJobs(false);
      }
    })();
  }, [token]);

  const loadApplicants = useCallback(async () => {
    if (!token || !jobId) return;
    setLoadingApplicants(true);
    try {
      const list = await employerApi.listApplicants(token, jobId, statusFilter === 'all' ? undefined : statusFilter);
      setApplicants(list);
    } finally {
      setLoadingApplicants(false);
    }
  }, [token, jobId, statusFilter]);

  useEffect(() => {
    loadApplicants();
  }, [loadApplicants]);

  async function handleStatusChange(applicationId: string, status: ApplicationStatus) {
    if (!token) return;
    setUpdatingId(applicationId);
    try {
      await employerApi.updateApplicationStatus(token, applicationId, status);
      await loadApplicants();
    } finally {
      setUpdatingId(null);
    }
  }

  if (!me || !me.role.startsWith('employer')) return null;

  const currentJob = jobs.find((j) => j.id === jobId);

  return (
    <main className="min-h-screen bg-bg">
      <EmployerHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col gap-4">
        {loadingJobs ? (
          <div className="text-center text-ink-faint py-10 text-sm">Đang tải…</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center gap-3">
            <div className="text-ink-faint text-sm">Bạn chưa có tin tuyển dụng nào để quản lý ứng viên.</div>
            <Link href="/nha-tuyen-dung/dang-tin" className="tvl-btn-primary !w-auto px-5">
              + Đăng tin đầu tiên
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h1 className="font-extrabold text-base uppercase">{currentJob?.title}</h1>
              <select className="tvl-input !w-auto text-sm" value={jobId} onChange={(e) => setJobId(e.target.value)}>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} ({j.applicationCount} hồ sơ)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-1 border-b border-border overflow-x-auto">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-3.5 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 -mb-px ${
                    statusFilter === tab.value ? 'text-primary border-primary' : 'text-ink-faint border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="rounded-xl bg-white border border-border overflow-hidden">
              {loadingApplicants ? (
                <div className="text-center text-ink-faint py-10 text-sm">Đang tải…</div>
              ) : applicants.length === 0 ? (
                <div className="text-center text-ink-faint py-10 text-sm">Chưa có hồ sơ ứng tuyển nào ở trạng thái này</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-faint bg-surface-alt">
                        <th className="py-2.5 px-4 font-semibold">Ứng viên</th>
                        <th className="py-2.5 px-3 font-semibold">Ngày nộp</th>
                        <th className="py-2.5 px-3 font-semibold">Trạng thái</th>
                        <th className="py-2.5 px-3 font-semibold">CV</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Cập nhật trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applicants.map((app) => (
                        <tr key={app.id} className="border-t border-border align-top">
                          <td className="py-3 px-4">
                            <div className="font-bold">{app.cv.candidateProfile.fullName}</div>
                            <div className="text-ink-faint mt-0.5">
                              {app.cv.candidateProfile.desiredPosition ?? 'Chưa cập nhật vị trí mong muốn'}
                            </div>
                            {app.coverLetter && (
                              <div className="text-ink-faint mt-1 italic max-w-xs">&quot;{app.coverLetter}&quot;</div>
                            )}
                          </td>
                          <td className="py-3 px-3 tabular-nums whitespace-nowrap">{formatDate(app.appliedAt)}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${APPLICATION_STATUS_CLASS[app.status]}`}>
                              {APPLICATION_STATUS_LABEL[app.status]}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {app.cv.fileUrl ? (
                              <a
                                className="text-primary font-semibold"
                                href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${app.cv.fileUrl}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Xem CV
                              </a>
                            ) : app.cv.externalLinkUrl ? (
                              <a className="text-primary font-semibold" href={app.cv.externalLinkUrl} target="_blank" rel="noreferrer">
                                Xem CV (Drive)
                              </a>
                            ) : (
                              <span className="text-ink-faint">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <select
                              className="tvl-input !w-auto text-xs py-1.5"
                              value={app.status}
                              disabled={updatingId === app.id}
                              onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                            >
                              {STATUS_TABS.filter((t) => t.value !== 'all').map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
