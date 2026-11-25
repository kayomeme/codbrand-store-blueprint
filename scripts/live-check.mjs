#!/usr/bin/env node
/**
 * live-check.mjs — the spacing laws and the page checks of joins.js, on every page the store shows, at four widths.
 *
 *   node scripts/live-check.mjs <site-url> <api-key> [--out <folder>] [--widths 390,768,1024,1440]
 *                               [--only <url>[,<url>…]] [--thankyou <url of a thank-you page>] [--no-strips]
 *
 * What it does, the way a shopper meets the store:
 *   - reads through the api the store's Spacing designs (its steps), the blueprint's `spacing` (T, the reading line),
 *     and the pages: every published page, home, a category, the all-products page, a product of each kind (one that
 *     sells, one with options, one sold out, one sold through partners' links), cart, checkout, track order,
 *     account, search, a missing page (404) — and the thank-you page when you pass one (it needs an order);
 *   - opens each in Chrome at 390 (a phone: its user agent and touch — the store prints other HTML for phones, and
 *     rules for touch screens apply only there), 768, 1024 and 1440, at those exact widths;
 *   - runs joins.js with every collapsible closed and then open, again with the cart drawer, the checkout pop-up and
 *     a quick view open where it can open them, and forces :hover and :focus on one control of each kind (a control
 *     keeps its size in every state, L4);
 *   - saves each result as JSON and, for each, its annotated strips (the page window by window, every ink, gap and
 *     ruler drawn, findings in red). OPEN EVERY STRIP.
 * Then: node scripts/handover.mjs <site-url> <api-key> --joins <that folder>.
 *
 * Needs Chrome (or Chromium / Edge) installed: set CHROME=<path> when it is not where browsers usually are. A page
 * behind a host's bot check cannot be opened headless: it is named, and is measured by hand (joins.js pasted into
 * the page — references/spacing.md → "The check"). Exit 0: every page was measured; 1: something was not (named).
 * Findings are not failures here: handover.mjs judges them. No dependencies (Node 22+, its own WebSocket).
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, fallback = null) => (argv.indexOf(name) > -1 ? argv[argv.indexOf(name) + 1] : fallback);
const [siteArg, key] = argv;
if (!siteArg || !key || siteArg.startsWith('--') || key.startsWith('--')) {
  console.log('usage: node scripts/live-check.mjs <site-url> <api-key> [--out <folder>] [--widths 390,768,1024,1440] [--only <url,…>] [--thankyou <url>] [--no-strips]');
  process.exit(1);
}
if (typeof WebSocket === 'undefined') { console.log('Node 22 or newer is needed (it has WebSocket built in).'); process.exit(1); }
const SITE = siteArg.replace(/\/+$/, '');
const API = `${SITE}/wp-json/cl-api/v1`;
const today = new Date().toISOString().slice(0, 10);
const OUT = opt('--out', join(process.cwd(), `live-check-${new URL(SITE).hostname}-${today}`));
const WIDTHS = String(opt('--widths', '390,768,1024,1440')).split(',').map(Number).filter((n) => n > 0);
const ONLY = opt('--only') ? String(opt('--only')).split(',').map((u) => u.trim().replace(/\/+$/, '')) : null;
const STRIPS = !argv.includes('--no-strips');
const PHONE_BELOW = 768;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (s) => console.log(s);
const hide = (s) => String(s).split(key).join('<key>');

// ── the api ───────────────────────────────────────────────────────────────────────────────────
async function call(path) {
  await sleep(350);
  try {
    const r = await fetch(`${API}/${path.replace(/^\/+/, '')}`, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } });
    const text = await r.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, body, headers: r.headers };
  } catch (e) { return { status: 0, body: null, error: hide(e.message) }; }
}
const rowsOf = (b) => (Array.isArray(b) ? b : Array.isArray(b?.data) ? b.data : null);
async function walk(path) {
  const rows = [];
  const sep = path.includes('?') ? '&' : '?';
  for (let page = 1; page <= 50; page++) {
    const r = await call(`${path}${sep}per_page=100&page=${page}`);
    if (r.status !== 200) return page === 1 ? { error: `HTTP ${r.status}` } : { rows };
    const batch = rowsOf(r.body) || [];
    rows.push(...batch);
    const total = Number(r.headers?.get?.('x-wp-totalpages'));
    if (Number.isFinite(total) && total > 0 ? page >= total : batch.length < 100) break;
  }
  return { rows };
}
const px = (css) => { const m = String(css || '').match(/(?:gap|margin[a-z-]*|padding[a-z-]*)\s*:\s*(-?\d+(?:\.\d+)?)px/); return m ? Number(m[1]) : null; };

const me = await call('me');
if (me.status !== 200) { say(`The api did not answer (${me.status || me.error}): check the site address and the key.`); process.exit(1); }
const pluginVersion = me.body?.plugin_version ?? me.body?.data?.plugin_version ?? null;
const presets = await walk('design_controls/presets?type=spacing');
const designs = (presets.rows || []).map((d) => ({ id: d.id, title: d.title, category: d.category, computer: px(d.css_default), phone: px(d.css_mobile) ?? px(d.css_default) }))
  .filter((d) => d.computer !== null);
if (!designs.length) { say('This store has no Spacing designs (design_controls/presets?type=spacing): its plugin is older than this skill. Stop and say so.'); process.exit(1); }
// The blueprint's `spacing`: the applied blueprint, else the newest draft (as handover.mjs reads it).
let spacingRec = null;
{
  const applied = await walk('store_blueprint?status=applied');
  let row = (applied.rows || [])[0];
  if (!row) row = ((await walk('store_blueprint?status=draft')).rows || []).sort((a, b) => Number(b.version) - Number(a.version))[0];
  if (row) {
    const one = await call(`store_blueprint/${row.id}`);
    spacingRec = (one.body?.blueprint ?? one.body?.data?.blueprint)?.decisions?.spacing?.value ?? null;
  }
}
const CL_SPACING = { source: "the store's Spacing designs (design_controls/presets?type=spacing)", phone_below: PHONE_BELOW, designs,
  ...(spacingRec && Number(spacingRec.T) > 1 ? { T: Number(spacingRec.T) } : {}), ...(spacingRec && Number(spacingRec.line_length) > 0 ? { line_length: Number(spacingRec.line_length) } : {}) };

// ── the pages a shopper meets ─────────────────────────────────────────────────────────────────
const targets = [];
// `--only`: exactly those addresses (a page you just changed), typed by what the store says they are when it says.
const addTarget = (url, type) => {
  if (!url) return;
  const u = String(url).replace(/\/+$/, '') || SITE;
  if (ONLY && !ONLY.includes(u.split('?')[0])) return;
  if (targets.some((t) => t.url === u)) { targets.find((t) => t.url === u).type ||= type; return; }
  targets.push({ url: u, type });
};
const notMeasured = [];
addTarget(SITE, 'home');
const storeRes = await call('stores/1');
const store = rowsOf(storeRes.body)?.[0] ?? storeRes.body?.data ?? storeRes.body;
const pages = await walk('pages');
const pageUrl = (id) => (pages.rows || []).find((p) => Number(p.id) === Number(id))?.url;
const FUNNEL = { cart_page_id: 'cart', checkout_page_id: 'checkout', order_tracking_page_id: 'track order', my_account_page_id: 'account', reviews_page_id: 'reviews' };
for (const [k, type] of Object.entries(FUNNEL)) addTarget(pageUrl(store?.[k]), type);
if (store?.search_page_id && pageUrl(store.search_page_id)) addTarget(`${pageUrl(store.search_page_id).replace(/\/+$/, '')}/?cl_search=a`, 'search');
for (const p of pages.rows || []) {
  if (p.status !== 'publish' || Number(p.id) === Number(store?.thankyou_page_id)) continue;
  addTarget(p.url, 'page');
}
if (opt('--thankyou')) addTarget(opt('--thankyou'), 'thank-you'); else notMeasured.push('the thank-you page — it needs an order: pass --thankyou <its address after a test order>');
const cats = await walk('categories');
addTarget((cats.rows || []).find((c) => c.url)?.url, 'category');
addTarget(`${SITE}/product`, 'all products');
const products = (await walk('products')).rows || [];
const soldOut = (p) => p.stock_mode && p.stock_mode !== 'off' && Number(p.stock_qty) <= 0 && p.allow_backorders !== 'yes';
const hasOptions = (p) => (Array.isArray(p.variations) ? p.variations.length : Number(p.variations) || 0) > 0;
addTarget(products.find((p) => !soldOut(p) && !hasOptions(p))?.url, 'product');
addTarget(products.find((p) => hasOptions(p) && !soldOut(p))?.url, 'product with options');
addTarget(products.find(soldOut)?.url, 'product sold out');
const aff = await call('affiliate/settings');
if (aff.status === 200 && String((rowsOf(aff.body)?.[0] ?? aff.body)?.is_active ?? '') === 'yes') {
  for (const p of products.slice(0, 40)) {
    const r = await call(`product/affiliate?product_id=${encodeURIComponent(p.id)}`);
    const row = rowsOf(r.body)?.[0] ?? r.body;
    if (String(row?.is_active ?? '') === 'yes' && (row?.links || []).some((l) => l?.usable === true)) { addTarget(p.url, 'product sold through links'); break; }
  }
}
addTarget(`${SITE}/live-check-missing-page-${Date.now()}`, '404');
for (const u of ONLY || []) if (!targets.some((t) => t.url === u)) targets.push({ url: u, type: /\/product\/[^/]+$/.test(u) ? 'product' : 'page' });

// ── Chrome ────────────────────────────────────────────────────────────────────────────────────
const CANDIDATES = [process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'].filter(Boolean);
const chrome = CANDIDATES.find((p) => existsSync(p));
if (!chrome) { say('No Chrome found: install Google Chrome, or set CHROME to its path.'); process.exit(1); }
const profile = mkdtempSync(join(tmpdir(), 'live-check-'));
const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--hide-scrollbars', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
let port = null;
for (let i = 0; i < 100 && !port; i++) {
  await sleep(150);
  try { port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]); } catch { /* not yet */ }
}
let pageTarget = null;
for (let i = 0; i < 50 && port && !pageTarget; i++) {
  try { pageTarget = (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())).find((t) => t.type === 'page'); } catch { await sleep(200); }
}
if (!pageTarget) { say(`Chrome did not start (${chrome}).`); proc.kill(); process.exit(1); }
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
const events = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } else if (msg.method) events.push(msg.method);
});
const send = (method, params = {}) => new Promise((res) => { const i = ++seq; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value ?? (r.result?.exceptionDetails ? { error: r.result.exceptionDetails.exception?.description || 'script error' } : null);
};
const desktopUA = String((await send('Browser.getVersion')).result?.userAgent || '').replace('HeadlessChrome', 'Chrome');
const PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
await send('Page.enable');
await send('DOM.enable');
await send('CSS.enable');
const JOINS = readFileSync(join(here, 'joins.js'), 'utf8');

async function open(url, width) {
  const phone = width < PHONE_BELOW;
  // A fresh device each time: switching a tab from 1440 to a phone kept the earlier zoom (a "390" page drawn 601 wide).
  await send('Emulation.clearDeviceMetricsOverride');
  await send('Emulation.setDeviceMetricsOverride', { width, height: phone ? 844 : 900, deviceScaleFactor: 1, mobile: phone, screenWidth: width, screenHeight: phone ? 844 : 900 });
  await send('Emulation.setUserAgentOverride', { userAgent: phone ? PHONE_UA : desktopUA });
  await send('Emulation.setTouchEmulationEnabled', { enabled: phone, maxTouchPoints: phone ? 5 : 1 });
  // Touch emulation alone leaves (pointer: coarse) on once set: say what each width is, a finger or a mouse.
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: phone ? 'coarse' : 'fine' }, { name: 'any-pointer', value: phone ? 'coarse' : 'fine' },
    { name: 'hover', value: phone ? 'none' : 'hover' }, { name: 'any-hover', value: phone ? 'none' : 'hover' }] });
  events.length = 0;
  await send('Page.navigate', { url });
  for (let i = 0; i < 150 && !events.includes('Page.loadEventFired'); i++) await sleep(200);
  await sleep(2500);
  await send('Emulation.resetPageScaleFactor');
  // Through the page and back, so lazy photos load.
  await evaluate('(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); } scrollTo(0, 0); await new Promise((r) => setTimeout(r, 600)); return 1; })()');
  const challenge = await evaluate("/just a moment|verify you are human|checking your browser|attention required/i.test(document.title + ' ' + (document.body ? document.body.innerText.slice(0, 400) : '')) || !!document.querySelector('#challenge-form, .cf-challenge, [id^=cf-chl]')");
  return { phone, challenge };
}
const slug = (t) => `${(t.type || 'page').replace(/[^a-z0-9]+/gi, '-')}-${new URL(t.url).pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root'}`.toLowerCase().slice(0, 80);

async function measure(t, width, label, overlay) {
  const prelude = `window.CL_SPACING = ${JSON.stringify({ ...CL_SPACING, draw: STRIPS })};\nwindow.CL_JOINS_PAGE = ${JSON.stringify(t.type || 'page')};\n`
    + (overlay ? `window.CL_JOINS_OPEN = ${JSON.stringify(overlay)};\n` : 'window.CL_JOINS_OPEN = undefined;\n');
  const result = await evaluate(prelude + JOINS);
  if (!result || result.error) return { error: result?.error || 'joins.js returned nothing' };
  result.runner = { tool: 'live-check.mjs', page: t.url, page_type: t.type, width, state: label || null, overlay: overlay || null, plugin_version: pluginVersion };
  const name = `${slug(t)}-${width}${label ? `-${label}` : ''}${overlay ? `-${overlay.replace(/\s+/g, '-')}` : ''}`;
  if (!overlay && !label?.includes('open')) result.findings.push(...await states());
  const strips = [];
  if (STRIPS) {
    const h = await evaluate('[innerHeight, document.documentElement.scrollHeight]');
    const [vh, total] = Array.isArray(h) ? h : [900, 900];
    const count = overlay ? 1 : Math.min(20, Math.ceil(total / vh));
    for (let i = 0; i < count; i++) {
      if (!overlay) await evaluate(`scrollTo(0, ${i * vh}); 1`);
      await sleep(250);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      if (shot.result?.data) { const f = `${name}-strip-${String(i + 1).padStart(2, '0')}.png`; writeFileSync(join(OUT, f), Buffer.from(shot.result.data, 'base64')); strips.push(f); }
    }
    await evaluate("document.querySelectorAll('[data-cl-joins-draw]').forEach((n) => n.parentNode.removeChild(n)); scrollTo(0, 0); 1");
  }
  result.runner.strips = strips;
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(result, null, 2));
  return { name, findings: result.findings.length, strips: strips.length };
}

// L4 across states: one control of each kind, :hover and :focus forced, its box measured before and after.
async function states() {
  const doc = await send('DOM.getDocument', { depth: 0 });
  const root = doc.result?.root?.nodeId;
  if (!root) return [];
  const q = await send('DOM.querySelectorAll', { nodeId: root, selector: 'a[href], button, [role="button"], summary, label[for], input:not([type="hidden"]), select' });
  const seen = new Set();
  const out = [];
  for (const nodeId of (q.result?.nodeIds || []).slice(0, 400)) {
    if (seen.size >= 30) break;
    const d = await send('DOM.describeNode', { nodeId });
    const n = d.result?.node;
    if (!n) continue;
    const attrs = {};
    for (let i = 0; i < (n.attributes || []).length; i += 2) attrs[n.attributes[i]] = n.attributes[i + 1];
    const kind = `${n.nodeName}.${String(attrs.class || '').split(/\s+/).filter((c) => c && !/\d/.test(c)).sort().join('.')}`;
    if (seen.has(kind)) continue;
    const before = await send('DOM.getBoxModel', { nodeId });
    const b = before.result?.model;
    // Under 4px it is not seen at rest: a skip link appearing on focus is how it is meant to work.
    if (!b || b.width < 4 || b.height < 4) continue;
    seen.add(kind);
    for (const st of ['hover', 'focus']) {
      await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [st] });
      const after = (await send('DOM.getBoxModel', { nodeId })).result?.model;
      await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      if (after && (Math.abs(after.width - b.width) > 0.5 || Math.abs(after.height - b.height) > 0.5)) {
        out.push({ check: 'L4', law: 'L4', family: 'spacing', law_name: 'same job, same spacing', rule: 'states', where: kind.toLowerCase(),
          detail: `grows from ${Math.round(b.width)} × ${Math.round(b.height)} to ${Math.round(after.width)} × ${Math.round(after.height)}px when ${st === 'hover' ? 'hovered' : 'focused'} — a control keeps its size in every state: move the change into colour or an outline`,
          measured: { before: [Math.round(b.width), Math.round(b.height)], after: [Math.round(after.width), Math.round(after.height)] } });
        break;
      }
    }
  }
  return out;
}

// The overlays a shopper opens: the cart drawer (adding a product), the checkout pop-up (from the drawer), a quick view.
const OPEN_PANEL = `(() => { const W = innerWidth; return Array.from(document.querySelectorAll('body *')).some((el) => { const cs = getComputedStyle(el); if (cs.position !== 'fixed' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false; const r = el.getBoundingClientRect(); return r.width >= 200 && r.height >= 200 && r.left < W && r.right > 0 && r.top < innerHeight && r.bottom > 0 && /[\\p{L}\\p{N}]/u.test(el.innerText || ''); }); })()`;
const clickFirst = (selectors, textRe) => `(() => { const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
  for (const s of ${JSON.stringify(selectors)}) { const el = Array.from(document.querySelectorAll(s)).find(vis); if (el) { el.click(); return s; } }
  ${textRe ? `const t = Array.from(document.querySelectorAll('a, button')).find((el) => vis(el) && ${textRe}.test((el.innerText || el.getAttribute('aria-label') || '').trim())); if (t) { t.click(); return 'text'; }` : ''}
  return null; })()`;
const ADD = ['#cl_addtocart_button button', '.cl_addtocart_button button', 'button.add-to-cart-bt-button', 'form.cart button[type="submit"]', 'button[name="add-to-cart"]'];
const QUICK = ['.cl_product .cl-quickview-bt', '.cl-quickview-bt', '[data-quickview]', '.quick-view'];
const CHECKOUT = /^(checkout|check out|commander|passer (la|à la) commande|finaliser|الدفع|إتمام الطلب|order now)/i;

mkdirSync(OUT, { recursive: true });
const index = { tool: 'live-check.mjs', site: SITE, plugin_version: pluginVersion, measured_at: new Date().toISOString(), widths: WIDTHS,
  steps_from: CL_SPACING.source, designs, T: CL_SPACING.T ?? 1.15, pages: [], not_measured: notMeasured };
let failed = 0;
say(`live-check: ${targets.length} page(s) × ${WIDTHS.length} width(s) — ${SITE} (plugin ${pluginVersion ?? '?'}), into ${OUT}`);
for (const t of targets) {
  const entry = { url: t.url, type: t.type, runs: [], overlays: {}, errors: [] };
  for (const width of WIDTHS) {
    const o = await open(t.url, width);
    if (o.challenge) { entry.errors.push(`${width}: the host's bot check answered — measure this page by hand`); failed++; break; }
    const hasToggles = await evaluate("document.querySelectorAll('details, [is_open]').length");
    const set = (open) => evaluate(`document.querySelectorAll('details').forEach((d) => { d.open = ${open}; }); document.querySelectorAll('[is_open]').forEach((d) => d.setAttribute('is_open', '${open ? 'yes' : 'no'}')); new Promise((r) => setTimeout(() => r(1), 400))`);
    for (const label of hasToggles ? ['closed', 'open'] : [null]) {
      if (label) await set(label === 'open');
      const m = await measure(t, width, label, null);
      if (m.error) { entry.errors.push(`${width}${label ? ` ${label}` : ''}: ${m.error}`); failed++; } else entry.runs.push(m);
    }
    // Overlays, on the pages a shopper opens them from.
    if (['home', 'category', 'all products'].includes(t.type)) {
      await open(t.url, width);
      const hit = await evaluate(clickFirst(QUICK, null));
      await sleep(3500);
      if (hit && await evaluate(OPEN_PANEL)) { const m = await measure(t, width, null, 'quick view'); entry.overlays['quick view'] = (entry.overlays['quick view'] || []).concat(width); if (!m.error) entry.runs.push(m); }
      else entry.overlays['quick view'] ??= 'not opened';
    }
    if (t.type === 'product') {
      await open(t.url, width);
      const hit = await evaluate(clickFirst(ADD, null));
      await sleep(4500);
      if (hit && await evaluate(OPEN_PANEL)) {
        const m = await measure(t, width, null, 'cart drawer');
        entry.overlays['cart drawer'] = (entry.overlays['cart drawer'] || []).concat(width);
        if (!m.error) entry.runs.push(m);
        const go = await evaluate(clickFirst(['.cl-cart-checkout-bt', 'a[href*="checkout"]'], CHECKOUT));
        await sleep(4500);
        if (go && await evaluate(OPEN_PANEL)) { const c = await measure(t, width, null, 'checkout popup'); entry.overlays['checkout popup'] = (entry.overlays['checkout popup'] || []).concat(width); if (!c.error) entry.runs.push(c); }
        else entry.overlays['checkout popup'] ??= 'not a pop-up on this store (or not opened)';
      } else entry.overlays['cart drawer'] ??= 'not opened (adding to cart may open a page)';
    }
  }
  index.pages.push(entry);
  const n = entry.runs.reduce((s, r) => s + r.findings, 0);
  say(`  ${t.type.padEnd(28)} ${t.url}  — ${entry.runs.length} run(s), ${n} finding(s)${entry.errors.length ? `; NOT MEASURED: ${entry.errors.join('; ')}` : ''}`);
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2));
const strips = index.pages.reduce((s, p) => s + p.runs.reduce((a, r) => a + r.strips, 0), 0);
say(`\n${strips} strip(s) saved in ${OUT} — open every one. Then: node scripts/handover.mjs ${SITE} <api-key> --joins "${OUT}"`);
for (const n of notMeasured) say(`  not measured: ${n}`);
ws.close();
proc.kill();
await sleep(500);
try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome still releasing it */ }
process.exit(failed ? 1 : 0);
