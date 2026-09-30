'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminAdsApi, ApiError, type AdCampaignInput, type AdCampaignRow } from '@/lib/api';
import { AD_SLOT_DEFS, type AdSlotDef } from '@/lib/ad-slots';
import { THEMES, THEME_KEYS, buildLook } from '@/lib/ad-theme';
import { AdBanner, type AdContent } from '@/components/ads/AdBanner';

// Đợt 24 (29/09/2026) — soạn 1 chiến dịch banner: nội dung · nền (tự tạo từ mô tả / ảnh) · nơi hiện · lịch, có
// xem trước TRỰC TIẾP ở 3 khổ (dải ngang, cột phải, điện thoại) và tự cảnh báo cấu hình "không bao giờ hiện".

export const EMPTY_AD: AdCampaignInput = {
  name: '',
  eyebrow: null,
  title: '',
  subtitle: null,
  ctaText: null,
  url: '',
  addUtm: true,
  bgMode: 'generated',
  bgPrompt: '',
  bgTheme: null,
  bgSeed: 0,
  textColor: 'auto',
  slots: ['*'],
  audiences: [],
  device: 'all',
  weight: 5,
  startsAt: null,
  endsAt: null,
  enabled: true,
};

// Mẫu khởi đầu — điền sẵn để Admin chỉ việc sửa chữ/link (nội dung là ví dụ, cần sửa cho đúng thực tế).
const STARTERS: { label: string; v: Partial<AdCampaignInput> }[] = [
  {
    label: 'Phần mềm nhân sự',
    v: {
      name: 'Phần mềm Nhân sự Toàn diện',
      eyebrow: 'Mới ra mắt',
      title: 'Phần mềm Nhân sự Toàn diện',
      subtitle: 'Chấm công, tính lương, hồ sơ nhân viên — gọn trong một nơi.',
      ctaText: 'Dùng thử miễn phí',
      bgPrompt: 'phần mềm nhân sự toàn diện, hiện đại, tin cậy',
      audiences: ['guest', 'employer'],
    },
  },
  {
    label: 'Đăng tin miễn phí',
    v: {
      name: 'Kêu gọi đăng tin',
      eyebrow: 'Dành cho nhà tuyển dụng',
      title: 'Đăng tin tuyển dụng MIỄN PHÍ',
      subtitle: 'Tiếp cận ứng viên phù hợp, tin được duyệt nhanh.',
      ctaText: 'Đăng tin ngay',
      url: '/nha-tuyen-dung/dang-tin',
      bgPrompt: 'tuyển dụng, ưu đãi miễn phí, năng động',
      audiences: ['guest', 'employer'],
    },
  },
  {
    label: 'Khoá học',
    v: {
      name: 'Khoá học kỹ năng',
      eyebrow: 'Nâng cấp bản thân',
      title: 'Khoá học kỹ năng mềm cho người đi làm',
      subtitle: 'Giao tiếp, thuyết trình, quản lý thời gian — học online linh hoạt.',
      ctaText: 'Xem khoá học',
      bgPrompt: 'giáo dục đào tạo, phát triển, mềm mại',
      audiences: ['guest', 'candidate'],
    },
  },
  {
    label: 'Mùa Tết',
    v: {
      name: 'Việc làm mùa Tết',
      eyebrow: 'Chào Xuân',
      title: 'Việc làm thời vụ dịp Tết',
      subtitle: 'Hàng trăm vị trí bán hàng, kho vận, giao nhận đang chờ bạn.',
      ctaText: 'Tìm việc Tết',
      url: '/viec-lam?q=th%E1%BB%9Di%20v%E1%BB%A5',
      bgPrompt: 'Tết Nguyên Đán, lễ hội, rực rỡ',
    },
  },
  {
    label: 'Ưu đãi có hạn',
    v: {
      name: 'Ưu đãi gói tin nổi bật',
      eyebrow: 'Chỉ 3 ngày',
      title: 'Giảm 50% gói tin nổi bật',
      subtitle: 'Tin của bạn lên đầu trang tìm kiếm trong 7 ngày.',
      ctaText: 'Nhận ưu đãi',
      bgPrompt: 'flash sale giảm giá, năng động, sôi động',
      audiences: ['employer'],
    },
  },
];

const PROMPT_CHIPS = [
  'hiện đại, tin cậy',
  'công nghệ, thông minh',
  'năng động, trẻ trung',
  'sang trọng, cao cấp',
  'tối giản, nền sáng',
  'lễ hội Tết',
  'thiên nhiên, mềm mại',
  'ưu đãi, khuyến mãi',
];

const AUDIENCES = [
  { id: 'guest', label: 'Khách (chưa đăng nhập)' },
  { id: 'candidate', label: 'Ứng viên' },
  { id: 'employer', label: 'Nhà tuyển dụng' },
];

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

// Đo độ sáng trung bình của ảnh (thu nhỏ 48×24) để chọn chữ trắng/tối cho hợp.
function measureTone(file: File): Promise<'light' | 'dark'> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 48;
        c.height = 24;
        const ctx = c.getContext('2d');
        if (!ctx) return resolve('dark');
        // Chỉ đo nửa trái (nơi đặt chữ).
        ctx.drawImage(img, 0, 0, img.width / 2, img.height, 0, 0, 48, 24);
        const d = ctx.getImageData(0, 0, 48, 24).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        resolve(sum / (d.length / 4) > 0.58 ? 'light' : 'dark');
      } catch {
        resolve('dark');
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => resolve('dark');
    img.src = url;
  });
}

// Các vùng mà chiến dịch THỰC SỰ có thể hiện (sau khi xét đối tượng + thiết bị).
export function reachableSlots(v: Pick<AdCampaignInput, 'slots' | 'audiences' | 'device'>): AdSlotDef[] {
  const chosen = v.slots.includes('*') ? AD_SLOT_DEFS : AD_SLOT_DEFS.filter((s) => v.slots.includes(s.id));
  return chosen.filter((s) => {
    if (s.onlyFor && v.audiences.length && !v.audiences.includes(s.onlyFor)) return false;
    if (v.device === 'desktop' && s.devices === 'mobile') return false;
    if (v.device === 'mobile' && s.devices === 'desktop') return false;
    return true;
  });
}

function problems(v: AdCampaignInput, hasImage: boolean): { level: 'error' | 'warn'; text: string }[] {
  const out: { level: 'error' | 'warn'; text: string }[] = [];
  if (!v.name.trim()) out.push({ level: 'error', text: 'Chưa có tên chiến dịch.' });
  if (v.title.trim().length < 2) out.push({ level: 'error', text: 'Chưa có tiêu đề banner.' });
  if (!v.url.trim()) out.push({ level: 'error', text: 'Chưa có link khi bấm vào banner.' });
  else if (!/^(https?:\/\/\S+|\/(?!\/)\S*)$/i.test(v.url.trim()))
    out.push({ level: 'error', text: 'Link phải bắt đầu bằng https:// (trang ngoài) hoặc / (trang trong web).' });
  else if (/^http:\/\//i.test(v.url.trim())) out.push({ level: 'warn', text: 'Link dùng http:// — nên dùng https:// để trình duyệt không cảnh báo.' });
  if (v.slots.length === 0) out.push({ level: 'error', text: 'Chọn ít nhất 1 khu vực hiển thị.' });
  else if (reachableSlots(v).length === 0)
    out.push({ level: 'error', text: 'Với đối tượng/thiết bị đã chọn, không khu vực nào hiện được banner này — hãy nới đối tượng, thiết bị hoặc khu vực.' });
  if (v.title.length > 60) out.push({ level: 'warn', text: 'Tiêu đề hơi dài (>60 ký tự) — trên điện thoại sẽ xuống 3–4 dòng.' });
  if (v.bgMode === 'image' && !hasImage) out.push({ level: 'warn', text: 'Chưa có ảnh nền — banner sẽ dùng nền tự tạo từ mô tả.' });
  if (v.endsAt && new Date(v.endsAt) <= new Date()) out.push({ level: 'warn', text: 'Ngày kết thúc đã qua — chiến dịch sẽ không hiện.' });
  if (v.startsAt && v.endsAt && new Date(v.endsAt) <= new Date(v.startsAt))
    out.push({ level: 'error', text: 'Ngày kết thúc phải sau ngày bắt đầu.' });
  return out;
}

const input = 'w-full rounded-lg border border-border px-3 py-2 text-[13px] focus:outline-none focus:border-primary';
const label = 'flex flex-col gap-1 text-xs font-semibold text-ink';

export function AdEditor({
  token,
  initial,
  onClose,
  onSaved,
}: {
  token: string;
  initial: AdCampaignRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, setV] = useState<AdCampaignInput>(() => {
    if (!initial) return { ...EMPTY_AD };
    // Chỉ lấy các trường của form (bỏ id/trạng thái/số liệu).
    const out = { ...EMPTY_AD } as Record<string, unknown>;
    for (const k of Object.keys(EMPTY_AD)) out[k] = (initial as unknown as Record<string, unknown>)[k] ?? out[k];
    return out as unknown as AdCampaignInput;
  });
  const [image, setImage] = useState<{ url: string | null; tone: 'light' | 'dark' | null }>({
    url: initial?.bgImageUrl ?? null,
    tone: initial?.bgImageTone ?? null,
  });
  const [pending, setPending] = useState<{ file: File; url: string; tone: 'light' | 'dark' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (pending?.url) URL.revokeObjectURL(pending.url);
    },
    [pending],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof AdCampaignInput>(k: K, val: AdCampaignInput[K]) => setV((o) => ({ ...o, [k]: val }));
  const imgUrl = pending?.url ?? image.url;
  const imgTone = pending?.tone ?? image.tone;
  const content: AdContent = { ...v, slug: 'xem-truoc', bgImageUrl: imgUrl, bgImageTone: imgTone };
  const look = useMemo(() => buildLook(content), [JSON.stringify(content)]); // eslint-disable-line react-hooks/exhaustive-deps
  const issues = problems(v, !!imgUrl);
  const blocking = issues.some((i) => i.level === 'error');
  const reach = reachableSlots(v);

  async function pickFile(f: File | undefined) {
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setErr('Ảnh nền phải là JPG, PNG hoặc WEBP.');
    if (f.size > 2 * 1024 * 1024) return setErr('Ảnh nền tối đa 2MB.');
    setErr(null);
    const tone = await measureTone(f);
    setPending({ file: f, url: URL.createObjectURL(f), tone });
    set('bgMode', 'image');
  }

  async function removeImage() {
    if (pending) setPending(null);
    if (initial && image.url) {
      try {
        await adminAdsApi.removeImage(token, initial.id);
      } catch {
        /* vẫn bỏ khỏi form */
      }
    }
    setImage({ url: null, tone: null });
    set('bgMode', 'generated');
  }

  async function save() {
    if (blocking) return;
    setBusy(true);
    setErr(null);
    try {
      const dto: AdCampaignInput = {
        ...v,
        eyebrow: v.eyebrow?.trim() || null,
        subtitle: v.subtitle?.trim() || null,
        ctaText: v.ctaText?.trim() || null,
        bgMode: v.bgMode === 'image' && !imgUrl ? 'generated' : v.bgMode,
      };
      const saved = initial ? await adminAdsApi.update(token, initial.id, dto) : await adminAdsApi.create(token, dto);
      if (pending) await adminAdsApi.uploadImage(token, saved.id, pending.file, pending.tone);
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Lưu không thành công, vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  const pages = Array.from(new Set(AD_SLOT_DEFS.map((s) => s.page)));
  const allSlots = v.slots.includes('*');

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/45 sm:p-4" role="dialog" aria-modal="true" aria-label="Soạn banner quảng cáo">
      <div className="bg-white w-full max-w-7xl sm:rounded-2xl shadow-2xl flex flex-col max-h-screen sm:max-h-[94vh]" data-testid="ad-editor">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border">
          <div className="font-bold text-[15px]">{initial ? 'Sửa chiến dịch banner' : 'Tạo chiến dịch banner'}</div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-surface-alt text-lg" aria-label="Đóng">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
          {/* ------------------------------------------------ cột form */}
          <div className="p-5 flex flex-col gap-6 min-w-0">
            {!initial && (
              <section className="flex flex-col gap-2">
                <div className="text-[11px] font-bold text-primary uppercase tracking-wide">Bắt đầu nhanh từ mẫu</div>
                <div className="flex flex-wrap gap-1.5">
                  {STARTERS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setV((o) => ({ ...o, ...s.v }))}
                      className="text-[12px] font-semibold px-3 py-1.5 rounded-full border border-border-strong hover:border-primary hover:text-primary"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-ink-faint">Mẫu chỉ điền sẵn chữ để bạn sửa lại cho đúng sản phẩm/chương trình thật.</div>
              </section>
            )}

            <section className="flex flex-col gap-3">
              <div className="text-[11px] font-bold text-primary uppercase tracking-wide">1 · Nội dung</div>
              <label className={label} htmlFor="ad-name">
                Tên chiến dịch (chỉ Admin thấy)
                <input id="ad-name" className={input} maxLength={120} value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="VD: Phần mềm nhân sự – tháng 10" />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
                <label className={label} htmlFor="ad-eyebrow">
                  Nhãn nhỏ (tuỳ chọn)
                  <input id="ad-eyebrow" className={input} maxLength={40} value={v.eyebrow ?? ''} onChange={(e) => set('eyebrow', e.target.value)} placeholder="Mới ra mắt" />
                </label>
                <label className={label} htmlFor="ad-title">
                  <span className="flex justify-between">
                    Tiêu đề <span className="text-ink-faint font-normal">{v.title.length}/90</span>
                  </span>
                  <input id="ad-title" className={input} maxLength={90} value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="Phần mềm Nhân sự Toàn diện" />
                </label>
              </div>
              <label className={label} htmlFor="ad-subtitle">
                <span className="flex justify-between">
                  Mô tả ngắn (tuỳ chọn) <span className="text-ink-faint font-normal">{(v.subtitle ?? '').length}/180</span>
                </span>
                <textarea id="ad-subtitle" rows={2} className={input} maxLength={180} value={v.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
                <label className={label} htmlFor="ad-cta">
                  Chữ trên nút
                  <input id="ad-cta" className={input} maxLength={30} value={v.ctaText ?? ''} onChange={(e) => set('ctaText', e.target.value)} placeholder="Xem ngay" />
                </label>
                <label className={label} htmlFor="ad-url">
                  Link khi bấm
                  <input id="ad-url" className={input} maxLength={1000} value={v.url} onChange={(e) => set('url', e.target.value)} placeholder="https://… hoặc /nha-tuyen-dung/dang-tin" />
                  <span className="text-[11px] text-ink-faint font-normal">
                    https://… mở tab mới · /… mở ngay trong web này
                  </span>
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs" htmlFor="ad-utm">
                <input id="ad-utm" type="checkbox" checked={v.addUtm} onChange={(e) => set('addUtm', e.target.checked)} />
                Tự gắn mã theo dõi UTM vào link ngoài (xem được nguồn khách ở Google Analytics của trang đích)
              </label>
            </section>

            <section className="flex flex-col gap-3">
              <div className="text-[11px] font-bold text-primary uppercase tracking-wide">2 · Nền & màu chữ</div>
              <div className="inline-flex self-start rounded-lg border border-border p-0.5 text-xs font-bold">
                {(
                  [
                    ['generated', '✨ Tự tạo từ mô tả'],
                    ['image', '🖼 Ảnh tải lên'],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set('bgMode', k)}
                    className={`px-3 py-1.5 rounded-md ${v.bgMode === k ? 'bg-primary text-white' : 'text-ink-muted'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {v.bgMode === 'generated' ? (
                <>
                  <label className={label} htmlFor="ad-prompt">
                    Mô tả nền bạn muốn
                    <textarea
                      id="ad-prompt"
                      rows={2}
                      maxLength={300}
                      className={input}
                      value={v.bgPrompt}
                      onChange={(e) => set('bgPrompt', e.target.value)}
                      placeholder="VD: phần mềm nhân sự, hiện đại, tin cậy — hoặc: flash sale cuối tuần, sôi động"
                    />
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_CHIPS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => set('bgPrompt', v.bgPrompt.trim() ? `${v.bgPrompt.trim().replace(/,$/, '')}, ${c}` : c)}
                        className="text-[11.5px] px-2.5 py-1 rounded-full bg-surface-alt border border-border hover:border-primary"
                      >
                        + {c}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <button
                      type="button"
                      id="ad-reroll"
                      onClick={() => set('bgSeed', v.bgSeed + 1)}
                      className="rounded-lg border border-border-strong px-3 py-2 text-xs font-bold hover:border-primary"
                    >
                      🎲 Tạo mẫu khác
                    </button>
                    <label className={`${label} min-w-[200px]`} htmlFor="ad-theme">
                      Bảng màu
                      <select id="ad-theme" className={input} value={v.bgTheme ?? ''} onChange={(e) => set('bgTheme', e.target.value || null)}>
                        <option value="">Tự động theo mô tả</option>
                        {THEME_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {THEMES[k].label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    id="ad-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                    className="text-xs"
                  />
                  <div className="text-[11px] text-ink-faint">
                    JPG/PNG/WEBP ≤ 2MB, nên ảnh ngang (≥ 1200px). Hệ thống tự đo độ sáng ảnh để chọn chữ trắng/tối và phủ lớp làm rõ chữ.
                  </div>
                  {imgUrl && (
                    <button type="button" onClick={removeImage} className="self-start text-xs font-bold text-critical">
                      Xoá ảnh, quay về nền tự tạo
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3 text-xs">
                {(
                  [
                    ['auto', 'Màu chữ tự động'],
                    ['light', 'Chữ trắng'],
                    ['dark', 'Chữ tối'],
                  ] as const
                ).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-1.5" htmlFor={`ad-ink-${k}`}>
                    <input id={`ad-ink-${k}`} type="radio" name="ad-ink" checked={v.textColor === k} onChange={() => set('textColor', k)} />
                    {l}
                  </label>
                ))}
              </div>
              <div className="text-[11.5px] text-ink-muted bg-surface-alt rounded-lg px-3 py-2" data-testid="ad-explain">
                🤖 {look.explain}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="text-[11px] font-bold text-primary uppercase tracking-wide">3 · Hiện ở đâu, cho ai</div>
              <div className="flex flex-wrap gap-4 text-xs font-semibold">
                <label className="flex items-center gap-1.5" htmlFor="ad-slots-all">
                  <input id="ad-slots-all" type="radio" name="ad-slots-mode" checked={allSlots} onChange={() => set('slots', ['*'])} />
                  Tất cả khu vực
                </label>
                <label className="flex items-center gap-1.5" htmlFor="ad-slots-pick">
                  <input id="ad-slots-pick" type="radio" name="ad-slots-mode" checked={!allSlots} onChange={() => set('slots', [])} />
                  Chọn từng khu vực
                </label>
              </div>
              {!allSlots && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border p-3">
                  {pages.map((pg) => (
                    <div key={pg} className="flex flex-col gap-1">
                      <div className="text-[11px] font-bold text-ink-muted">{pg}</div>
                      {AD_SLOT_DEFS.filter((s) => s.page === pg).map((s) => (
                        <label key={s.id} className="flex items-start gap-1.5 text-[12px]" htmlFor={`ad-slot-${s.id}`}>
                          <input
                            id={`ad-slot-${s.id}`}
                            type="checkbox"
                            className="mt-0.5"
                            checked={v.slots.includes(s.id)}
                            onChange={(e) =>
                              set('slots', e.target.checked ? [...v.slots, s.id] : v.slots.filter((x) => x !== s.id))
                            }
                          />
                          <span>
                            {s.label}
                            <span className="text-ink-faint">
                              {' '}
                              · {s.devices === 'desktop' ? 'máy tính' : s.devices === 'mobile' ? 'điện thoại' : 'mọi thiết bị'}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <div className="text-xs font-semibold">Ai thấy</div>
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-1.5" htmlFor="ad-aud-all">
                    <input id="ad-aud-all" type="checkbox" checked={v.audiences.length === 0} onChange={(e) => set('audiences', e.target.checked ? [] : ['guest'])} />
                    Tất cả mọi người
                  </label>
                  {AUDIENCES.map((a) => (
                    <label key={a.id} className="flex items-center gap-1.5" htmlFor={`ad-aud-${a.id}`}>
                      <input
                        id={`ad-aud-${a.id}`}
                        type="checkbox"
                        checked={v.audiences.includes(a.id)}
                        onChange={(e) => {
                          const next = e.target.checked ? [...v.audiences, a.id] : v.audiences.filter((x) => x !== a.id);
                          // Chọn đủ 3 nhóm = tất cả.
                          set('audiences', next.length === AUDIENCES.length ? [] : next);
                        }}
                      />
                      {a.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={label} htmlFor="ad-device">
                  Thiết bị
                  <select id="ad-device" className={input} value={v.device} onChange={(e) => set('device', e.target.value as AdCampaignInput['device'])}>
                    <option value="all">Mọi thiết bị</option>
                    <option value="desktop">Chỉ máy tính</option>
                    <option value="mobile">Chỉ điện thoại</option>
                  </select>
                </label>
                <label className={label} htmlFor="ad-weight">
                  <span className="flex justify-between">
                    Mức ưu tiên khi nhiều banner chung khu vực <b>{v.weight}/10</b>
                  </span>
                  <input id="ad-weight" type="range" min={1} max={10} value={v.weight} onChange={(e) => set('weight', Number(e.target.value))} />
                </label>
              </div>
              <div className="text-[11.5px] text-ink-faint">
                Sẽ hiện ở <b className="text-ink">{reach.length}</b>/{AD_SLOT_DEFS.length} khu vực
                {reach.length > 0 && reach.length <= 6 ? `: ${reach.map((s) => `${s.page} (${s.label.toLowerCase()})`).join('; ')}` : ''}.
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="text-[11px] font-bold text-primary uppercase tracking-wide">4 · Lịch chạy</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={label} htmlFor="ad-start">
                  Bắt đầu (bỏ trống = ngay)
                  <input id="ad-start" type="datetime-local" className={input} value={toLocalInput(v.startsAt)} onChange={(e) => set('startsAt', fromLocalInput(e.target.value))} />
                </label>
                <label className={label} htmlFor="ad-end">
                  Kết thúc (bỏ trống = không hạn)
                  <input id="ad-end" type="datetime-local" className={input} value={toLocalInput(v.endsAt)} onChange={(e) => set('endsAt', fromLocalInput(e.target.value))} />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold" htmlFor="ad-enabled">
                <input id="ad-enabled" type="checkbox" checked={v.enabled} onChange={(e) => set('enabled', e.target.checked)} />
                Bật chiến dịch
              </label>
            </section>
          </div>

          {/* ------------------------------------------------ cột xem trước */}
          <div className="bg-surface-alt border-t lg:border-t-0 lg:border-l border-border p-5 flex flex-col gap-4 min-w-0 lg:sticky lg:top-0 lg:self-start">
            <div className="text-[11px] font-bold text-primary uppercase tracking-wide">Xem trước trực tiếp</div>
            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] text-ink-muted">Dải ngang (trang chủ, danh sách, chi tiết tin)</div>
              <AdBanner ad={content} variant="wide" slot="home-top" preview />
            </div>
            <div className="flex flex-wrap gap-4 items-start">
              <div className="flex flex-col gap-1.5 w-[260px] max-w-full">
                <div className="text-[11px] text-ink-muted">Cột phải (máy tính)</div>
                <AdBanner ad={content} variant="tall" slot="job-sidebar" preview />
              </div>
              <div className="flex flex-col gap-1.5 w-[180px] max-w-full">
                <div className="text-[11px] text-ink-muted">Nhỏ gọn (menu điện thoại)</div>
                <AdBanner ad={content} variant="compact" slot="mobile-menu" preview />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 w-[340px] max-w-full">
              <div className="text-[11px] text-ink-muted">Dải ngang trên điện thoại</div>
              <AdBanner ad={content} variant="wide" slot="job-bottom" preview />
            </div>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3 flex flex-col gap-2">
          {issues.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-[11.5px]" data-testid="ad-issues">
              {issues.map((i) => (
                <li key={i.text} className={i.level === 'error' ? 'text-critical font-semibold' : 'text-warning font-semibold'}>
                  {i.level === 'error' ? '⛔' : '⚠️'} {i.text}
                </li>
              ))}
            </ul>
          )}
          {err && <div className="text-critical text-xs font-semibold">{err}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="tvl-btn-ghost !w-auto px-4 text-xs">
              Huỷ
            </button>
            <button type="button" id="ad-save" onClick={save} disabled={busy || blocking} className="tvl-btn-primary !w-auto px-5 text-xs disabled:opacity-50">
              {busy ? 'Đang lưu…' : initial ? 'Lưu thay đổi' : 'Tạo chiến dịch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
