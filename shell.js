// Kerangka halaman bersama: header + hamburger (gaya FucktheRules) dan sidebar (laci di HP, sidebar tetap/rail ikon di desktop ala Jurnal).
import { $, esc } from './util.js';
const KEY = 'bolasepak.side.wide', mq = matchMedia('(min-width:900px)');
let items = [], cur = null, handler = () => {};
const side = $('#side'), scrim = $('#scrim'), burger = $('#burger');
const isWide = () => { try { const v = localStorage.getItem(KEY); return v === null ? true : v === '1'; } catch { return true; } };

function layout() { side.classList.toggle('wide', mq.matches && isWide()); }
function open(f) { side.classList.toggle('show', f); scrim.classList.toggle('show', f); document.body.classList.toggle('noscroll', f && !mq.matches); burger.setAttribute('aria-expanded', f ? 'true' : 'false'); }
function paint() {
  side.innerHTML = `<div class="sd-head"><a class="sd-brand" href="./"><img src="logo.png" alt=""><strong>bolasepak</strong></a><button type="button" class="sd-x" data-close>tutup</button></div>` +
    items.map(it => it.g ? `<p class="dgroup">${esc(it.g)}</p>`
      : `<a class="dlink${it.id === cur ? ' on' : ''}" data-id="${esc(it.id)}" href="${esc(it.href || '#')}"${it.ext ? ' target="_blank" rel="noopener"' : ''}${it.id === cur ? ' aria-current="page"' : ''} title="${esc(it.lb)}"><span class="ic">${it.ic}</span><span class="lb">${esc(it.lb)}</span><em class="bd${it.n ? '' : ' hidden'}">${it.n || ''}</em></a>`).join('');
}
burger.addEventListener('click', () => {
  if (mq.matches) { try { localStorage.setItem(KEY, isWide() ? '0' : '1'); } catch {} layout(); }
  else open(!side.classList.contains('show'));
});
scrim.addEventListener('click', () => open(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') open(false); });
mq.addEventListener && mq.addEventListener('change', () => { open(false); layout(); });
side.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) return open(false);
  const a = e.target.closest('a.dlink'); if (!a) return;
  open(false);
  if (a.getAttribute('href') === '#') { e.preventDefault(); handler(a.dataset.id); }
});
layout();

/** Isi menu. list: [{g:'judul grup'} | {id, ic, lb, href?, ext?, n?}], activeId = menu yang sedang aktif. */
export function set(list, activeId) { items = list; if (activeId !== undefined) cur = activeId; paint(); }
export function active(id) { cur = id; paint(); }
export function badge(id, n) { const it = items.find(x => x.id === id); if (it && it.n !== n) { it.n = n; paint(); } }
export function onNav(fn) { handler = fn; }
