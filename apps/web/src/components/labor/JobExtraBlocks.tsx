'use client';

import { useEffect, useState } from 'react';
import { workersApi, type FitResult, type JobExtra, type WorkerKind } from '@/lib/api';
import { CERT_LABEL, EXPERIENCE_LABEL } from '@/lib/labor';
import { ANSWER_TIPS } from '@/lib/labor-extra';
import type { useWorkerApply } from './WorkerCreds';

/** Đợt 84 — liệt kê yêu cầu/điều kiện riêng của tin theo nhóm (đọc từ laborExtra). */
export function extraLines(kind: WorkerKind, e?: JobExtra | null): string[] {
  if (!e) return [];
  const out: string[] = [];
  if (kind === 'intern') {
    if (e.months) out.push(`Thời gian thực tập: ${e.months} tháng`);
    if (e.sessions) out.push(`${e.sessions} buổi/tuần`);
    if (e.allowance) out.push(`Trợ cấp: ${e.allowance.toLocaleString('vi-VN')} triệu/tháng`);
    if (e.year) out.push(`Sinh viên từ năm ${e.year}`);
    if (e.majors) out.push(`Ngành ưu tiên: ${e.majors}`);
  } else if (kind === 'student') {
    if (e.hourlyPay) out.push(`Lương: ${e.hourlyPay.toLocaleString('vi-VN')} đồng/giờ`);
    if (e.hours) out.push(`~${e.hours} giờ/tuần`);
    // Đợt 105 — quy ra tháng để dễ so sánh với tin trả lương tháng (1 tháng ≈ 4,3 tuần).
    if (e.hourlyPay && e.hours) out.push(`≈ ${(Math.round((e.hourlyPay * e.hours * 4.3) / 100000) / 10).toLocaleString('vi-VN')} triệu/tháng (ước tính)`);
  } else {
    if (e.ageMin || e.ageMax) out.push(`Tuổi ${e.ageMin ?? '…'}–${e.ageMax ?? '…'}`);
    if (e.experience) out.push(`Kinh nghiệm: ${EXPERIENCE_LABEL[e.experience] ?? e.experience}`);
    if (e.bike) out.push('Cần có xe máy');
    if (e.health) out.push('Cần giấy khám sức khoẻ');
    for (const c of e.certs ?? []) out.push(`Cần ${CERT_LABEL[c] ?? c}`);
    if (e.docs) out.push(`Giấy tờ: ${e.docs}`);
  }
  return out;
}

/** Khung "Yêu cầu của tin so với hồ sơ của bạn": còn thiếu gì, đã khớp gì (chỉ khi đã nhập SĐT + ngày sinh hoặc đăng nhập). */
export function FitBox({ jobId, w }: { jobId: string; w: ReturnType<typeof useWorkerApply> }) {
  const [fit, setFit] = useState<FitResult | null>(null);
  useEffect(() => {
    if (!w.ready) return setFit(null);
    const p = w.isCandidate ? workersApi.fitMine(w.token!, jobId) : w.creds ? workersApi.fit(jobId, w.creds.phone, w.creds.birthDate) : null;
    p?.then(setFit).catch(() => setFit(null));
  }, [jobId, w.ready, w.isCandidate, w.token, w.creds]);
  if (!fit || (!fit.ok.length && !fit.missing.length && !fit.hint.length && !fit.minorUnsafe)) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-white p-2.5 text-[13.5px] text-ink flex flex-col gap-1">
      <div className="font-extrabold text-[14.5px]">So với hồ sơ của bạn{fit.percent != null && <> — khớp {fit.percent}%</>}</div>
      {fit.minorUnsafe && <div role="alert" className="font-bold text-critical">Bạn chưa đủ 18 tuổi: {fit.minorUnsafe}. Hệ thống sẽ không cho ứng tuyển tin này.</div>}
      {fit.missing.length > 0 && <ul className="list-disc pl-5 text-critical font-bold">{fit.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
      {fit.hint.length > 0 && <ul className="list-disc pl-5">{fit.hint.map((m) => <li key={m}>{m}</li>)}</ul>}
      {fit.ok.length > 0 && <div className="text-success font-bold">Đã khớp: {fit.ok.join(' · ')}</div>}
      {fit.missing.length > 0 && <div className="text-[12.5px] text-ink-muted">Thiếu một vài mục vẫn có thể ứng tuyển — nhà tuyển dụng sẽ quyết định. Hãy hỏi rõ khi được gọi.</div>}
    </div>
  );
}

export function AnswerTips({ kind }: { kind: WorkerKind }) {
  return (
    <details className="rounded-lg border border-border bg-white">
      <summary className="cursor-pointer px-3 py-2 text-[14px] font-extrabold text-ink">Gợi ý trả lời khi nhà tuyển dụng hỏi</summary>
      <ul className="pl-3 pr-3 pb-3 text-[13.5px] text-ink flex flex-col gap-1.5">
        {ANSWER_TIPS[kind].map((t) => (
          <li key={t.q}><b>{t.q}</b><div className="text-ink-muted">{t.a}</div></li>
        ))}
      </ul>
    </details>
  );
}
