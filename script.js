import { $, $$, esc, pct, fmtTime, toast } from './util.js';
import * as G from './gate.js';
import * as R from './render.js';
import { DATA_BASE, TELEGRAM_LINK } from './config.js';
import * as Shell from './shell.js';
const S = { view: 'prediksi', tab: 'rumus', sesi: 'all', league: 'home', menu: false, q: '', sort: 'time', data: null, meta: null, cal: null,
  h: { src: 'rumus', tab: 'ok', res: 'all', period: 'all', league: 'all', conf: 'all', q: '', limit: 150 } };
let sessionTimer = null, started = false;

// ---------- menu samping (hamburger di HP, sidebar di desktop) ----------
const NAV_TAIL = [{ g: 'member' }, { id: 'daftar', ic: '📝', lb: 'daftar member', href: 'daftar.html' }, { id: 'tg', ic: '✈️', lb: 'grup telegram', href: TELEGRAM_LINK, ext: true }];
const NAV_LOCK = [{ g: 'menu' }, { id: 'masuk', ic: '🔑', lb: 'masukkan kode' }, ...NAV_TAIL];
const NAV_IN = [{ g: 'prediksi' }, { id: 'rumus', ic: '📊', lb: 'rumus' }, { id: 'ai', ic: '🤖', lb: 'ai' }, { g: 'rekam jejak' }, { id: 'riwayat', ic: '📜', lb: 'riwayat' }, ...NAV_TAIL, { id: 'out', ic: '🚪', lb: 'keluar' }];
const syncNav = () => Shell.active(S.view === 'riwayat' ? 'riwayat' : S.tab);
Shell.onNav(id => {
  if (id === 'rumus' || id === 'ai') { setView('prediksi'); $(`#subTabs [data-tab="${id}"]`).click(); }
  else if (id === 'riwayat') setView('riwayat');
  else if (id === 'out') $('#btnOut').click();
  else if (id === 'masuk') { const i = $('#codeIn'); if (i) i.focus(); }
  window.scrollTo(0, 0);
});

boot();
async function boot() {
  Shell.set(NAV_LOCK, 'masuk');
  $('#btnOut').addEventListener('click', () => { G.clear(); location.reload(); });
  const s = await G.restore();
  if (s) start(s); else showGate();
}

// ---------- gerbang ----------
function showGate(msg) {
  Shell.set(NAV_LOCK, 'masuk');
  $('#app').classList.add('hidden'); $('#btnOut').classList.add('hidden'); $('#gate').classList.remove('hidden');
  const inp = $('#codeIn'), err = $('#gateErr'), btn = $('#gateBtn'); err.textContent = msg || '';
  if (showGate.bound) return; showGate.bound = true;
  let fails = 0, lockUntil = 0;
  inp.addEventListener('input', () => { inp.value = G.norm(inp.value); err.textContent = ''; });
  $('#gateForm').addEventListener('submit', async e => {
    e.preventDefault();
    const wait = Math.ceil((lockUntil - Date.now()) / 1000);
    if (wait > 0) { err.textContent = `Terlalu banyak percobaan. Coba lagi ${wait} detik.`; return; }
    btn.disabled = true; btn.textContent = 'Memeriksa…';
    const v = await G.verify(inp.value);
    btn.disabled = false; btn.textContent = 'Masuk';
    if (v.ok) { G.save(v); inp.value = ''; start(v); return; }
    err.textContent = v.reason;
    if (!v.net && ++fails >= 5) { lockUntil = Date.now() + 60000; fails = 0; }
  });
  inp.focus();
}

// ---------- aplikasi ----------
function start(sess) {
  Shell.set(NAV_IN); syncNav();
  $('#gate').classList.add('hidden'); $('#app').classList.remove('hidden'); $('#btnOut').classList.remove('hidden');
  clearInterval(sessionTimer);
  sessionTimer = setInterval(async () => {   // kode berganti 00:00 WIB -> minta kode baru
    if (sess.exp <= Date.now()) { G.clear(); showGate('Kode hari ini sudah berganti. Masukkan kode baru.'); clearInterval(sessionTimer); }
  }, 30000);
  if (started) return; started = true;
  bind(); load();
}
async function load() {
  $('#warn').innerHTML = ''; $('#pContent').innerHTML = '<p class="sub">Memuat prediksi…</p>';
  const t = Date.now();
  const j = async f => { try { const r = await fetch(`${DATA_BASE}${f}?t=${t}`, { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; } };
  [S.data, S.meta, S.cal] = await Promise.all([j('predictions.json'), j('metadata.json'), j('calibration.json')]);
  if (!S.data) {
    $('#warn').innerHTML = '<div class="warn">Data prediksi belum bisa diambil dari sumbernya. <button class="btn sm" id="retry" type="button">Coba lagi</button></div>';
    $('#retry').addEventListener('click', load);
  } else if (S.meta && S.meta.status === 'failed') $('#warn').innerHTML = `<div class="warn">Update terakhir gagal (${esc(S.meta.message)}). Menampilkan prediksi terakhir yang berhasil.</div>`;
  if (S.data) $('#meta').textContent = `Laga ${fmtTime(S.data.window.start)} → ${fmtTime(S.data.window.end)} · diperbarui ${fmtTime(S.data.generatedAt)} · update otomatis 05:30, 07:10 & 21:00 WIB`;
  renderPrediksi(); if (S.view === 'riwayat') renderRiwayat();
}

// ---------- prediksi ----------
const matches = () => (S.data ? S.data.matches : []);
const inSesi = () => matches().filter(m => S.sesi === 'all' || R.slotOf(m) === S.sesi);
function topList(ms) {
  const now = Date.now(), byConf = (a, b) => b.confidence - a.confidence || ((b.headline && b.headline.strength) || 0) - ((a.headline && a.headline.strength) || 0);
  const rank = xs => [...xs.filter(m => m.timestamp * 1000 > now - 0.5 * 3.6e6).sort(byConf), ...xs.filter(m => m.timestamp * 1000 <= now - 0.5 * 3.6e6).sort(byConf)];
  const high = rank(ms.filter(m => m.confidenceLevel === 'high')).slice(0, 10);
  return high.length >= 5 ? high : [...high, ...rank(ms.filter(m => m.confidenceLevel !== 'high')).slice(0, 5 - high.length)];
}
function renderControls() {
  const ms = inSesi(), cnt = new Map();
  for (const m of ms) cnt.set(m.league.name, (cnt.get(m.league.name) || 0) + 1);
  if (S.league !== 'home' && S.league !== 'all' && !cnt.has(S.league)) S.league = 'home';
  const g = new Map();
  for (const m of ms) { const c = m.league.country || 'Lainnya'; if (!g.has(c)) g.set(c, new Map()); const l = g.get(c); l.set(m.league.name, (l.get(m.league.name) || 0) + 1); }
  const byCountry = [...g.entries()].map(([c, l]) => ({ c, l: [...l.entries()].sort((a, b) => b[1] - a[1]), n: [...l.values()].reduce((a, b) => a + b, 0) })).sort((a, b) => b.n - a.n || a.c.localeCompare(b.c));
  $('#pControls').innerHTML = `<div class="pills">${[['all', 'Seharian'], ['pagi', '☀️ 06:00–21:00'], ['malam', '🌙 21:00–06:00']].map(([k, l]) => `<button data-sesi="${k}" class="${S.sesi === k ? 'on' : ''}">${l}</button>`).join('')}</div>
<div class="pills"><button data-league="home" class="${S.league === 'home' ? 'on' : ''}">🏠 Beranda</button><button data-menu class="${S.menu ? 'on' : ''}">☰ Semua liga <em>${cnt.size} liga · ${ms.length} laga</em></button>${S.league !== 'home' && S.league !== 'all' ? `<button class="on" data-league="home">${esc(S.league)} ✕</button>` : ''}</div>
${S.menu ? `<div class="lgmenu"><button data-league="all" class="${S.league === 'all' ? 'on' : ''}">Tampilkan semua laga (${ms.length})</button>${byCountry.map(c => `<div class="ctry"><b>${esc(c.c)} <em>${c.n}</em></b>${c.l.map(([n, k]) => `<button data-league="${esc(n)}" class="${S.league === n ? 'on' : ''}">${esc(n)} <em>${k}</em></button>`).join('')}</div>`).join('')}</div>` : ''}`;
}
function renderPrediksi() {
  renderControls();
  const ms = inSesi(), q = S.q.trim().toLowerCase();
  const list = ms.filter(m => (S.league === 'all' || S.league === 'home' || m.league.name === S.league) && `${m.home.name} ${m.away.name}`.toLowerCase().includes(q)).sort((a, b) => (S.sort === 'time' ? a.timestamp - b.timestamp : b.confidence - a.confidence));
  const isHome = S.league === 'home' && !q, shown = isHome ? topList(ms) : list, box = $('#pContent');
  if (!S.data) { if (!$('#retry')) box.innerHTML = ''; return; }
  if (!shown.length) { box.innerHTML = `<p class="sub">Tidak ada pertandingan pada pilihan ini${q ? ' (sesuai pencarian)' : ''}.</p>`; return; }
  if (S.tab === 'rumus') {
    box.innerHTML = (S.cal ? R.trackHtml(S.cal) : '') + (isHome ? R.recsHtml(shown) + `<h2 class="sec">🔥 Laga teratas · keyakinan tinggi <small>(${shown.length} dari ${ms.length} laga · buka “☰ Semua liga” untuk lainnya)</small></h2>` : '') + `<div class="grid">${shown.map(R.cardRumus).join('')}</div>`;
  } else {
    const ai = shown.filter(m => m.aiOpinion);
    box.innerHTML = `<p class="sub">Prediksi murni dari AI (Gemini + pencarian web), terpisah dari rumus. Hanya laga yang punya sumber web yang dianalisis (${ai.length} dari ${shown.length} laga).</p>${S.cal ? R.aiTrackHtml(S.cal) : ''}<div class="grid">${ai.map(R.cardAi).join('')}</div>${ai.length ? '' : '<p class="sub">Belum ada opini AI pada pilihan ini.</p>'}`;
  }
}

// ---------- riwayat ----------
function histRows() { const c = S.cal; return c ? (S.h.src === 'ai' ? c.aiHistory : c.history) || [] : []; }
function renderRiwayat() {
  const box = $('#vRiwayat'), c = S.cal, h = S.h;
  if (!c || !c.n) { box.innerHTML = '<div class="track"><b>Riwayat</b> — belum ada laga yang selesai dinilai. Akan terisi otomatis setelah hasil pertandingan terkumpul.</div>'; return; }
  const all = histRows(), lc = new Map();
  for (const r of all) if (r.league) lc.set(r.league, (lc.get(r.league) || 0) + 1);
  if (h.league !== 'all' && !lc.has(h.league)) h.league = 'all';
  const leagues = [...lc.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const sel = (k, opts) => `<select data-hf="${k}" aria-label="${k}">${opts.map(([v, l]) => `<option value="${esc(v)}"${String(h[k]) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  box.innerHTML = `<div class="tabs">${[['rumus', '📊 Riwayat Rumus'], ['ai', '🤖 Riwayat AI']].map(([k, l]) => `<button data-hsrc="${k}" class="${h.src === k ? 'on' : ''}">${l}</button>`).join('')}</div>
<div class="filters">${sel('period', [['all', 'Semua waktu'], ['7', '7 hari'], ['30', '30 hari'], ['90', '90 hari']])}${sel('conf', [['all', 'Semua keyakinan'], ['high', 'Keyakinan tinggi'], ['medium', 'Sedang'], ['low', 'Rendah']])}${sel('res', [['all', 'Benar & salah'], ['ok', 'Hanya benar ✓'], ['no', 'Hanya salah ✗']])}${sel('league', [['all', `Semua liga (${leagues.length})`], ...leagues.map(([n, k]) => [n, `${n} (${k})`])])}<input data-hf="q" value="${esc(h.q)}" placeholder="Cari tim…" aria-label="Cari tim"></div>
<div id="hBody"></div>`;
  renderHistBody();
}
function renderHistBody() {
  const h = S.h, rows = R.filterRows(histRows(), h), tab = h.tab;
  let items = R.itemsFor(rows, tab);
  if (h.res !== 'all') items = items.filter(i => i.res === h.res);
  const nOk = items.filter(i => i.res === 'ok').length, nNo = items.filter(i => i.res === 'no').length, nPush = items.length - nOk - nNo;
  const shown = items.slice(0, h.limit);
  $('#hBody').innerHTML = R.statsHtml(rows, tab) + `<h2 class="sec">📜 Semua laga dinilai <small>(terbaru di atas)</small></h2>
<div class="tabs">${R.HTABS.map(([k, l]) => `<button data-htab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
<p class="sub">${esc(R.HTABS.find(x => x[0] === tab)[1])}: ✓ ${nOk} · ✗ ${nNo}${nPush ? ` · ↔ ${nPush}` : ''}${nOk + nNo ? ` · benar ${Math.round(nOk / (nOk + nNo) * 100)}%` : ''}</p>
<details class="track"><summary>Cara membaca ✓ / ✗</summary><p><b>Yang Benar:</b> hanya pasar yang tebakannya benar yang ditampilkan; merah = tidak ada satu pun yang benar.</p><p><b>1X2:</b> hasil 90 menit sama dengan tebakan. <b>O/U 2.5:</b> Over bila total gol 3+. <b>BTTS:</b> Ya bila kedua tim mencetak gol. <b>HDP:</b> ✓ menang (penuh/setengah), ✗ kalah, ↔ push (tidak dihitung). <b>Gabungan:</b> benar hanya bila semua pasarnya benar.</p></details>
<div class="track"><div class="rec2 hscroll" style="display:flex;flex-wrap:wrap;gap:5px">${shown.map(i => R.itemHtml(i, tab)).join('') || '<span>Tidak ada data sesuai filter.</span>'}</div>${items.length > shown.length ? `<button class="btn sm more" data-act="more">Tampilkan lebih banyak (${items.length - shown.length} lagi)</button>` : ''}</div>`;
}

// ---------- event ----------
function bind() {
  $('#mainTabs').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (!b) return; setView(b.dataset.view); });
  $('#subTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; S.tab = b.dataset.tab; $$('#subTabs button').forEach(x => x.classList.toggle('on', x === b)); syncNav(); renderPrediksi(); });
  $('#pControls').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sesi) S.sesi = b.dataset.sesi;
    else if (b.dataset.league) { S.league = b.dataset.league; S.menu = false; }
    else if ('menu' in b.dataset) S.menu = !S.menu; else return;
    renderPrediksi();
  });
  $('#qIn').addEventListener('input', e => { S.q = e.target.value; renderPrediksi(); });
  $('#sortSel').addEventListener('change', e => { S.sort = e.target.value; renderPrediksi(); });
  $('#pContent').addEventListener('click', e => { if (e.target.closest('[data-act="openhist-ai"]')) { S.h.src = 'ai'; S.h.tab = 'ok'; setView('riwayat'); window.scrollTo(0, 0); } });
  const rv = $('#vRiwayat');
  rv.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.hsrc) { S.h.src = b.dataset.hsrc; S.h.limit = 150; renderRiwayat(); }
    else if (b.dataset.htab) { S.h.tab = b.dataset.htab; S.h.limit = 150; renderHistBody(); }
    else if (b.dataset.act === 'more') { S.h.limit += 300; renderHistBody(); }
  });
  rv.addEventListener('change', e => { const k = e.target.dataset.hf; if (!k || k === 'q') return; S.h[k] = e.target.value; S.h.limit = 150; renderHistBody(); });
  rv.addEventListener('input', e => { if (e.target.dataset.hf === 'q') { S.h.q = e.target.value; S.h.limit = 150; renderHistBody(); } });
}
function setView(v) {
  S.view = v;
  $$('#mainTabs button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  $('#vPrediksi').classList.toggle('hidden', v !== 'prediksi'); $('#vRiwayat').classList.toggle('hidden', v !== 'riwayat');
  syncNav();
  if (v === 'riwayat') renderRiwayat();
}
