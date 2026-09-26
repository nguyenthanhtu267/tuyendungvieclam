// Đợt 19 (26/09/2026) — nhận diện thiết bị/trình duyệt/hệ điều hành, bot, và phân loại nguồn truy cập.
// Tự viết bằng biểu thức chính quy (không thêm thư viện) — chỉ cần nhóm lớn, không cần phiên bản chi tiết.

const BOT_PATTERNS: [RegExp, string][] = [
  [
    /googlebot|google-inspectiontool|adsbot-google|mediapartners-google|storebot-google/i,
    'Googlebot',
  ],
  [/bingbot|bingpreview|msnbot/i, 'Bingbot'],
  [/coccocbot/i, 'Cốc Cốc bot'],
  [
    /facebookexternalhit|facebookcatalog|meta-externalagent/i,
    'Facebook (xem trước link)',
  ],
  // Chỉ bot xem trước link của Zalo — trình duyệt TRONG app Zalo (người thật) cũng có chữ "Zalo" nên không
  // được bắt chung.
  [/zalo[-_ ]?(bot|crawler|preview)/i, 'Zalo (xem trước link)'],
  [/yandex/i, 'YandexBot'],
  [/baiduspider/i, 'Baiduspider'],
  [/duckduckbot/i, 'DuckDuckBot'],
  [/applebot/i, 'Applebot'],
  [/twitterbot/i, 'Twitterbot'],
  [/linkedinbot/i, 'LinkedInBot'],
  [/telegrambot/i, 'TelegramBot'],
  [
    /slackbot|discordbot|whatsapp|skypeuripreview/i,
    'Ứng dụng chat (xem trước link)',
  ],
  [
    /ahrefs|semrush|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot|amazonbot|dataforseo/i,
    'Bot SEO/AI',
  ],
  [
    /lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|vercel-screenshot|vercel-favicon/i,
    'Công cụ kiểm tra web',
  ],
  [
    /headlesschrome|phantomjs|puppeteer|playwright|selenium|webdriver/i,
    'Trình duyệt tự động',
  ],
  [
    /curl|wget|python-requests|python-urllib|aiohttp|axios|node-fetch|go-http-client|java\/|okhttp|libwww|scrapy|httpclient/i,
    'Script/công cụ lập trình',
  ],
  [/(?<!cu)bot\b|crawler|spider|slurp|fetcher|linkpreview/i, 'Bot khác'],
];

export function detectBot(ua: string | undefined | null): string | null {
  if (!ua || !ua.trim()) return 'Không rõ (không có User-Agent)';
  for (const [re, name] of BOT_PATTERNS) if (re.test(ua)) return name;
  return null;
}

export function parseUserAgent(
  ua: string | undefined | null,
  screenW?: number | null,
) {
  const s = ua ?? '';
  let device = 'desktop';
  if (
    /ipad|tablet|kindle|silk|playbook/i.test(s) ||
    (/android/i.test(s) && !/mobile/i.test(s))
  )
    device = 'tablet';
  else if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(s))
    device = 'mobile';
  // iPadOS 13+ tự nhận là Macintosh — dùng bề rộng màn hình để phân biệt khi có.
  if (
    device === 'desktop' &&
    /macintosh/i.test(s) &&
    screenW &&
    screenW <= 1366 &&
    /mobile\//i.test(s)
  )
    device = 'tablet';

  let browser = 'Khác';
  if (/zalo/i.test(s)) browser = 'Zalo (trình duyệt trong app)';
  else if (/fban|fbav|fb_iab|instagram/i.test(s))
    browser = 'Facebook/Instagram (trong app)';
  else if (/coc_coc_browser|coccoc/i.test(s)) browser = 'Cốc Cốc';
  else if (/edg\//i.test(s)) browser = 'Edge';
  else if (/opr\/|opera/i.test(s)) browser = 'Opera';
  else if (/samsungbrowser/i.test(s)) browser = 'Samsung Internet';
  else if (/firefox|fxios/i.test(s)) browser = 'Firefox';
  else if (/chrome|crios/i.test(s)) browser = 'Chrome';
  else if (/safari/i.test(s)) browser = 'Safari';

  let os = 'Khác';
  if (/windows nt/i.test(s)) os = 'Windows';
  else if (/iphone|ipad|ipod/i.test(s)) os = 'iOS';
  else if (/android/i.test(s)) os = 'Android';
  else if (/mac os x|macintosh/i.test(s)) os = 'macOS';
  else if (/cros/i.test(s)) os = 'ChromeOS';
  else if (/linux/i.test(s)) os = 'Linux';

  return { device, browser, os };
}

// Thiết bị theo bề rộng khung nhìn — dùng cho bản đồ nhiệt (bố cục thay đổi theo bề rộng, không theo UA).
export function deviceFromViewport(
  vw: number | null | undefined,
  fallback: string,
): string {
  if (!vw || vw <= 0) return fallback === 'tablet' ? 'mobile' : fallback;
  return vw < 768 ? 'mobile' : 'desktop';
}

const SOURCE_RULES: [RegExp, string, string][] = [
  [/(^|\.)google\./i, 'Google', 'search'],
  [/(^|\.)bing\.com$/i, 'Bing', 'search'],
  [/(^|\.)coccoc\.com$/i, 'Cốc Cốc', 'search'],
  [/(^|\.)yahoo\./i, 'Yahoo', 'search'],
  [/(^|\.)duckduckgo\.com$/i, 'DuckDuckGo', 'search'],
  [
    /(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/i,
    'Facebook',
    'social',
  ],
  [/(^|\.)instagram\.com$/i, 'Instagram', 'social'],
  [/(^|\.)(tiktok\.com)$/i, 'TikTok', 'social'],
  [/(^|\.)(youtube\.com|youtu\.be)$/i, 'YouTube', 'social'],
  [/(^|\.)linkedin\.com$/i, 'LinkedIn', 'social'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/i, 'X (Twitter)', 'social'],
  [
    /(^|\.)(zalo\.me|zaloapp\.com|zalo\.vn|chat\.zalo\.me)$/i,
    'Zalo',
    'messaging',
  ],
  [/(^|\.)(t\.me|telegram\.org)$/i, 'Telegram', 'messaging'],
  [
    /(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|mail\.yahoo\.com)$/i,
    'Email',
    'messaging',
  ],
];

// utm_source hay gõ tắt/thường (VD "zalo", "fb", "gg") → tên nguồn chuẩn.
const UTM_NAMES: [RegExp, string][] = [
  [/^(google|gg|google[-_ ]?ads|adwords)$/i, 'Google'],
  [/^(facebook|fb|meta|messenger)$/i, 'Facebook'],
  [/^zalo(oa|app)?$/i, 'Zalo'],
  [/^tiktok$/i, 'TikTok'],
  [/^(youtube|yt)$/i, 'YouTube'],
  [/^(instagram|ig)$/i, 'Instagram'],
  [/^linkedin$/i, 'LinkedIn'],
  [/^(email|newsletter|mail)$/i, 'Email'],
  [/^(coccoc|cốc cốc)$/i, 'Cốc Cốc'],
];

export function classifySource(
  referrer: string | null | undefined,
  ownHost: string | null | undefined,
  utmSource?: string | null,
  utmMedium?: string | null,
): { source: string; channel: string; referrerHost: string | null } {
  let host: string | null = null;
  if (referrer) {
    try {
      host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      host = null;
    }
  }
  if (host && ownHost && host === ownHost.replace(/^www\./, '').toLowerCase())
    host = null;

  if (utmSource) {
    const byName = UTM_NAMES.find(([re]) => re.test(utmSource));
    if (byName)
      return { source: byName[1], channel: 'campaign', referrerHost: host };
    const known = SOURCE_RULES.find(
      ([re]) => re.test(utmSource) || re.test(`${utmSource}.com`),
    );
    return {
      source: known ? known[1] : utmSource.slice(0, 100),
      channel: 'campaign',
      referrerHost: host,
    };
  }
  if (utmMedium && /cpc|ppc|paid|ads/i.test(utmMedium))
    return {
      source: host ?? 'Quảng cáo',
      channel: 'campaign',
      referrerHost: host,
    };
  if (!host)
    return { source: 'Trực tiếp', channel: 'direct', referrerHost: null };
  for (const [re, name, channel] of SOURCE_RULES)
    if (re.test(host)) return { source: name, channel, referrerHost: host };
  return { source: host, channel: 'referral', referrerHost: host };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

// Chuẩn hoá đường dẫn thành "mẫu trang" + nhận diện đối tượng (tin/công ty/hồ sơ...) — làm lại ở
// server (không tin hoàn toàn phía trình duyệt).
export function normalizeRoute(path: string): {
  route: string;
  entityType: string | null;
  entityId: string | null;
} {
  const clean = (path.split('?')[0].split('#')[0] || '/').slice(0, 300);
  const parts = clean.split('/');
  let entityId: string | null = null;
  const routeParts = parts.map((p) => {
    if (UUID_RE.test(p)) {
      if (!entityId) entityId = p.toLowerCase();
      return '[id]';
    }
    return p;
  });
  const route = routeParts.join('/') || '/';
  let entityType: string | null = null;
  if (entityId) {
    if (
      /^\/viec-lam\/\[id\]/.test(route) ||
      /\/xem-tin\/\[id\]/.test(route) ||
      /\/sua-tin\/\[id\]/.test(route)
    )
      entityType = 'job';
    else if (/^\/cong-ty\/\[id\]/.test(route)) entityType = 'company';
    else if (/tim-ho-so\/\[id\]/.test(route)) entityType = 'candidate';
    else if (/kho-cv\/\[id\]/.test(route)) entityType = 'cv_archive';
  }
  return {
    route: route.slice(0, 200),
    entityType,
    entityId: entityType ? entityId : null,
  };
}
