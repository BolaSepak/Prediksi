// Fungsi murni (mengembalikan string HTML / data). Tidak menyentuh DOM, jadi bisa diuji di Node.
import { esc, pct, acc, fmtLine, fmtTime } from './util.js';
import { pickOptions, hdpPick } from './picks.js';

// Catatan "Pratinjau" (laga malam dari update pagi) otomatis hilang setelah 21:30 WIB pada tanggal update itu,
// walaupun update 21:00 di mesin utama gagal.
let genAt = null;
export const setGeneratedAt = t => { genAt = t ? new Date(t).getTime() : null; };
export function previewOn(now = Date.now()) {
  if (!genAt) return true;
  const w = new Date(genAt + 7 * 3600e3);   // WIB = UTC+7
  const cutoff = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate(), 21, 30) - 7 * 3600e3;
  return now < cutoff;
}
export const slotOf = m => { if (m.slot) return m.slot; const h = (new Date(m.kickoff).getUTCHours() + 7) % 24; return h >= 6 && h < 21 ? 'pagi' : 'malam'; };
export const levelOf = conf => (conf >= 50 ? 'high' : conf >= 30 ? 'medium' : 'low');
const pickLabel = (p, k) => (k === '1' ? `${p.home.name} menang` : k === '2' ? `${p.away.name} menang` : 'Seri');

const formHtml = f => (f ? `<span class="form">${f.slice(-5).split('').map(c => `<i class="${esc(c)}">${esc(c)}</i>`).join('')}</span>` : '');
function srcHtml(s) {
  if (s === 'market') return '<em class="src ai" title="Tidak ada klasemen/Elo: prediksi dari odds pasar (keyakinan dipotong)">Pasar</em>';
  if (s === 'elo') return '<em class="src ai" title="Kekuatan tim dari peringkat Elo">Elo</em>';
  if (s === 'ai') return '<em class="src ai" title="Klasemen dari AI, belum terverifikasi">AI?</em>';
  if (s === 'own') return '<em class="src own" title="Klasemen dihitung dari hasil yang dikumpulkan sendiri">hasil</em>';
  return '';
}
const logo = t => (t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '');

export function vsHtml(p) {
  const { main, best } = pickOptions(p);
  return `<div class="vs pkbox"><small>xG ${p.xg.home.toFixed(2)} - ${p.xg.away.toFixed(2)}</small>${[main, best].map(o => `<div class="pk ${o.kind}"><em>${esc(o.tag)}</em><strong>${esc(o.label)}</strong><span>${pct(o.p)}</span></div>`).join('')}</div>`;
}
const sign = x => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;

export function cardRumus(p) {
  const { home: h, draw: d, away: a } = p.probs;
  const hd = hdpPick(p);
  const stakeCls = k => (['safe', 'champion', 'relegated'].includes(k) ? '' : 'live');
  const abs = p.absences ? `<div><p><b>Pemain absen/diragukan</b> (${p.absences.source === 'api' ? 'API' : p.absences.source === 'both' ? 'AI + API' : 'AI + web, belum terverifikasi'}) — xG ${sign(p.absences.adj.home)} / ${sign(p.absences.adj.away)}</p>${['home', 'away'].map(sd => `<p><b>${esc(p[sd].name)}:</b> ${p.absences[sd].length ? p.absences[sd].map(x => esc(x.name) + (x.pos !== '?' ? ` (${esc(x.pos)}${x.role === 'key' ? ', kunci' : ''})` : '') + (x.status === 'doubt' ? ' ?' : '')).join(', ') : 'tidak ada laporan'}</p>`).join('')}</div>` : '';
  const aiCtx = p.context && p.context.info && p.context.info.ai ? `<p><b>Konteks dari AI</b> (berita web): ${p.context.info.ai.signals} sinyal / ${p.context.info.ai.nSrc} sumber · xG ${sign(p.context.info.ai.xg.home)} / ${sign(p.context.info.ai.xg.away)}${p.context.tags.filter(t => t.ai).map(t => `<small style="display:block">${esc(t.label)}: ${esc(t.title || '')}</small>`).join('')}</p>` : '';
  const gp = p.picks.goals === 'Over 2.5' ? p.ou[1].over : p.ou[1].under;
  return `<article class="card pc"><header><span>${esc(p.league.name)}${p.league.country ? ' · ' + esc(p.league.country) : ''}</span><span>${esc(fmtTime(p.kickoff))}</span></header>
${p.preview && previewOn() ? '<div class="prev">⏳ Pratinjau · diperbarui 21:00–21:30 WIB</div>' : ''}
<div class="teams"><div>${logo(p.home)}<b>${esc(p.home.name)}</b><small>#${p.home.rank ?? '-'} ${formHtml(p.home.form)}${srcHtml(p.home.dataSource)}</small></div>${vsHtml(p)}<div>${logo(p.away)}<b>${esc(p.away.name)}</b><small>#${p.away.rank ?? '-'} ${formHtml(p.away.form)}${srcHtml(p.away.dataSource)}</small></div></div>
<div class="bar"><span class="h" style="width:${pct(h)}">${pct(h)}</span><span class="d" style="width:${pct(d)}">${pct(d)}</span><span class="a" style="width:${pct(a)}">${pct(a)}</span></div>
<div class="odds">Fair odds: ${p.fairOdds.home} / ${p.fairOdds.draw} / ${p.fairOdds.away}</div>
<div class="chips"><span class="chip ${p.confidenceLevel}">Keyakinan ${p.confidence}</span><span class="chip">Prediksi 1X2: ${esc(p.picks.result)}</span>
${Math.abs(h - a) < 0.05 ? `<span class="chip tight">⚖️ Ketat · Seri ${pct(d)}</span>` : ''}${p.picks.safe ? `<span class="chip">Aman: ${esc(p.picks.safe)}</span>` : ''}
${hd ? `<span class="chip">HDP: ${esc(hd.label)} (${pct(hd.p)})</span>` : ''}<span class="chip">${esc(p.picks.goals)} (${pct(gp)})</span>
${p.market ? `<span class="chip" title="${p.market.books} bandar">Pasar ${pct(p.market.home)}/${pct(p.market.draw)}/${pct(p.market.away)}</span>` : ''}
${p.absences ? `<span class="chip">🩹 Absen ${p.absences.home.length}-${p.absences.away.length}</span>` : ''}
${p.stakes ? `<span class="chip stake ${stakeCls(p.stakes.home.kind)}">🎯 ${esc(p.home.name)}: ${esc(p.stakes.home.label)}</span><span class="chip stake ${stakeCls(p.stakes.away.kind)}">🎯 ${esc(p.away.name)}: ${esc(p.stakes.away.label)}</span>` : ''}
${(p.context ? p.context.tags : []).map(t => `<span class="chip ctx ${esc(t.kind)}${t.ai ? ' aisrc' : ''}" title="${esc(t.title || '')}">${esc(t.label)}</span>`).join('')}
<span class="chip">BTTS ${pct(p.btts.yes)}</span><span class="chip">AH adil ${fmtLine(p.fairHandicap)}</span></div>
<p class="ai">${esc(p.aiSummary)}</p>
${p.aiOpinion ? `<p class="aiop"><b>🤖 Opini AI:</b> ${esc(pickLabel(p, p.aiOpinion.pick))}${p.aiOpinion.score ? ` (${esc(p.aiOpinion.score)})` : ''} · <span class="${p.aiOpinion.agree ? 'ok' : 'no'}">${p.aiOpinion.agree ? 'sepakat dengan rumus' : 'beda dengan rumus'}</span><br><small>${esc(p.aiOpinion.reason)}</small></p>` : ''}
<details><summary>Detail skor, gol & handicap</summary>${abs}${aiCtx}
${p.modelProbs ? `<p><b>Sumber peluang:</b> model ${pct(p.modelProbs.home)}/${pct(p.modelProbs.draw)}/${pct(p.modelProbs.away)}${p.market ? ` · pasar ${pct(p.market.home)}/${pct(p.market.draw)}/${pct(p.market.away)} (bobot ${pct((p.calib && p.calib.marketW) || 0)})` : ' · tanpa data pasar'} → akhir ${pct(h)}/${pct(d)}/${pct(a)}</p>` : ''}
${p.conf ? `<p><b>Keyakinan ${p.confidence}</b> = ketegasan ${pct(p.conf.core)} × kualitas data ${pct(p.conf.quality)} × kesepakatan sumber ${pct(p.conf.agreement)}${p.conf.comp < 1 ? ` × laga persahabatan ${pct(p.conf.comp)}` : ''}</p>` : ''}
<p><b>Skor teratas:</b> ${p.topScores.map(s => `${esc(s.score)} (${pct(s.p)})`).join(' · ')}</p>
<p><b>Over/Under:</b> ${p.ou.map(o => `${o.line}: O ${pct(o.over)} / U ${pct(o.under)}`).join(' · ')}</p>
<p><b>Double chance:</b> 1X ${pct(p.doubleChance.hx)} · X2 ${pct(p.doubleChance.xa)} · 12 ${pct(p.doubleChance.ha)}</p>
<div class="scroll"><table><thead><tr><th>Handicap ${esc(p.home.name)}</th><th>Peluang menang*</th><th>Fair odds</th><th>Push</th></tr></thead><tbody>${p.handicap.map(x => `<tr class="${x.line === p.fairHandicap ? 'hl' : ''}"><td>${fmtLine(x.line)}</td><td>${pct(x.pCover)}</td><td>${x.fairOdds}</td><td>${pct(x.push)}</td></tr>`).join('')}</tbody></table></div>
<small>*win + ½ half-win. Fair odds = odds impas menurut model, bukan odds bandar.</small></details></article>`;
}

export function cardAi(p) {
  const o = p.aiOpinion; if (!o) return '';
  return `<article class="card pc"><header><span>${esc(p.league.name)}${p.league.country ? ' · ' + esc(p.league.country) : ''}</span><span>${esc(fmtTime(p.kickoff))}</span></header>
<div class="teams"><div>${logo(p.home)}<b>${esc(p.home.name)}</b></div><div class="vs">Skor AI<br><b>${esc(o.score ?? '–')}</b></div><div>${logo(p.away)}<b>${esc(p.away.name)}</b></div></div>
<div class="chips"><span class="chip">🤖 Prediksi AI: ${esc(pickLabel(p, o.pick))}</span><span class="chip">Rumus: ${esc(p.picks.result)}</span><span class="chip ${o.agree ? 'high' : 'low'}">${o.agree ? 'AI & rumus sepakat' : 'AI & rumus beda'}</span></div>
<div class="chips">${o.ou25 ? `<span class="chip">${o.ou25 === 'over' ? 'Over 2.5' : 'Under 2.5'}</span>` : ''}${o.btts ? `<span class="chip">BTTS ${o.btts === 'yes' ? 'Ya' : 'Tidak'}</span>` : ''}${o.hdp ? `<span class="chip">HDP ${esc(o.hdp.side === '1' ? p.home.name : p.away.name)} ${fmtLine(o.hdp.line)}</span>` : ''}</div>
<p class="aiop"><b>Alasan:</b> ${esc(o.reason)}</p>${o.style ? `<p class="aiop"><b>Pola permainan:</b> ${esc(o.style)}</p>` : ''}</article>`;
}

export function recsHtml(top) {
  const recs = top.filter(m => m.timestamp * 1000 > Date.now()).map(m => { const o = pickOptions(m), opts = [o.main, ...o.others.filter(x => x.strong)]; return { m, opts, s: Math.max(...opts.map(x => x.strength)) }; }).sort((a, b) => b.s - a.s);
  if (!recs.length) return '';
  return `<h2 class="sec">🎯 Rekomendasi pick <small>(1X2, HDP -/+, Over/Under, BTTS · laga yang belum mulai)</small></h2><div class="recs">${recs.map(({ m, opts }) => `<div class="rec"><span class="rt">${esc(m.home.name)} vs ${esc(m.away.name)}<small>${esc(m.league.name)} · ${esc(fmtTime(m.kickoff))}</small></span><div class="ropts">${opts.map(o => `<span class="ro ${o.kind}"><em>${esc(o.tag)}</em> <b>${esc(o.label)}</b> <i>${pct(o.p)}</i></span>`).join('')}</div><span><span class="chip ${m.confidenceLevel}">Keyakinan ${m.confidence}</span></span></div>`).join('')}</div>`;
}

export function aiTrackHtml(c) {
  const o = c.ai && c.ai.own, f = c.ai && c.ai.formulaSame;
  if (!o || !o.n) return '<div class="track"><b>Rekam jejak AI</b> — belum ada laga berpick AI yang selesai dinilai.</div>';
  return `<div class="track"><b>Rekam jejak AI</b> · pick AI benar ${acc(o.acc)} (${o.n} laga) · rumus pada laga yang sama ${acc(f && f.acc)} · Over/Under ${acc(c.ai.ou25 && c.ai.ou25.acc)} · BTTS ${acc(c.ai.btts && c.ai.btts.acc)} · HDP menang ${acc(c.ai.hdp && c.ai.hdp.acc)} (push tidak dihitung). ${o.n < 30 ? '<small>Sampel masih sangat kecil; jangan disimpulkan.</small>' : ''}<div><button class="btn sm lav" data-act="openhist-ai" style="margin-top:6px">📜 Buka riwayat AI lengkap →</button></div></div>`;
}
export function trackHtml(c) {
  if (!c.n) return '<div class="track"><b>Rekam jejak</b> — belum ada laga yang selesai dinilai.</div>';
  return `<details class="track"><summary>Rekam jejak · ${c.n} laga dinilai · 1X2 benar ${acc(c.acc)} · Brier ${c.brier ? c.brier.toFixed(3) : '–'}</summary>
<p>Log-loss ${c.logloss ? c.logloss.toFixed(3) : '–'} (acak ${c.uniform.logloss.toFixed(3)}) · Over/Under 2.5 benar ${acc(c.ou25.acc)} (${c.ou25.n}) · BTTS benar ${acc(c.btts.acc)} (${c.btts.n})</p>
<p><b>Keyakinan tinggi lebih sering benar?</b> Tinggi ${acc(c.byLevel.high.acc)} (${c.byLevel.high.n}) · Sedang ${acc(c.byLevel.medium.acc)} (${c.byLevel.medium.n}) · Rendah ${acc(c.byLevel.low.acc)} (${c.byLevel.low.n})</p></details>`;
}

// ---------- RIWAYAT ----------
export const HTABS = [['ok', '✅ Yang Benar'], ['x12', '1X2'], ['hdp', 'HDP'], ['ou', 'Over/Under'], ['btts', 'BTTS'], ['combo', 'Gabungan']];
export const okOf = r => [r.x12.hit && '1X2', r.ou && r.ou.hit && (r.ou.pick === 'over' ? 'Over' : 'Under'), r.btts && r.btts.hit && 'BTTS', r.hdp && r.hdp.res === 'win' && 'HDP'].filter(Boolean);

/** Filter baris riwayat. f = {period:'all'|days, league:'all'|name, conf:'all'|high|medium|low, q:''} */
export function filterRows(rows, f, nowSec = Date.now() / 1000) {
  const q = (f.q || '').trim().toLowerCase(), days = f.period === 'all' ? 0 : Number(f.period);
  return rows.filter(r => (!days || r.ts >= nowSec - days * 86400) && (f.league === 'all' || r.league === f.league) && (f.conf === 'all' || levelOf(r.conf) === f.conf) && (!q || `${r.home} ${r.away}`.toLowerCase().includes(q)));
}
/** Total per pasar dari baris yang sedang tampil (ikut berubah saat filter dipakai). */
export function computeTotals(rows) {
  const mk = () => ({ n: 0, hit: 0, acc: null });
  const t = { x12: mk(), ou25: mk(), btts: mk(), hdp: mk(), hdpPush: 0, overall: mk(), combo3: mk(), combo4: mk() };
  const add = (m, hit) => { m.n++; if (hit) m.hit++; };
  for (const r of rows) {
    add(t.x12, r.x12.hit); if (r.ou) add(t.ou25, r.ou.hit); if (r.btts) add(t.btts, r.btts.hit);
    if (r.hdp) { if (r.hdp.res === 'push') t.hdpPush++; else add(t.hdp, r.hdp.res === 'win'); }
    if (r.combo3 !== null && r.combo3 !== undefined) add(t.combo3, r.combo3 === true);
    if (r.combo4 !== null && r.combo4 !== undefined) add(t.combo4, r.combo4 === true);
  }
  t.overall.n = t.x12.n + t.ou25.n + t.btts.n + t.hdp.n; t.overall.hit = t.x12.hit + t.ou25.hit + t.btts.hit + t.hdp.hit;
  for (const k of ['x12', 'ou25', 'btts', 'hdp', 'overall', 'combo3', 'combo4']) t[k].acc = t[k].n ? t[k].hit / t[k].n : null;
  return t;
}
const pk1 = (home, away, k) => (k === '1' ? `${home} menang` : k === '2' ? `${away} menang` : 'Seri');
/** Baris riwayat -> item per pasar. res: 'ok' | 'no' | 'push' */
export function itemsFor(rows, tab) {
  const out = [];
  for (const r of rows) {
    const label = `${r.home} ${r.score} ${r.away}`, title = `${r.league || ''} · ${fmtTime(new Date(r.ts * 1000).toISOString())} · keyakinan ${r.conf}`;
    const it = (res, note) => out.push({ id: r.id, label, res, note, title });
    const ok = b => (b ? 'ok' : 'no'), m = b => (b ? '✓' : '✗');
    if (tab === 'ok') { const w = okOf(r); it(w.length ? 'ok' : 'no', w.map(x => `${x} ✓`).join(' · ')); }
    else if (tab === 'x12') it(ok(r.x12.hit), pk1(r.home, r.away, r.x12.pick));
    else if (tab === 'ou') { if (r.ou) it(ok(r.ou.hit), `${r.ou.pick === 'over' ? 'Over' : 'Under'} 2.5`); }
    else if (tab === 'btts') { if (r.btts) it(ok(r.btts.hit), `BTTS ${r.btts.pick === 'yes' ? 'Ya' : 'Tidak'}`); }
    else if (tab === 'hdp') { if (r.hdp) it(r.hdp.res === 'win' ? 'ok' : r.hdp.res === 'loss' ? 'no' : 'push', `${r.hdp.side === '1' ? r.home : r.away} ${fmtLine(r.hdp.line)}${r.hdp.res === 'push' ? ' (push)' : ''}`); }
    else if (r.combo3 !== null && r.combo3 !== undefined && r.ou && r.btts) it(ok(r.combo3), `1X2 ${m(r.x12.hit)} · O/U ${m(r.ou.hit)} · BTTS ${m(r.btts.hit)}${r.hdp ? ` · HDP ${r.hdp.res === 'win' ? '✓' : r.hdp.res === 'loss' ? '✗' : '↔'}` : ''}`);
  }
  return out;
}
export function okSummary(rows) {
  const agg = [['1X2', { n: 0, hit: 0 }], ['Over/Under 2.5', { n: 0, hit: 0 }], ['BTTS', { n: 0, hit: 0 }], ['HDP', { n: 0, hit: 0 }]];
  const add = (i, hit) => { agg[i][1].n++; if (hit) agg[i][1].hit++; };
  let any = 0;
  for (const r of rows) { add(0, r.x12.hit); if (r.ou) add(1, r.ou.hit); if (r.btts) add(2, r.btts.hit); if (r.hdp && r.hdp.res !== 'push') add(3, r.hdp.res === 'win'); if (okOf(r).length) any++; }
  return { n: rows.length, any, rank: agg.filter(([, v]) => v.n > 0).sort((a, b) => b[1].hit / b[1].n - a[1].hit / a[1].n || b[1].n - a[1].n) };
}
const tot = t => (t && t.n ? `${t.hit}/${t.n} (${acc(t.acc)})` : '–');
export function statsHtml(rows, tab) {
  const t = computeTotals(rows);
  let h = `<h2 class="sec">🏆 Total benar <small>(${rows.length} laga sesuai filter)</small></h2><div class="stats"><div><small>Tebak menang (1X2)</small><b>${tot(t.x12)}</b></div><div><small>Over/Under 2.5</small><b>${tot(t.ou25)}</b></div><div><small>BTTS</small><b>${tot(t.btts)}</b></div><div><small>HDP (push ${t.hdpPush} tidak dihitung)</small><b>${tot(t.hdp)}</b></div></div>
<h2 class="sec">📈 Winrate</h2><div class="stats"><div><small>Keseluruhan · semua tebakan digabung</small><b>${tot(t.overall)}</b></div><div><small>Gabungan 3 pasar · 1X2 + O/U + BTTS</small><b>${tot(t.combo3)}</b></div><div><small>Gabungan 4 pasar · + HDP</small><b>${tot(t.combo4)}</b></div></div>`;
  if (tab === 'ok' && rows.length) {
    const o = okSummary(rows);
    h += `<h2 class="sec">🎯 Laga yang ada tebakan benarnya</h2><div class="stats"><div><small>Minimal 1 pasar benar · dari ${o.n} laga</small><b>${o.any}/${o.n} (${acc(o.any / o.n)})</b></div><div><small>Tidak ada satu pun yang benar</small><b>${o.n - o.any}/${o.n} (${acc((o.n - o.any) / o.n)})</b></div></div><h2 class="sec">🏅 Pasar paling sering benar</h2><div class="stats">${o.rank.map(([k, v], i) => `<div><small>${i + 1}. ${esc(k)}${i === 0 ? ' · paling sering benar' : ''}</small><b>${v.hit}/${v.n} (${acc(v.hit / v.n)})</b></div>`).join('')}</div>`;
  }
  return h;
}
export const mark = r => (r === 'ok' ? '✓' : r === 'no' ? '✗' : '↔');
export function itemHtml(i, tab) {
  return `<span class="${i.res}" title="${esc(i.title)}">${tab === 'ok' ? `${esc(i.label)}${i.note ? `<br><small>${esc(i.note)}</small>` : ''}` : `${mark(i.res)} ${esc(i.label)} <small>· ${esc(i.note)}</small>`}</span>`;
}
