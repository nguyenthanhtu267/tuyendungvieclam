'use client';

import Link from '@/components/SmartLink';
import { useEffect, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import { useAuth } from '@/lib/auth-context';
import { workersApi, type WorkerProfileView } from '@/lib/api';
import { GENDER_LABEL, KIND_LABEL, placeText, slotText } from '@/lib/labor';

// Đợt 83 — CV một trang tạo tự động từ hồ sơ lao động phổ thông (sinh viên / thực tập sinh), để in hoặc lưu PDF.
export default function LaborCvPage() {
  const { me, token } = useAuth();
  const [p, setP] = useState<WorkerProfileView | null | undefined>(undefined);
  const [objective, setObjective] = useState('');
  const [skills, setSkills] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        if (me?.role === 'candidate' && token) {
          setP(await workersApi.mine(token));
          return;
        }
        const raw = sessionStorage.getItem('tvl_worker_creds');
        if (!raw) return setP(null);
        const c = JSON.parse(raw) as { phone: string; birthDate: string };
        setP(await workersApi.verify(c.phone, c.birthDate));
      } catch (e) {
        setErr((e as Error).message);
        setP(null);
      }
    })();
  }, [me, token]);

  useEffect(() => {
    if (p && !objective) setObjective(`Tìm vị trí ${p.desiredJobs.join(', ').toLowerCase()} để có thu nhập và tích luỹ kinh nghiệm; sẵn sàng học hỏi và làm việc đúng giờ.`);
  }, [p, objective]);

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="max-w-3xl mx-3 sm:mx-auto my-3 flex flex-col gap-2.5">
        {p === undefined ? (
          <div className="rounded-xl border border-border bg-white p-4 text-[14px] text-ink-muted">Đang tải hồ sơ…</div>
        ) : p === null ? (
          <div className="rounded-xl border border-border bg-white p-4 text-[14px] text-ink">
            {err || 'Chưa có hồ sơ.'} Hãy xác nhận số điện thoại ở trang <Link href="/lao-dong-pho-thong/viec-lam?loai=thuc-tap-sinh" className="font-bold text-primary underline">việc làm</Link> hoặc <Link href="/lao-dong-pho-thong?loai=thuc-tap-sinh" className="font-bold text-primary underline">điền hồ sơ</Link> trước.
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-white p-3 flex flex-col gap-2">
              <div className="text-[13.5px] text-ink">Chỉnh mục tiêu và kỹ năng (không bắt buộc) rồi bấm In / Lưu PDF.</div>
              <label className="text-[13px] font-bold text-ink flex flex-col gap-1" htmlFor="cv-obj">Mục tiêu nghề nghiệp
                <textarea id="cv-obj" rows={2} className="tvl-input font-normal" value={objective} onChange={(e) => setObjective(e.target.value)} />
              </label>
              <label className="text-[13px] font-bold text-ink flex flex-col gap-1" htmlFor="cv-skills">Kỹ năng, hoạt động nổi bật (mỗi dòng một ý)
                <textarea id="cv-skills" rows={3} className="tvl-input font-normal" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder={'Excel cơ bản\nGiao tiếp, làm việc nhóm\nTiếng Anh giao tiếp'} />
              </label>
              <button type="button" onClick={() => window.print()} className="self-start rounded-lg bg-primary text-white font-bold text-[14px] px-4 py-2">In / Lưu PDF</button>
            </div>
            <article id="print-area" className="rounded-xl border border-border bg-white p-6 sm:p-8 text-ink print:border-0 print:p-0">
              <h1 className="font-extrabold text-[26px] uppercase">{p.fullName}</h1>
              <div className="text-[14px] mt-0.5">{KIND_LABEL[p.kind]} · {GENDER_LABEL[p.gender]} · Sinh ngày {new Date(p.birthDate).toLocaleDateString('vi-VN')}</div>
              <div className="text-[14px]">Điện thoại: <b>{p.phone}</b> · Địa chỉ: {placeText(p)}{p.addressDetail ? `, ${p.addressDetail}` : ''}</div>
              <hr className="my-3 border-border-strong" />
              <h2 className="font-extrabold text-[15px] uppercase">Mục tiêu nghề nghiệp</h2>
              <p className="text-[14px] whitespace-pre-line">{objective}</p>
              <h2 className="font-extrabold text-[15px] uppercase mt-3">Học vấn</h2>
              <p className="text-[14px]">{[p.school, p.major].filter(Boolean).join(' — ') || '—'}</p>
              <h2 className="font-extrabold text-[15px] uppercase mt-3">Vị trí mong muốn</h2>
              <p className="text-[14px]">{p.desiredJobs.join(', ')}{p.radiusKm ? ` · trong bán kính ${p.radiusKm} km` : ''}</p>
              {p.availability && p.availability.length > 0 && (<><h2 className="font-extrabold text-[15px] uppercase mt-3">Thời gian có thể làm việc</h2><p className="text-[14px]">{slotText(p.availability)}</p></>)}
              {skills.trim() && (<><h2 className="font-extrabold text-[15px] uppercase mt-3">Kỹ năng &amp; hoạt động</h2><ul className="list-disc pl-5 text-[14px]">{skills.split('\n').filter((x) => x.trim()).map((x) => (<li key={x}>{x}</li>))}</ul></>)}
              <div className="text-[12px] text-ink-muted mt-4">Tạo từ hồ sơ trên Tuyển Dụng Việc Làm.</div>
            </article>
          </>
        )}
      </div>
    </main>
  );
}
