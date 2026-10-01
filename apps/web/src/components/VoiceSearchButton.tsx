'use client';

import { useEffect, useRef, useState } from 'react';

// Đợt 52 — tìm việc bằng giọng nói (Web Speech API của trình duyệt, tiếng Việt). Trình duyệt không hỗ trợ → nút ẩn.
type Rec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function VoiceSearchButton({ onText, className = '' }: { onText: (text: string) => void; className?: string }) {
  // Đợt 91 — null = chưa biết (giữ chỗ đúng kích thước nút → ô nhập không bị đẩy/giật khi trình duyệt xác định xong).
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const rec = useRef<Rec | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  if (supported === null) return <span aria-hidden className="shrink-0 h-11 w-11 sm:h-10 sm:w-10" />;
  if (!supported) return null;

  function toggle() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = 'vi-VN';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      if (text) onText(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? 'Đang nghe, bấm để dừng' : 'Tìm bằng giọng nói'}
      title="Tìm bằng giọng nói"
      className={`shrink-0 h-11 w-11 sm:h-10 sm:w-10 rounded-lg border border-border-strong bg-white hover:border-primary flex items-center justify-center text-[17px] ${listening ? 'ring-2 ring-accent animate-pulse' : ''} ${className}`}
    >
      🎤
    </button>
  );
}
