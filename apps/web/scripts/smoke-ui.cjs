// Đợt 89 — kiểm tra nhanh giao diện: mở các trang chính, bắt lỗi console/HTTP, chụp ảnh vào scripts/shots.
// Chạy:  (cần web + api đang chạy)   BASE=http://localhost:3000 node scripts/smoke-ui.cjs
// Cần Playwright:  npm i -D playwright && npx playwright install chromium
// Đợt 90 — thêm "ngân sách tốc độ": mỗi trang có giới hạn dung lượng tải (KB) và thời gian hiện nội dung chính (LCP);
// vượt ngưỡng → báo ✗. Chạy trên bản build (npm run build && npm start) để số đo sát với web thật.
// Bắt cả lỗi "Hydration" (nội dung máy chủ dựng sẵn lệch với trình duyệt).
const { chromium } = require('playwright');
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
  await b.close();
  process.exit(fail ? 1 : 0);
})();
