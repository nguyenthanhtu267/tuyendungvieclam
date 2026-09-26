// Đợt 19 (26/09/2026) — bộ ghi truy cập THẬT (tự viết, không dùng dịch vụ ngoài) cho Admin "Phân tích
// truy cập": lượt xem trang, thời gian ở lại, độ cuộn, mọi cú click (bản đồ nhiệt), hành động quan trọng,
// nguồn truy cập.
//
// Quyền riêng tư (người dùng chọn): mã ẩn danh theo trình duyệt, KHÔNG lưu IP. Không ghi khi đang đăng
// nhập bằng tài khoản Admin/Điều phối viên, khi Admin "Đăng nhập thay", trong khung xem trước (iframe) của
// trang Admin, hoặc trong trang /admin.
//
// Gửi theo lô bằng navigator.sendBeacon dạng text/plain (không cần preflight CORS, gửi được cả lúc đóng tab).

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const SESSION_IDLE_MS = 30 * 60_000;
const FLUSH_MS = 15_000;
const IDLE_STOP_MS = 3 * 60_000; // ngừng đếm thời gian ở lại sau 3 phút không tương tác
const MAX_QUEUE = 400;

type PV = { id: string; p: string; prev: string | null; ts: number; d: number; sc: number; dirty: boolean };
type Ev = Record<string, unknown>;
type SessionInfo = {
  id: string;
  last: number;
  ses: Record<string, unknown>;
  lp?: string; // trang xem gần nhất trong phiên
};

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* trình duyệt chặn lưu trữ — vẫn chạy được trong bộ nhớ */
  }
}

const CITY_VI: Record<string, string> = {
  Hanoi: 'Hà Nội',
  'Ha Noi': 'Hà Nội',
  'Ho Chi Minh City': 'TP. Hồ Chí Minh',
  'Ho Chi Minh': 'TP. Hồ Chí Minh',
  'Da Nang': 'Đà Nẵng',
  'Hai Phong': 'Hải Phòng',
  'Can Tho': 'Cần Thơ',
  'Bien Hoa': 'Biên Hoà',
  'Thu Duc': 'TP. Thủ Đức',
  'Nha Trang': 'Nha Trang',
  Hue: 'Huế',
  'Vung Tau': 'Vũng Tàu',
  'Thu Dau Mot': 'Thủ Dầu Một',
  'Buon Ma Thuot': 'Buôn Ma Thuột',
  'Hai Duong': 'Hải Dương',
  'Bac Ninh': 'Bắc Ninh',
  'Quy Nhon': 'Quy Nhơn',
  'Vinh': 'Vinh',
};

class Tracker {
  private enabled = false;
  private ready = false; // đã biết danh tính (me) — trước đó chỉ gom, chưa gửi
  private token: string | null = null;
  private visitorId = '';
  private visitorFirst = 0;
  private session: SessionInfo | null = null;
  private pv: PV | null = null;
  private closedPvs: PV[] = [];
  private queue: Ev[] = [];
  private lastTick = 0;
  private lastInteraction = 0;
  private started = false;
  private webdriver = false;
  private sentWebdriver = false;

  init() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    try {
      if (window.self !== window.top) return; // khung xem trước trong Admin (bản đồ nhiệt)
    } catch {
      return;
    }
    this.enabled = true;
    this.webdriver = navigator.webdriver === true;
    this.visitorId = lsGet('tvl_vid') ?? '';
    this.visitorFirst = Number(lsGet('tvl_vid_t') ?? 0);
    if (!this.visitorId) {
      this.visitorId = uuid();
      this.visitorFirst = Date.now();
      lsSet('tvl_vid', this.visitorId);
      lsSet('tvl_vid_t', String(this.visitorFirst));
    }
    this.lastTick = Date.now();
    this.lastInteraction = Date.now();

    const mark = () => {
      this.lastInteraction = Date.now();
    };
    let lastMove = 0;
    window.addEventListener('scroll', () => {
      mark();
      this.updateScroll();
    }, { passive: true });
    window.addEventListener('keydown', mark, { passive: true });
    window.addEventListener('touchstart', mark, { passive: true });
    window.addEventListener(
      'mousemove',
      () => {
        const t = Date.now();
        if (t - lastMove > 1000) {
          lastMove = t;
          mark();
        }
      },
      { passive: true },
    );
    document.addEventListener('click', (e) => this.onClick(e), { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      this.tick();
      if (document.visibilityState === 'hidden') this.flush();
      else this.lastTick = Date.now();
    });
    window.addEventListener('pagehide', () => {
      this.tick();
      this.flush();
    });
    setInterval(() => this.tick(), 1000);
    setInterval(() => {
      if (document.visibilityState === 'visible') this.flush();
    }, FLUSH_MS);
  }

  // Gọi mỗi khi trạng thái đăng nhập thay đổi. me === undefined → còn đang tải (chỉ gom, chưa gửi).
  setIdentity(me: { role: string } | null | undefined, token: string | null, impersonating: boolean) {
    if (!this.enabled) return;
    if (me === undefined) {
      this.ready = false;
      return;
    }
    if (impersonating || (me && (me.role === 'admin' || me.role === 'moderator'))) {
      // Nội bộ — bỏ toàn bộ dữ liệu đang gom, không ghi gì.
      this.ready = false;
      this.queue = [];
      this.closedPvs = [];
      if (this.pv) this.pv.dirty = false;
      this.token = null;
      this.suspended = true;
      return;
    }
    this.suspended = false;
    this.token = me ? token : null;
    this.ready = true;
    this.flush();
  }
  private suspended = false;

  private readStoredSessionId(): string | null {
    try {
      const raw = lsGet('tvl_sess');
      if (!raw) return null;
      const s = JSON.parse(raw) as SessionInfo;
      return Date.now() - s.last > SESSION_IDLE_MS ? null : s.id;
    } catch {
      return null;
    }
  }

  private ensureSession(): SessionInfo {
    const now = Date.now();
    if (!this.session) {
      try {
        const raw = lsGet('tvl_sess');
        if (raw) this.session = JSON.parse(raw) as SessionInfo;
      } catch {
        this.session = null;
      }
    }
    if (!this.session || now - this.session.last > SESSION_IDLE_MS || !this.session.id) {
      const url = new URL(window.location.href);
      const utm = {
        source: url.searchParams.get('utm_source') ?? undefined,
        medium: url.searchParams.get('utm_medium') ?? undefined,
        campaign: url.searchParams.get('utm_campaign') ?? undefined,
      };
      this.session = {
        id: uuid(),
        last: now,
        ses: {
          st: now,
          ref: document.referrer || undefined,
          land: window.location.pathname,
          utm: utm.source || utm.medium || utm.campaign ? utm : undefined,
          sw: window.screen?.width,
          lang: navigator.language,
          wd: this.webdriver || undefined,
        },
      };
      this.loadGeo(this.session);
    }
    this.session.last = now;
    lsSet('tvl_sess', JSON.stringify(this.session));
    return this.session;
  }

  private loadGeo(s: SessionInfo) {
    // Tỉnh/thành ước lượng từ header địa lý của Vercel (không lưu IP). Chạy trên máy dev thì trống.
    fetch('/api/geo', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((g: { country?: string | null; city?: string | null } | null) => {
        if (!g || !this.session || this.session.id !== s.id) return;
        const city = g.city ? CITY_VI[g.city] ?? g.city : undefined;
        this.session.ses.geo = { country: g.country ?? undefined, city };
        lsSet('tvl_sess', JSON.stringify(this.session));
      })
      .catch(() => {});
  }

  // Bắt đầu lượt xem trang mới (gọi khi đường dẫn đổi).
  pageview(path: string) {
    if (!this.enabled) return;
    if (this.pv && this.pv.p === path) return;
    this.tick();
    if (this.pv) this.closedPvs.push(this.pv);
    if (this.suspended) {
      this.closedPvs = [];
    }
    const sessionBefore = this.session?.id ?? this.readStoredSessionId();
    const s = this.ensureSession();
    // Trang trước trong cùng phiên — kể cả khi người xem tải lại/mở trang mới (không qua điều hướng nội bộ).
    const prev = this.pv?.p ?? (sessionBefore === s.id ? s.lp ?? null : null);
    this.pv = { id: uuid(), p: path, prev, ts: Date.now(), d: 0, sc: 0, dirty: true };
    s.lp = path;
    lsSet('tvl_sess', JSON.stringify(s));
    this.lastInteraction = Date.now();
    this.lastTick = Date.now();
    setTimeout(() => this.updateScroll(), 400);
    if (this.closedPvs.length) this.flush();
  }

  private updateScroll() {
    if (!this.pv) return;
    const docH = document.documentElement.scrollHeight || 1;
    const pct = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / docH) * 100));
    if (pct > this.pv.sc) {
      this.pv.sc = pct;
      this.pv.dirty = true;
    }
  }

  private tick() {
    const now = Date.now();
    const elapsed = now - this.lastTick;
    this.lastTick = now;
    if (!this.pv || elapsed <= 0 || elapsed > 5000) return;
    if (document.visibilityState !== 'visible') return;
    if (now - this.lastInteraction > IDLE_STOP_MS) return;
    this.pv.d += elapsed;
    this.pv.dirty = true;
  }

  private onClick(e: MouseEvent) {
    if (!this.enabled || this.suspended || !this.pv) return;
    this.lastInteraction = Date.now();
    const target = e.target as Element | null;
    const el = target?.closest?.('a,button,[role="button"],input,select,textarea,label,summary,[data-track]') as HTMLElement | null;
    let label: string | undefined;
    if (el) {
      const tag = el.tagName;
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !['button', 'submit', 'reset', 'checkbox', 'radio'].includes(type))) {
        // Ô nhập liệu: TUYỆT ĐỐI không ghi nội dung người dùng gõ — chỉ ghi tên/gợi ý của ô.
        label = `Ô nhập: ${el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || type || tag.toLowerCase()}`.slice(0, 100);
      } else {
        label =
          el.getAttribute('data-track') ||
          el.getAttribute('aria-label') ||
          (el.innerText || (tag === 'INPUT' ? (el as HTMLInputElement).value : '') || '').replace(/\s+/g, ' ').trim().slice(0, 80) ||
          el.getAttribute('title') ||
          el.getAttribute('href') ||
          tag.toLowerCase();
      }
    }
    const docW = document.documentElement.scrollWidth || window.innerWidth || 1;
    this.push({
      t: 'click',
      x: Math.round((e.pageX / docW) * 1000) / 1000,
      y: Math.round(e.pageY),
      dh: document.documentElement.scrollHeight,
      vw: window.innerWidth,
      l: label,
    });
    // Liên hệ / link ra ngoài — nhận diện theo đường link.
    const a = target?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (a) {
      const href = a.getAttribute('href') ?? '';
      if (href.startsWith('tel:')) this.push({ t: 'contact_phone', l: href.slice(4, 40) });
      else if (href.startsWith('mailto:')) this.push({ t: 'contact_email', l: href.slice(7, 80) });
      else if (/zalo\.me|zalo\.vn|chat\.zalo/i.test(href)) this.push({ t: 'contact_zalo', l: href.slice(0, 100) });
      else if (/^https?:\/\//i.test(href)) {
        try {
          const u = new URL(href);
          if (u.host !== window.location.host) this.push({ t: 'outbound', l: u.host });
        } catch {
          /* bỏ qua */
        }
      }
    }
  }

  private push(ev: Ev) {
    if (!this.pv) return;
    if (this.queue.length >= MAX_QUEUE) return;
    this.queue.push({ ...ev, p: this.pv.p, pv: this.pv.id, ts: Date.now() });
  }

  track(type: string, opts: { entityType?: string; entityId?: string; label?: string; meta?: Record<string, unknown> } = {}) {
    if (!this.enabled || this.suspended) return;
    this.push({ t: type, et: opts.entityType, ei: opts.entityId, l: opts.label, m: opts.meta });
    // Hành động quan trọng — gửi sớm (người dùng có thể rời trang ngay sau đó).
    if (type !== 'click') setTimeout(() => this.flush(), 300);
  }

  flush() {
    if (!this.enabled || !this.ready || this.suspended) return;
    if (this.webdriver && this.sentWebdriver) return;
    this.tick();
    const pvs = [...this.closedPvs, ...(this.pv ? [this.pv] : [])].filter((p) => p.dirty);
    if (!pvs.length && !this.queue.length && document.visibilityState !== 'visible') return;
    const s = this.ensureSession();
    const ev = this.queue.splice(0, 250);
    const body = JSON.stringify({
      v: this.visitorId,
      vf: this.visitorFirst || undefined,
      s: s.id,
      tk: this.token ?? undefined,
      ses: s.ses,
      pv: pvs.map((p) => ({ id: p.id, p: p.p, prev: p.prev, ts: p.ts, d: Math.round(p.d), sc: p.sc })),
      ev,
    });
    pvs.forEach((p) => (p.dirty = false));
    this.closedPvs = [];
    if (this.webdriver) this.sentWebdriver = true;
    const url = `${API_URL}/analytics/collect`;
    try {
      const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
      if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
    } catch {
      /* thử cách khác */
    }
    fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(() => {});
  }
}

export const tracker = new Tracker();

// Ghi 1 hành động quan trọng (ứng tuyển, lưu tin, theo dõi công ty, tìm kiếm...).
export function track(
  type:
    | 'apply_click'
    | 'apply_submit'
    | 'save_job'
    | 'unsave_job'
    | 'follow_company'
    | 'unfollow_company'
    | 'search'
    | 'cv_search'
    | 'cv_unlock'
    | 'signup'
    | 'login',
  opts: { entityType?: 'job' | 'company' | 'candidate'; entityId?: string; label?: string; meta?: Record<string, unknown> } = {},
) {
  try {
    tracker.track(type, opts);
  } catch {
    /* không bao giờ làm hỏng trang vì bộ ghi */
  }
}
