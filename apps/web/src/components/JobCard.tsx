'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/components/SmartLink';
import type { JobPosting } from '@/lib/api';
import { track } from '@/lib/analytics';
import { candidatesApi, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatSalaryTag, isNewJob, toTrieu } from '@/lib/format';
import { CompanyLogo } from '@/components/CompanyLogo';
import { scamWarnings } from '@/lib/scam';
import { SourcedBadge, isCompanyUnverified } from '@/components/SourcedBadge';
import { matchTone, useMatches } from '@/lib/match';
import { useCompare } from '@/lib/compare';
import { distanceLabel, useHomePlace } from '@/lib/geo';
import { FitText } from '@/components/FitText';
import { bumpSavedCount } from '@/lib/saved-count';
import { useJobNotes } from '@/components/JobNote';

// Đợt 10 — thẻ việc làm theo mục 4 đặc tả: tiêu đề đậm + badge (MỚI) chữ đỏ trong ngoặc (không phải
// pill), dòng lương đỏ, nhiều tỉnh ngăn bởi "|", hạn nộp/cập nhật, tag phúc lợi có icon, nút đỏ
// "ỨNG TUYỂN NGAY" + icon tim lưu việc.
export function JobCard({
  job,
  saved,
  onToggleSaved,
}: {
  job: JobPosting;
  saved?: boolean;
  onToggleSaved?: (jobId: string, nowSaved: boolean) => void;
}) {
  const router = useRouter();
  const { me, token } = useAuth();
  const [isSaved, setIsSaved] = useState(!!saved);
  const [busy, setBusy] = useState(false);
  const match = useMatches([job.id])[job.id];
  const compare = useCompare();
  const home = useHomePlace();
  const dist = home ? distanceLabel(home, job.provinces ?? []) : null;
  const inCompare = compare.has(job.id);
  const [compareMsg, setCompareMsg] = useState('');
  const myNote = useJobNotes()[job.id];

  const locationText = job.provinces?.length ? job.provinces.join(' | ') : job.location;

  async function handleToggleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!me || !token) {
      router.push('/dang-nhap');
      return;
    }
    setBusy(true);
    try {
      track(isSaved ? 'unsave_job' : 'save_job', { entityType: 'job', entityId: job.id });
      if (isSaved) {
        await candidatesApi.unsaveJob(token, job.id);
        setIsSaved(false);
        bumpSavedCount(-1);
        onToggleSaved?.(job.id, false);
      } else {
        await candidatesApi.saveJob(token, job.id);
        setIsSaved(true);
        bumpSavedCount(1);
        onToggleSaved?.(job.id, true);
      }
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setBusy(false);
    }
  }

  function handleApplyNow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/viec-lam/${job.id}?apply=1`);
  }

  // Đợt 12aa (24/09/2026) — badge "URGENT" (tin ưu tiên) thiết kế lại theo mẫu careerviet.vn: thẻ
  // nền hồng nhạt + viền hồng, badge có icon tia sét ⚡ và chữ tiếng Anh "URGENT" giống mẫu (thay
  // cho pill "ƯU TIÊN" nhỏ trước đây), để nổi bật hơn giữa danh sách tin thường.
  // Đợt 14 (25/09/2026) — mục 13 danh sách lỗi: 2 thay đổi theo yêu cầu người dùng (không có ảnh
  // mẫu cụ thể, tự thiết kế theo mô tả bằng lời):
  //  1. Badge "URGENT" chuyển vào CÙNG dòng tiêu đề, ngay sau "(MỚI)" — trước đây là 1 khối riêng
  //     phía trên tiêu đề, tách biệt với "(MỚI)".
  //  2. Nút "ỨNG TUYỂN NGAY" to hơn, chuyển sang cột riêng bên PHẢI thẻ (căn giữa theo chiều dọc so
  //     với khối nội dung), thay vì nằm ở dòng cuối cùng bên dưới tag phúc lợi như trước. Dùng
  //     flex-wrap để tự động xuống dòng khi thẻ quá hẹp (vẫn giữ đúng bố cục ở lưới sm:grid-cols-2).
  return (
    <Link
      href={`/viec-lam/${job.id}`}
      className={`relative flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-xl border p-4 transition-all ${
        job.isUrgent
          ? 'border-critical/30 bg-[#FDF0F1] hover:border-critical hover:shadow-sm'
          : 'border-border bg-white hover:border-primary hover:shadow-sm'
      }`}
    >
      {/* Đợt 13 (24/09/2026) — mục 4 danh sách lỗi: logo công ty trên thẻ việc làm quá nhỏ so với
          các trang khác (chi tiết tin, trang công ty đều dùng size lớn hơn). Tăng 44→60px + cỡ chữ
          initials theo tỷ lệ để không bị vỡ layout khi công ty chưa có logoUrl. */}
      <CompanyLogo name={job.company.name} logoUrl={job.company.logoUrl} size={80} className="text-base" reserveSpace />
      <div className="flex-1 min-w-0 sm:pr-6">
        <div className="font-bold text-[13.5px] text-ink">
          {job.title}
          {isNewJob(job.createdAt) && <span className="text-critical font-extrabold ml-1.5">(MỚI)</span>}
          {match && (
            <span
              className={`inline-flex items-center ml-1.5 align-middle text-[11px] font-extrabold px-1.5 py-0.5 rounded ${matchTone(match.score).cls}`}
              title={[`Độ phù hợp với hồ sơ của bạn: ${match.score}%`, ...match.reasons.map((r) => `✔ ${r}`), ...match.gaps.map((g) => `• ${g}`)].join('\n')}
              data-testid="match-badge"
            >
              ✨ Phù hợp {match.score}%
            </span>
          )}
          {scamWarnings(job).length > 0 && (
            <span
              className="inline-flex items-center ml-1.5 align-middle text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-warning-tint text-[#7A4A00] border border-warning"
              title={scamWarnings(job).join('\n')}
            >
              ⚠ Cẩn trọng
            </span>
          )}
          {job.isUrgent && (
            <span className="inline-flex items-center gap-1 ml-1.5 align-middle text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-critical text-white tracking-wide">
              ⚡ URGENT
            </span>
          )}
          {Math.max(toTrieu(job.salaryMin) ?? 0, toTrieu(job.salaryMax) ?? 0) >= 50 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push('/viec-lam?salaryTier=50');
              }}
              title="Xem các tin có lương từ 50 triệu trở lên"
              className="tap-slop relative inline-flex items-center ml-1.5 align-middle text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#FFD84D] text-[#5A3A00] border border-[#C99A00] tracking-wide hover:brightness-95"
            >
              ★ CAO CẤP
            </button>
          )}
        </div>
        <div className="text-xs text-ink-muted mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="min-w-0 flex-1 basis-[11rem] max-w-full">
            <FitText lines={2} min={0.75} className="co-name">{job.company.name}</FitText>
          </span>
          {isCompanyUnverified(job.company) && <span className="shrink-0"><SourcedBadge /></span>}
        </div>

        <div className="text-critical font-bold text-[12.5px] mt-1.5 flex items-center gap-2 flex-wrap">
          <span>$ {formatSalaryTag(job.salaryMin, job.salaryMax)}</span>
          {/* Đợt 104 — nhãn "đi làm được ngay": tin không đòi kinh nghiệm. */}
          {(job.experienceLevel === 'Không yêu cầu kinh nghiệm' || job.experienceLevel === 'Chưa có kinh nghiệm') && (
            <span className="rounded bg-success-tint text-success text-[10.5px] font-extrabold px-1.5 py-0.5 border border-success/40">🌱 Không cần kinh nghiệm</span>
          )}
        </div>

        {/* Đợt 44 — địa điểm hiện ĐỦ (không cắt "Hồ..."), rồi theo trình tự thời gian: Cập nhật → Hạn nộp. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[11.5px] text-ink-faint">
          {locationText && <span className="whitespace-nowrap">📍 {locationText}</span>}
          {dist && <span className="whitespace-nowrap text-primary" title="Ước tính từ nơi ở của bạn">🚗 {dist}</span>}
          <span className="whitespace-nowrap max-sm:hidden">Cập nhật: {formatDate(job.updatedAt ?? job.createdAt)}</span>
          {job.deadline && <span className="whitespace-nowrap">Hạn nộp: {formatDate(job.deadline)}</span>}
          {(() => {
            // Đợt 101 — nhãn đỏ "Còn N ngày" khi tin sắp hết hạn nộp (≤ 3 ngày), để người xem biết cần nộp sớm.
            if (!job.deadline) return null;
            const t0 = new Date(); t0.setHours(0, 0, 0, 0);
            const left = Math.round((new Date(job.deadline.slice(0, 10) + 'T00:00:00').getTime() - t0.getTime()) / 86400000);
            if (left < 0 || left > 3) return null;
            return <span className="whitespace-nowrap rounded bg-critical text-white text-[10.5px] font-extrabold px-1.5 py-0.5">⏰ {left === 0 ? 'Hết hạn hôm nay' : `Còn ${left} ngày`}</span>;
          })()}
          {/* Đợt 59 — "Việc tương tự": lọc cùng ngành + cấp bậc + tỉnh đầu tiên của tin này. */}
          {(job.industry || job.level) && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const qs = new URLSearchParams();
                if (job.industry) qs.set('industries', job.industry);
                if (job.level) qs.set('level', job.level);
                const pv = job.provinces?.[0] ?? job.location;
                if (pv) qs.set('provinces', pv);
                router.push(`/viec-lam?${qs.toString()}`);
              }}
              className="tap-slop relative whitespace-nowrap text-primary font-semibold hover:underline max-sm:hidden"
            >
              ≈ Việc tương tự
            </button>
          )}
        </div>

        {myNote && (myNote.pinned || myNote.note) && <div className="mt-1.5 text-[12px] font-semibold text-ink bg-warning-tint rounded px-2 py-1">📌 {myNote.note || 'Đã ghim'}</div>}

        {/* Đợt 100 — điện thoại: 1 dòng "vì sao hợp với bạn" (lý do đầu tiên của độ phù hợp) thay cho ngày cập nhật / việc tương tự. */}
        {match?.reasons?.[0] && <div className="sm:hidden mt-1.5 text-[12px] text-primary font-semibold truncate">✔ {match.reasons[0]}</div>}

        {/* Đợt 15 (25/09/2026) — mục 17 danh sách lỗi: bỏ hẳn khối chip "Phúc lợi" khỏi thẻ tin (theo
            yêu cầu người dùng: "Phần phúc lợi không cần hiển thị ở đây để bảng thông tin của công ty
            ít hơn") — thẻ tin gọn hơn. Phúc lợi đầy đủ vẫn xem được ở trang chi tiết tin
            (/viec-lam/[id], mục "Phúc lợi"), không đụng gì tới trang đó hay dữ liệu backend. */}
      </div>

      {/* Đợt 91 — điện thoại: ♡ + ⇄ nằm CẠNH nút Ứng tuyển, mỗi nút cao 44px (đủ ngón tay, không đè lên tiêu đề → không bấm nhầm).
          Máy tính: giữ nguyên vị trí góc trên phải của thẻ. */}
      <div className="w-full sm:w-auto shrink-0 pt-1 sm:pt-0 sm:[@media(pointer:coarse)]:pt-8 flex items-stretch gap-2 sm:block">
        <button
          type="button"
          onClick={handleApplyNow}
          className="flex-1 sm:flex-none sm:w-auto bg-critical text-white text-[13px] font-extrabold tracking-wide rounded-lg px-6 py-2.5 max-sm:min-h-[44px] hover:brightness-95"
        >
          ỨNG TUYỂN NGAY
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const r = compare.toggle({ id: job.id, title: job.title });
            setCompareMsg(r === 'full' ? 'Tối đa 3 tin' : '');
          }}
          aria-pressed={inCompare}
          aria-label={inCompare ? 'Bỏ khỏi so sánh' : 'Thêm vào so sánh'}
          title={compareMsg || (inCompare ? 'Bỏ khỏi so sánh' : 'Thêm vào so sánh')}
          className={`tvl-touch-big sm:absolute sm:top-2.5 sm:right-[46px] shrink-0 max-sm:h-11 max-sm:min-w-[44px] max-sm:text-base max-sm:flex max-sm:items-center max-sm:justify-center text-[11px] font-semibold rounded px-1.5 py-0.5 max-sm:border-2 border ${
            inCompare ? 'bg-primary text-white border-primary' : 'text-ink-faint border-border hover:text-primary hover:border-primary max-sm:bg-white max-sm:text-ink-muted max-sm:border-border-strong'
          }`}
        >
          <span className="sm:hidden">{compareMsg ? '3/3' : inCompare ? '✓' : '⇄'}</span>
          <span className="hidden sm:inline">{compareMsg || (inCompare ? '✓ So sánh' : '⇄ So sánh')}</span>
        </button>
        <button
          type="button"
          onClick={handleToggleSave}
          disabled={busy}
          aria-label={isSaved ? 'Bỏ lưu việc làm' : 'Lưu việc làm'}
          className={`tvl-touch-big sm:absolute sm:top-3 sm:right-3 shrink-0 text-base leading-none max-sm:h-11 max-sm:min-w-[44px] max-sm:text-xl max-sm:rounded max-sm:border-2 max-sm:border-border-strong max-sm:bg-white max-sm:flex max-sm:items-center max-sm:justify-center ${isSaved ? 'text-critical' : 'text-ink-faint hover:text-critical'}`}
        >
          {isSaved ? '♥' : '♡'}
        </button>
      </div>
    </Link>
  );
}
