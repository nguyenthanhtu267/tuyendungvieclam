'use client';

import Link from 'next/link';
import { askQuestion } from '@/lib/ask';

// Đợt 65 — hiện câu trả lời nhanh khi ô tìm kiếm trông giống một câu hỏi.
export default function AskAnswerBox({ text }: { text: string }) {
  const a = askQuestion(text);
  if (!a) return null;
  return (
    <div className="rounded-lg bg-surface-alt border border-border p-3 text-[13px] text-ink" role="status">
      <div className="font-extrabold text-[12px] text-primary uppercase tracking-wide mb-0.5">Trả lời nhanh</div>
      {a.answer}
      {a.link && <Link href={a.link.href} className="block mt-1 font-bold text-primary hover:underline">{a.link.label} →</Link>}
    </div>
  );
}
