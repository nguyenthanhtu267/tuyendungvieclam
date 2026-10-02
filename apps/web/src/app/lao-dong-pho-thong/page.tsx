import SiteHeader from '@/components/SiteHeader';
import { WorkerForm } from '@/components/labor/WorkerForm';
import { SLUG_KIND } from '@/lib/labor';
import Link from '@/components/SmartLink';

export const metadata = { title: 'Tìm việc công nhân, sinh viên, thực tập sinh' };

const HEAD: Record<string, { t: string; d: string }> = {
  worker: { t: 'DÀNH RIÊNG TUYỂN CÔNG NHÂN', d: 'Không cần CV, không cần tài khoản. Điền thông tin một lần — nhà tuyển dụng gần nơi bạn ở sẽ gọi điện trực tiếp.' },
  student: { t: 'SINH VIÊN', d: 'Việc bán thời gian, ca linh hoạt gần trường, gần nhà. Điền một lần — nhà tuyển dụng tự liên hệ bạn.' },
  intern: { t: 'THỰC TẬP SINH', d: 'Tìm nơi thực tập đúng ngành học. Điền một lần — doanh nghiệp cần thực tập sinh sẽ liên hệ bạn.' },
};

// Đợt 79 — trang đăng ký tìm việc lao động phổ thông (công nhân / sinh viên / thực tập sinh), không bắt buộc đăng nhập.
export default function LaborRegisterPage({ searchParams }: { searchParams: { loai?: string; ungtuyen?: string } }) {
  const kind = SLUG_KIND[searchParams.loai ?? ''] ?? 'worker';
  const h = HEAD[kind];
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="max-w-3xl mx-3 sm:mx-auto my-3 flex flex-col gap-3">
        <section className={`rounded-xl border p-4 ${kind === 'worker' ? 'border-warning bg-[#FFD84D]' : 'border-border bg-white'}`}>
          <h1 className={`font-extrabold text-[22px] sm:text-[26px] uppercase ${kind === 'worker' ? 'text-[#C8102E]' : 'text-ink'}`}>{h.t}</h1>
          <p className="text-[15px] text-ink mt-1">{h.d}</p>
          {searchParams.ungtuyen && <p className="text-[14px] font-bold text-primary mt-1">Điền xong, hệ thống sẽ tự nộp đơn ứng tuyển cho tin bạn vừa chọn.</p>}
          <p className="text-[13.5px] text-ink mt-1">
            Đã đăng ký rồi? Cứ nhập lại số điện thoại — hệ thống sẽ báo và cho bạn <b>sửa</b> hoặc <b>làm mới</b> thông tin.{' '}
            <Link href={`/lao-dong-pho-thong/viec-lam?loai=${searchParams.loai ?? 'cong-nhan'}`} className="font-bold text-primary underline">Xem việc đang tuyển</Link>
          </p>
        </section>
        <WorkerForm initialKind={kind} applyJobId={/^[0-9a-f-]{36}$/i.test(searchParams.ungtuyen ?? '') ? searchParams.ungtuyen : undefined} />
      </div>
    </main>
  );
}
