// Аудит адаптива: ищет горизонтальное переполнение и виновников на узких экранах.
import { chromium } from "playwright-core";
import { writeFileSync } from "fs";

// Запуск: npm run audit:responsive   (сайт должен быть поднят)
// Переопределяется через окружение: SITE_URL, CHROME_PATH, WIDTHS, CAT/PLAN/NEWS/DOC
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.SITE_URL ?? "http://localhost:3000";
const WIDTHS = (process.env.WIDTHS ?? "320,360,390,414,768,1024")
  .split(",")
  .map((n) => Number(n.trim()))
  .filter(Boolean);
const CAT = process.env.CAT ?? "studii";
const PLAN = process.env.PLAN ?? "studiya-2682";
const NEWS = process.env.NEWS ?? "start-prodazh";
const DOC = process.env.DOC ?? "politika-konfidencialnosti";
const PAGES = [
  ["Главная", "/"],
  ["Каталог", "/planirovki"],
  ["Категория", `/planirovki/${CAT}`],
  ["Планировка", `/planirovki/${PLAN}`],
  ["Новости", "/novosti"],
  ["Новость", `/novosti/${NEWS}`],
  ["Документы", "/dokumenty"],
  ["Документ", `/dokumenty/${DOC}`],
  ["404", "/planirovki/net-takoy-stranicy-12345"],
];

const b = await chromium.launch({ executablePath: CHROME });
const report = [];

// Возвращает список видимых элементов, вылезающих за правый край.
const PROBE = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    if (el.closest('[inert],[aria-hidden="true"],[hidden]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const overflowRight = Math.round(r.right - vw);
    const overflowLeft = Math.round(-r.left);
    if (overflowRight <= 1 && overflowLeft <= 1) continue;
    // пропускаем намеренно уехавшие за экран (закрытые панели вне потока)
    if ((cs.position === 'fixed' || cs.position === 'absolute') && r.left >= vw) continue;
    const sig = el.tagName + '.' + (el.className && el.className.baseVal === undefined ? String(el.className) : '') ;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 70),
      text: (el.textContent || '').trim().slice(0, 45),
      w: Math.round(r.width), right: Math.round(r.right),
      overRight: overflowRight > 1 ? overflowRight : 0,
      overLeft: overflowLeft > 1 ? overflowLeft : 0,
      pos: cs.position, ws: cs.whiteSpace, ovx: cs.overflowX,
    });
  }
  return {
    vw,
    docScrollW: document.documentElement.scrollWidth,
    bodyScrollW: document.body.scrollWidth,
    canScrollX: document.documentElement.scrollWidth > vw + 1,
    culprits: out.sort((a, b2) => (b2.overRight + b2.overLeft) - (a.overRight + a.overLeft)).slice(0, 12),
  };
})()`;

// Мелкие цели нажатия (< 40px) и вылезающий текст
const A11Y = `(() => {
  const small = [];
  for (const el of document.querySelectorAll('a,button,select,input,[role="button"]')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('[inert],[aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < 36 || r.width < 36) {
      small.push({ tag: el.tagName.toLowerCase(), text: (el.textContent||'').trim().slice(0,32),
                   w: Math.round(r.width), h: Math.round(r.height) });
    }
  }
  return small.slice(0, 10);
})()`;

for (const [name, path] of PAGES) {
  for (const w of WIDTHS) {
    const page = await b.newPage({ viewport: { width: w, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    try {
      await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
      const accept = page.locator('button:has-text("Принять")');
      if (await accept.count()) { try { await accept.first().click({ timeout: 2000 }); } catch {} }
      // прокрутить всё, чтобы поднять ленивые блоки
      await page.evaluate(async () => {
        const H = document.body.scrollHeight;
        for (let y = 0; y < H; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(700);
      const res = await page.evaluate(PROBE);
      const small = await page.evaluate(A11Y);
      report.push({ name, path, w, ...res, small });
      const mark = res.canScrollX ? "ПЕРЕПОЛНЕНИЕ" : "ок";
      console.log(`${mark.padEnd(13)} ${name.padEnd(11)} ${w}px  scrollW=${res.docScrollW} vw=${res.vw}  мелких целей: ${small.length}`);
      if (res.canScrollX) {
        for (const c of res.culprits.slice(0, 4))
          console.log(`      ↳ <${c.tag} class="${c.cls}"> +${c.overRight || -c.overLeft}px  «${c.text}»`);
      }
    } catch (e) {
      console.log(`ОШИБКА       ${name} ${w}px: ${String(e).split("\n")[0].slice(0, 90)}`);
      report.push({ name, path, w, error: String(e).slice(0, 200) });
    }
    await page.close();
  }
}
writeFileSync(process.env.AUDIT_OUT ?? "/tmp/responsive-audit.json", JSON.stringify(report, null, 2));
const bad = report.filter((r) => r.canScrollX).length;
console.log(`\nпроверено ${report.length} сочетаний, с переполнением: ${bad}`);
process.exitCode = bad > 0 ? 1 : 0;
await b.close();
