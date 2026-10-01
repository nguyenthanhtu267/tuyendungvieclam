// Đợt 89 — kiểm tra nhanh giao diện: mở các trang chính, bắt lỗi console/HTTP, chụp ảnh vào scripts/shots.
// Chạy:  (cần web + api đang chạy)   BASE=http://localhost:3000 node scripts/smoke-ui.cjs
// Cần Playwright:  npm i -D playwright && npx playwright install chromium
// Đợt 90 — thêm "ngân sách tốc độ": mỗi trang có giới hạn dung lượng tải (KB) và thời gian hiện nội dung chính (LCP);
// vượt ngưỡng → báo ✗. Chạy trên bản build (npm run build && npm start) để số đo sát với web thật.
// Bắt cả lỗi "Hydration" (nội dung máy chủ dựng sẵn lệch với trình duyệt).
// Đợt 91 — thêm phần kiểm tra ĐIỆN THOẠI (iPhone SE, mạng 4G chậm, CPU chậm 4×): giật bố cục (CLS ≤ 0,1), ô nhập chữ ≥ 16px (iOS không tự phóng to),
// không tràn ngang, số nút/liên kết quá nhỏ (< 40px, đã tính vùng chạm mở rộng), thanh điều hướng dưới, PWA (manifest + service worker + trang offline).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = __dirname + '/shots';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: 'chi-tiet-tin', url: '__JOB__', expect: [], maxKB: 550, maxLcp: 3500 },
  { name: 'trang-chu', url: '/', expect: ['Việc làm'], maxKB: 450, maxLcp: 3000 },
  { name: 'tim-viec', url: '/viec-lam', expect: ['Tất cả việc làm'], maxKB: 450, maxLcp: 3000 },
  { name: 'tim-viec-bac-ninh', url: '/viec-lam?provinces=' + encodeURIComponent('Bắc Ninh'), expect: ['Huyện Tiên Du'], notExpect: ['Quận 7'] },
  { name: 'tim-viec-cao-cap', url: '/viec-lam?salaryTier=50', expect: [], check: async (p) => {
    // Mọi thẻ có nhãn CAO CẤP phải có khung lương ≥ 50 triệu (đọc từ dòng lương đỏ).
    const bad = await p.evaluate(() => {
      const out = [];
      document.querySelectorAll('a[href^="/viec-lam/"]').forEach((a) => {
        const t = a.innerText || '';
        if (!t.includes('CAO CẤP')) return;
        const nums = (t.match(/(\d+(?:[.,]\d+)?)\s*Tr/g) || []).map((x) => parseFloat(x));
        if (nums.length && Math.max(...nums) < 50) out.push(t.split('\n')[0]);
      });
      return out;
    });
    return bad.length ? `Nhãn CAO CẤP sai ở: ${bad.join(' | ')}` : null;
  } },
  { name: 'dang-nhap', url: '/dang-nhap', expect: [] },
];

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  let fail = 0;
  try {
    const api = process.env.API || 'http://localhost:3001';
    const j = await (await fetch(api + '/jobs?pageSize=1')).json();
    PAGES[0].url = '/viec-lam/' + j.items[0].id;
  } catch { PAGES.shift(); }
  for (const pg of PAGES) {
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push('JS: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && /hydrat/i.test(m.text())) errs.push('Hydration: ' + m.text().slice(0, 140)); });
    await p.addInitScript(() => { window.__lcp = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {} });
    p.on('response', (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url()}`); });
    try {
      await p.goto(BASE + pg.url, { waitUntil: 'networkidle', timeout: 45000 });
      await p.waitForTimeout(1200);
      const text = await p.innerText('body');
      for (const e of pg.expect || []) if (!text.includes(e)) errs.push(`Thiếu chữ “${e}”`);
      for (const e of pg.notExpect || []) if (text.includes(e)) errs.push(`Không được có “${e}”`);
      if (pg.check) { const m = await pg.check(p); if (m) errs.push(m); }
      const perf = await p.evaluate(() => ({ kb: Math.round(performance.getEntriesByType('resource').reduce((s, e) => s + (e.transferSize || 0), 0) / 1024), lcp: Math.round(window.__lcp || 0) }));
      pg.perf = perf;
      if (pg.maxKB && perf.kb > pg.maxKB) errs.push(`Nặng ${perf.kb} KB (ngân sách ${pg.maxKB} KB)`);
      if (pg.maxLcp && perf.lcp > pg.maxLcp) errs.push(`Hiện nội dung chính sau ${perf.lcp} ms (ngân sách ${pg.maxLcp} ms)`);
      await p.screenshot({ path: `${OUT}/${pg.name}.png` });
    } catch (e) { errs.push('Không mở được: ' + e.message); }
    const info = pg.perf ? `  [${pg.perf.kb} KB, LCP ${pg.perf.lcp} ms]` : '';
    console.log(errs.length ? `✗ ${pg.name}${info}\n   ${errs.join('\n   ')}` : `✓ ${pg.name}${info}`);
    if (errs.length) fail++;
    await p.close();
  }

  // ===== Đợt 91 — điện thoại =====
  const MOBILE = [
    { name: 'dt-trang-chu', url: '/', bottomNav: true },
    { name: 'dt-tim-viec', url: '/viec-lam', bottomNav: true },
    { name: 'dt-lao-dong', url: '/lao-dong-pho-thong' },
    { name: 'dt-dang-nhap', url: '/dang-nhap' },
  ];
  if (PAGES[0] && PAGES[0].name === 'chi-tiet-tin') MOBILE.push({ name: 'dt-chi-tiet-tin', url: PAGES[0].url });
  for (const pg of MOBILE) {
    const mctx = await b.newContext({ ...devices['iPhone SE'] });
    const p = await mctx.newPage();
    const errs = [];
    const cdp = await mctx.newCDPSession(p);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6e6) / 8, uploadThroughput: 750e3 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    p.on('pageerror', (e) => errs.push('JS: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && /hydrat/i.test(m.text())) errs.push('Hydration: ' + m.text().slice(0, 140)); });
    await p.addInitScript(() => {
      window.__cls = 0;
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {}
    });
    try {
      await p.goto(BASE + pg.url, { waitUntil: 'load', timeout: 60000 });
      await p.waitForTimeout(5000); // đủ cho tiện ích nạp sau + dữ liệu tới muộn
      const m = await p.evaluate(() => {
        const bad = [];
        document.querySelectorAll('input,select,textarea').forEach((e) => {
          if (!e.offsetParent || ['checkbox', 'radio', 'hidden', 'file', 'range', 'color'].includes(e.type)) return;
          if (parseFloat(getComputedStyle(e).fontSize) < 16) bad.push((e.placeholder || e.name || e.id || e.tagName).slice(0, 24));
        });
        let small = 0;
        document.querySelectorAll('a[href],button,summary,[role=button],select').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0 || el.closest('[hidden]') || getComputedStyle(el).visibility === 'hidden') return;
          let w = r.width, h = r.height;
          w += 2 * (parseFloat(el.style.getPropertyValue('--tx')) || 0); h += 2 * (parseFloat(el.style.getPropertyValue('--ty')) || 0);
          if (el.classList.contains('tap-slop')) { w += 18; h += 26; }
          if (el.classList.contains('pm-close')) { w += 24; h += 24; }
          if (h < 40 || w < 40) small++;
        });
        return {
          cls: Math.round((window.__cls || 0) * 1000) / 1000,
          bad,
          small,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          bottomNav: !!document.querySelector('nav[aria-label="Điều hướng nhanh"]'),
          manifest: !!document.querySelector('link[rel="manifest"]'),
        };
      });
      if (m.cls > 0.1) errs.push(`Giật bố cục CLS ${m.cls} (ngưỡng 0,1)`);
      if (m.bad.length) errs.push(`Ô nhập chữ < 16px (iPhone sẽ tự phóng to): ${m.bad.join(', ')}`);
      if (m.overflow > 1) errs.push(`Tràn ngang ${m.overflow}px`);
      if (m.small > 12) errs.push(`${m.small} nút/liên kết nhỏ hơn 40px (ngưỡng 12)`);
      if (pg.bottomNav && !m.bottomNav) errs.push('Thiếu thanh điều hướng dưới');
      if (!m.manifest) errs.push('Thiếu <link rel="manifest">');
      pg.perf = { cls: m.cls, small: m.small };
      await p.screenshot({ path: `${OUT}/${pg.name}.png` });
    } catch (e) { errs.push('Không mở được: ' + e.message); }
    const info = pg.perf ? `  [CLS ${pg.perf.cls}, nút nhỏ ${pg.perf.small}]` : '';
    console.log(errs.length ? `✗ ${pg.name}${info}\n   ${errs.join('\n   ')}` : `✓ ${pg.name}${info}`);
    if (errs.length) fail++;
    await mctx.close();
  }
  // PWA: service worker + trang offline phục vụ được
  for (const path of ['/sw.js', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png']) {
    const r = await fetch(BASE + path).catch(() => null);
    const ok = r && r.ok;
    console.log(ok ? `✓ pwa ${path}` : `✗ pwa ${path} (HTTP ${r ? r.status : 'lỗi mạng'})`);
    if (!ok) fail++;
  }
  await b.close();
  process.exit(fail ? 1 : 0);
})();
