// Cloudflare Worker: pembuat link grup Telegram unik untuk BOLASEPAK.
// Secrets: BOT_TOKEN, CHAT_ID (mis. -100123...), WEBHOOK_SECRET. Vars: FIREBASE_API_KEY, ADMIN_EMAILS (pisah koma), ALLOWED_ORIGIN. KV: LINKS.
const cors = env => ({ 'access-control-allow-origin': env.ALLOWED_ORIGIN || '*', 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'POST,OPTIONS' });
const out = (env, o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...cors(env) } });
const tg = async (env, method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: env.CHAT_ID, ...body }) });
  const j = await r.json(); if (!j.ok) throw new Error(j.description || 'Telegram error'); return j.result;
};
async function adminEmail(env, req) {
  const t = (req.headers.get('authorization') || '').replace(/^Bearer /, ''); if (!t) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: t }) });
  if (!r.ok) return null; const j = await r.json(), e = String(j.users && j.users[0] && j.users[0].email || '').toLowerCase();
  return String(env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).includes(e) ? e : null;
}
const known = async (env, link) => typeof link === 'string' && /^https:\/\/t\.me\/\+[\w-]+$/.test(link) && (await env.LINKS.get('link:' + link)) !== null;

export default {
  async fetch(req, env) {
    const p = new URL(req.url).pathname;
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(env) });
    if (req.method !== 'POST') return out(env, { error: 'not found' }, 404);
    try {
      // Webhook Telegram: catat permintaan gabung yang menunggu per link
      if (p === '/tg') {
        if (req.headers.get('x-telegram-bot-api-secret-token') !== env.WEBHOOK_SECRET) return out(env, { error: 'forbidden' }, 403);
        const u = await req.json(), j = u.chat_join_request;
        if (j && j.invite_link && j.invite_link.invite_link) await env.LINKS.put('req:' + j.invite_link.invite_link, String(j.from.id));
        return out(env, { ok: true });
      }
      // Publik: buat link unik (mode butuh persetujuan, jadi tidak berbahaya sebelum di-ACC)
      if (p === '/link') {
        const ip = req.headers.get('cf-connecting-ip') || 'x', k = 'rl:' + ip, n = Number(await env.LINKS.get(k) || 0);
        if (n >= 6) return out(env, { error: 'Terlalu banyak percobaan, coba lagi nanti.' }, 429);
        await env.LINKS.put(k, String(n + 1), { expirationTtl: 3600 });
        const r = await tg(env, 'createChatInviteLink', { creates_join_request: true, name: 'daftar ' + new Date().toISOString().slice(0, 16) });
        await env.LINKS.put('link:' + r.invite_link, '1');
        return out(env, { link: r.invite_link });
      }
      // Admin saja
      if (p === '/approve' || p === '/revoke') {
        if (!(await adminEmail(env, req))) return out(env, { error: 'Bukan admin' }, 403);
        const { link } = await req.json();
        if (!(await known(env, link))) return out(env, { error: 'Link tidak dikenal' }, 404);
        const pending = await env.LINKS.get('req:' + link);
        if (p === '/revoke') { await tg(env, 'revokeChatInviteLink', { invite_link: link }).catch(() => {}); return out(env, { ok: true }); }
        if (pending) {   // sudah sempat kirim permintaan gabung: setujui langsung, lalu matikan link
          await tg(env, 'approveChatJoinRequest', { user_id: Number(pending) });
          await tg(env, 'revokeChatInviteLink', { invite_link: link }).catch(() => {});
          return out(env, { link, joined: true });
        }
        try {            // ubah link yang sama jadi masuk-langsung, sekali pakai, tanpa kedaluwarsa
          await tg(env, 'editChatInviteLink', { invite_link: link, creates_join_request: false, member_limit: 1 });
          return out(env, { link });
        } catch {        // cadangan: cabut lalu buat link baru sekali pakai
          await tg(env, 'revokeChatInviteLink', { invite_link: link }).catch(() => {});
          const r = await tg(env, 'createChatInviteLink', { member_limit: 1, name: 'member ' + new Date().toISOString().slice(0, 16) });
          await env.LINKS.put('link:' + r.invite_link, '1');
          return out(env, { link: r.invite_link });
        }
      }
      return out(env, { error: 'not found' }, 404);
    } catch (e) { return out(env, { error: String(e.message || e) }, 500); }
  }
};
