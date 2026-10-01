// Đợt 89 — kiểm tra nhanh giao diện: mở các trang chính, bắt lỗi console/HTTP, chụp ảnh vào scripts/shots.
// Chạy:  (cần web + api đang chạy)   BASE=http://localhost:3000 node scripts/smoke-ui.cjs
// Cần Playwright:  npm i -D playwright && npx playwright install chromium
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = __dirname + '/shots';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: 'trang-chu', url: '/', expect: ['Việc làm'] },
  { name: 'tim-viec', url: '/viec-lam', expect: ['Tất cả việc làm'] },
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
  for (const pg of PAGES) {
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push('JS: ' + e.message));
    p.on('response', (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url()}`); });
    try {
      await p.goto(BASE + pg.url, { waitUntil: 'networkidle', timeout: 45000 });
      await p.waitForTimeout(1200);
      const text = await p.innerText('body');
      for (const e of pg.expect || []) if (!text.includes(e)) errs.push(`Thiếu chữ “${e}”`);
      for (const e of pg.notExpect || []) if (text.includes(e)) errs.push(`Không được có “${e}”`);
      if (pg.check) { const m = await pg.check(p); if (m) errs.push(m); }
      await p.screenshot({ path: `${OUT}/${pg.name}.png` });
    } catch (e) { errs.push('Không mở được: ' + e.message); }
    console.log(errs.length ? `✗ ${pg.name}\n   ${errs.join('\n   ')}` : `✓ ${pg.name}`);
    if (errs.length) fail++;
    await p.close();
  }
  await b.close();
  process.exit(fail ? 1 : 0);
})();
