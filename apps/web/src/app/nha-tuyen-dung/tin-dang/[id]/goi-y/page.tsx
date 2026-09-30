'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import EmployerHeader from '@/components/EmployerHeader';
import SuggestedCandidates from '@/components/SuggestedCandidates';

export default function GoiYHoSoPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <main className="min-h-screen">
      <EmployerHeader />
      <div className="max-w-3xl mx-3 sm:mx-auto my-3 px-4 sm:px-6 py-5 flex flex-col gap-3 rounded-2xl border border-border bg-white">
        <Link href="/nha-tuyen-dung/tin-dang" className="text-[14px] underline text-ink-muted">← Quản lý tin đăng</Link>
        <h1 className="font-extrabold text-2xl text-ink">Hồ sơ gợi ý cho tin này</h1>
        <p className="text-[15px] text-ink-muted">Top 10 hồ sơ phù hợp nhất theo kỹ năng, kinh nghiệm, cấp bậc, lương, địa điểm. Tên được che cho đến khi bạn mở khoá hồ sơ.</p>
        <SuggestedCandidates jobId={id} />
      </div>
    </main>
  );
}
