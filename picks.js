// Port dari shared/picks.ts (logika pilihan pasar, tanpa double chance)
import { fmtLine } from './util.js';
export const MIN_P = 0.6;
const short = n => (n.length > 14 ? n.slice(0, 13) + '…' : n);
const eff = (win, halfWin, push, halfLoss) => win + 0.75 * halfWin + 0.5 * push + 0.25 * halfLoss;

export function pickOptions(p, minP = MIN_P) {
  const { home: h, draw: d, away: a } = p.probs;
  const top = h >= d && h >= a ? '1' : a >= h && a >= d ? '2' : 'X';
  const pTop = top === '1' ? h : top === '2' ? a : d;
  const main = { kind: '1x2', tag: '1X2', label: top === '1' ? `${p.home.name} menang` : top === '2' ? `${p.away.name} menang` : 'Seri', p: pTop, strength: (pTop - 1 / 3) / (2 / 3), strong: true };
  const others = [];
  const o = (p.ou || []).find(x => x.line === 2.5) || (p.ou || [])[1];
  if (o) { const over = o.over >= 0.5, pO = over ? o.over : o.under; others.push({ kind: 'ou', tag: 'O/U', label: `${over ? 'Over' : 'Under'} 2.5`, p: pO, strength: ((pO - 0.5) / 0.5) * 0.95, strong: pO >= minP }); }
  const yes = p.btts.yes >= 0.5, pB = yes ? p.btts.yes : p.btts.no;
  others.push({ kind: 'btts', tag: 'BTTS', label: yes ? 'Ya' : 'Tidak', p: pB, strength: ((pB - 0.5) / 0.5) * 0.95, strong: pB >= minP });
  const favHome = h >= a;
  const side = isHome => (p.handicap || []).map(x => ({ line: isHome ? x.line : -x.line, e: isHome ? eff(x.win, x.halfWin, x.push, x.halfLoss) : eff(x.loss, x.halfLoss, x.push, x.halfWin) }));
  let fav = null;
  for (const x of side(favHome)) if (x.line < 0 && x.line >= -1.5 && x.e >= minP && (!fav || x.line < fav.line)) fav = x;
  if (fav) others.push({ kind: 'hdpFav', tag: 'HDP -', label: `${short(favHome ? p.home.name : p.away.name)} ${fmtLine(fav.line)}`, p: fav.e, strength: ((fav.e - 0.5) / 0.5) * 0.9, strong: true, side: favHome ? '1' : '2', line: fav.line });
  let dog = null;
  for (const x of side(!favHome)) if (x.line > 0 && x.line <= 2 && x.e >= minP && (!dog || x.line < dog.line)) dog = x;
  if (dog) others.push({ kind: 'hdpDog', tag: 'HDP +', label: `${short(favHome ? p.away.name : p.home.name)} ${fmtLine(dog.line)}`, p: dog.e, strength: ((dog.e - 0.5) / 0.5) * 0.9, strong: true, side: favHome ? '2' : '1', line: dog.line });
  others.sort((x, y) => y.strength - x.strength);
  return { main, others, best: others[0] };
}
export function hdpPick(p, minP = MIN_P) {
  for (const t of [minP, 0.55, 0.5]) {
    const o = pickOptions(p, Math.min(t, minP)).others.find(x => x.kind === 'hdpFav' || x.kind === 'hdpDog');
    if (o) return o;
  }
  return undefined;
}
