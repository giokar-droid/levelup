/* Level Up 3.1 · Percorso 30 — dieci minuti al mattino, review alla sera, si avanza solo chiudendo la giornata.
   Script classico: tutto dentro una IIFE, un solo nome globale: PERCORSO. I testi li dà PERCORSO_DATA (percorso-data.js).

   Come è fatto, in breve:
   - lo stato sta in S.pc (dentro la stessa partita, quindi nel codice LVLUP1: e nel salvataggio); le bozze dei campi
     stanno in memoria (DR) finché non si preme il pulsante;
   - il motore (defaults, clean, state, rewards) non usa niente di index.html: gira anche in node per le prove;
   - l'interfaccia usa i globali di Level Up (S, save, render, mutate, calc, esc, toast, showModal, hrow…) solo dentro
     le funzioni, mai al caricamento;
   - le azioni sono data-act="pc-…" (PERCORSO.actions); i campi di testo hanno data-pcf e un ascoltatore qui sotto;
   - la scheda c'è solo nel profilo Adulto (Massimo non la vede) e si può spegnere da Io.

   Regole del percorso: un giorno = mattina (esercizio da 10 minuti) + sera (review di 3 minuti). Il giorno dopo si sblocca
   solo quando la review è fatta. Non è a calendario: se salti, il percorso ti aspetta. La review in ritardo (il mattino
   dopo) vale per il giorno dell'esercizio, così non si perde un giorno. */
(function (root) {
  'use strict';

  /* ---------- motore (puro) ---------- */
  const DA = () => (root.PERCORSO_DATA && typeof root.PERCORSO_DATA === 'object' ? root.PERCORSO_DATA : null);
  const isDay = d => typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d);
  const pd = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const p2 = n => String(n).padStart(2, '0');
  const dk = dt => `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`;
  const addDay = (k, n) => { const d = pd(k); d.setDate(d.getDate() + n); return dk(d); };
  const plain = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const str = (v, n) => String(v ?? '').slice(0, n);
  const KEY_RE = /^[a-z0-9_]{1,16}$/;
  const XP_AM = 10, XP_PM = 10, GEM_PM = 5, GEM_WEEK = 25, GEM_CYCLE = 100, XP_CYCLE = 100;
  const DAYS = () => (DA() && Array.isArray(DA().DAYS) ? DA().DAYS : []);
  const NDAYS = () => DAYS().length || 30;
  const dayOf = n => DAYS()[n - 1] || null;

  function defaults() { return {v: 1, cid: str(DA()?.CYCLE?.id || 'c1', 24), start: null, days: {}, past: [], off: 0, hold: null, ahead: null}; }
  function cleanAns(a) {
    const o = {};
    if (plain(a)) for (const [k, v] of Object.entries(a)) {
      if (!KEY_RE.test(k)) continue;
      if (typeof v === 'number' && Number.isFinite(v)) o[k] = Math.max(0, Math.min(100, Math.round(v)));
      else if (typeof v === 'string') o[k] = v.slice(0, 2000);
    }
    return o;
  }
  function cleanDays(days) {
    const o = {};
    if (!plain(days)) return o;
    for (const [k, x] of Object.entries(days)) {
      const n = parseInt(k, 10);
      if (!(n >= 1 && n <= 99) || String(n) !== k || !plain(x) || !plain(x.am) || !isDay(x.am.d)) continue;
      const r = {am: {d: x.am.d, ts: Number.isFinite(x.am.ts) ? x.am.ts : null, a: cleanAns(x.am.a), act: str(x.am.act, 240)}};
      if (plain(x.pm) && isDay(x.pm.d)) {
        const vote = parseInt(x.pm.vote, 10);
        r.pm = {d: x.pm.d, ts: Number.isFinite(x.pm.ts) ? x.pm.ts : null, did: [0, 1, 2].includes(x.pm.did) ? x.pm.did : 0,
          vote: vote >= 1 && vote <= 10 ? vote : 0, a: cleanAns(x.pm.a), note: str(x.pm.note, 1000), late: !!x.pm.late};
      }
      o[k] = r;
    }
    return o;
  }
  function clean(pc) {
    if (!plain(pc)) return undefined;
    const o = defaults();
    if (pc.cid) o.cid = str(pc.cid, 24);
    o.days = cleanDays(pc.days);
    o.start = isDay(pc.start) ? pc.start : null;
    if (!o.start) { const ds = Object.values(o.days).map(x => x.am.d).sort(); if (ds.length) o.start = ds[0]; }
    o.past = (Array.isArray(pc.past) ? pc.past : []).filter(plain).slice(-12)
      .map(c => ({cid: str(c.cid || 'c1', 24), start: isDay(c.start) ? c.start : null, end: isDay(c.end) ? c.end : null, days: cleanDays(c.days)}));
    o.off = pc.off ? 1 : 0;
    o.hold = isDay(pc.hold) ? pc.hold : null;
    o.ahead = isDay(pc.ahead) ? pc.ahead : null;
    return o;
  }
  // dove siamo: start (mai iniziato) · am (esercizio da fare) · pm (review da fare) · wait (domani) · done (finito)
  function state(pc, T) {
    const N = NDAYS(), days = plain(pc?.days) ? pc.days : {};
    let n = 1; while (n <= N && days[n]?.pm) n++;
    if (n > N) return {phase: 'done', n: N, N};
    const cur = days[n], prev = n > 1 ? days[n - 1] : null;
    if (cur?.am) return {phase: 'pm', n, N, am: cur.am, late: cur.am.d < T};
    if (!pc?.start && n === 1) return {phase: 'start', n, N};
    const closedToday = !!(prev?.pm && prev.pm.d >= T), redo = pc?.hold === T;
    if ((closedToday || redo) && pc?.ahead !== T) return {phase: 'wait', n, N, redo};
    return {phase: 'am', n, N};
  }
  // premi: li ricalcola calc() da S.pc a ogni giro, come tutto il resto del gioco (niente punti salvati a parte)
  function rewards(pc, T) {
    const r = {xp: 0, gems: 0, days: 0, weeks: 0, cycles: 0, chain: 0, best: 0, fullOn: new Set(), closedOn: new Set()};
    if (!plain(pc)) return r;
    const N = NDAYS(), all = [...(Array.isArray(pc.past) ? pc.past.map(c => c && c.days) : []), pc.days];
    for (const days of all) {
      if (!plain(days)) continue;
      let cnt = 0;
      for (const [k, x] of Object.entries(days)) {
        if (!x?.am || !isDay(x.am.d) || x.am.d > T) continue;
        r.xp += XP_AM;
        if (!x.pm) continue;
        r.xp += XP_PM; r.gems += GEM_PM; r.days++; cnt++; r.closedOn.add(x.am.d);
        if (x.pm.did >= 1) r.fullOn.add(x.am.d);
        if (+k % 7 === 0) { r.gems += GEM_WEEK; r.weeks++; }
      }
      if (cnt >= N) { r.gems += GEM_CYCLE; r.xp += XP_CYCLE; r.cycles++; }
    }
    // serie: giorni di calendario di fila con un giorno del percorso chiuso (si azzera dopo un giorno vuoto, ieri non conta finché è oggi)
    const ds = [...r.closedOn].sort();
    let run = 0, prev = null;
    for (const d of ds) { run = prev && addDay(prev, 1) === d ? run + 1 : 1; if (run > r.best) r.best = run; prev = d; }
    r.chain = prev && (prev === T || addDay(prev, 1) === T) ? run : 0;
    return r;
  }
  function noDiary(o) {
    const wipe = days => { if (plain(days)) for (const x of Object.values(days)) { if (plain(x?.am)) { x.am.a = {}; x.am.act = ''; } if (plain(x?.pm)) { x.pm.a = {}; x.pm.note = ''; } } };
    if (plain(o?.pc)) { wipe(o.pc.days); if (Array.isArray(o.pc.past)) o.pc.past.forEach(c => wipe(c?.days)); }
  }

  /* ---------- interfaccia ---------- */
  let nav = {scr: 'day', n: 0};     // day | hist | read
  let DR = {};                      // bozze dei campi: «n:parte:chiave» → valore (solo in memoria)
  const key = (n, part, k) => `${n}:${part}:${k}`;
  const W1 = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
  const DID = [[2, '✅', 'Fatta'], [1, '🌗', 'In parte'], [0, '❌', 'Non fatta']];
  const pc = () => S.pc;
  const fD = k => isDay(k) ? k.split('-').reverse().join('.') : '';
  const weekOf = d => (DA()?.WEEKS || []).find(w => w.n === d?.w) || null;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  function closeAll() { try { MQ.length = 0; $('#modal')._opt = {}; nextModal(); } catch (e) {} }
  function draftOf(n, part, f, saved) { const k = key(n, part, f.k); return Object.prototype.hasOwnProperty.call(DR, k) ? DR[k] : (saved ?? ''); }

  function on() {
    try { return !!(S && S.profile && isAdult() && plain(S.pc) && !S.pc.off && DAYS().length); } catch (e) { return false; }
  }
  function para(t) { return String(t || '').split(/\n\n+/).map(x => `<p>${esc(x)}</p>`).join(''); }
  function fieldHTML(n, part, f, saved) {
    const k = key(n, part, f.k), v = draftOf(n, part, f, saved);
    const q = `<h3 class="pc-q">${esc(f.q)}</h3>${f.hint ? `<div class="small dim">${esc(f.hint)}</div>` : ''}`;
    if (f.kind === 'scale') {
      const max = f.max || 10;
      return q + `<div class="chips pc-scale">${Array.from({length: max}, (_, i) => i + 1).map(i => `<button class="chip sm ${+v === i ? 'on' : ''}" data-act="pc-pick" data-key="${k}" data-v="${i}" aria-pressed="${+v === i}">${i}</button>`).join('')}</div>`;
    }
    if (f.kind === 'line') return q + `<input class="txt" data-pcf="${k}" maxlength="240" value="${esc(v)}" placeholder="${esc(f.ph || '')}" autocomplete="off">`;
    return q + `<textarea class="txt" data-pcf="${k}" rows="${f.rows || 3}" maxlength="2000" placeholder="${esc(f.ph || 'Scrivi qui: resta su questo dispositivo')}">${esc(v)}</textarea>`;
  }
  function recallHTML(d) {
    const out = [], get = (n, k) => pc().days[n]?.am?.a?.[k] ?? pc().days[n]?.pm?.a?.[k];
    for (const r of d.recall || []) {
      let txt = '';
      if (Array.isArray(r.keys)) {   // più voti dello stesso giorno in una riga: «Corpo 6 · Mente 7 …»
        const fs = dayOf(r.n)?.ask || [];
        txt = r.keys.map(k => { const v = get(r.n, k), f = fs.find(x => x.k === k); return v === undefined || v === '' ? '' : `${f?.short || k} ${v}`; }).filter(Boolean).join(' · ');
      } else { const v = get(r.n, r.k); if (v !== undefined && v !== '') txt = typeof v === 'number' ? v + ' / 10' : String(v); }
      if (txt) out.push(`<div class="say small"><b>${esc(r.l || `Giorno ${r.n}`)}:</b> ${esc(txt)}</div>`);
    }
    return out.join('');
  }
  const firstSentence = t => { const s = String(t || '').split(/\n/)[0]; const m = /^(.{20,160}?[.!?])(\s|$)/.exec(s); return m ? m[1] : s.slice(0, 160); };
  function pinsHTML() {
    const out = [];
    for (const r of DA()?.CYCLE?.pins || []) {
      const v = pc().days[r.n]?.am?.a?.[r.k];
      if (v) out.push(`<div class="pc-pin"><span>${esc(r.e || '📌')}</span><div><div class="label">${esc(r.l)}</div><b>${esc(v)}</b></div></div>`);
    }
    return out.join('');
  }
  function dotsHTML(st) {
    const N = st.N, days = pc().days;
    let h = '';
    for (let i = 1; i <= N; i++) {
      const x = days[i], cls = x?.pm ? (x.pm.did >= 1 ? 'done' : 'half') : i === st.n && st.phase !== 'done' ? 'cur' : '';
      const d = dayOf(i), rev = d?.review ? 'rev' : '';
      h += `<button class="pc-dot ${cls} ${rev}" data-act="pc-read" data-n="${i}" aria-label="Giorno ${i}${x?.pm ? ', chiuso' : ''}" ${x?.am ? '' : 'disabled'}>${x?.pm ? (x.pm.did >= 1 ? '✓' : '·') : i}</button>`;
    }
    return `<div class="pc-dots">${h}</div>`;
  }
  function headCard(c, st) {
    const r = c.percorso || rewards(pc(), c.T), d = dayOf(st.n), w = weekOf(d);
    const closed = Object.values(pc().days).filter(x => x.pm).length;
    const title = st.phase === 'done' ? `Percorso completato · ${closed} su ${st.N}` : st.phase === 'start' ? `${st.N} giorni · 10 minuti al giorno` : `Giorno ${st.n} di ${st.N}`;
    return `<div class="card"><div class="row"><div class="qe">🧭</div><div class="grow"><div class="label">${esc(DA().CYCLE?.t || 'Percorso 30')}</div><b style="font-size:1.25rem">${title}</b>
      <div class="small muted">${w && st.phase !== 'done' ? `Settimana ${w.n} · ${esc(w.t)} · ` : ''}${r.chain ? `${plural(r.chain, 'giorno', 'giorni')} di fila · ` : ''}record ${r.best}</div></div></div>
      ${dotsHTML(st)}${pinsHTML()}</div>`;
  }
  function habitOffer(d) {
    if (!d.habit && !d.habitFrom) return '';
    const p = P_(), have = id => Array.isArray(p.habits) && p.habits.some(h => h.id === id);
    if (!Array.isArray(p.habits) || !p.habits.length) return `<div class="banner small">🧱 Questo giorno propone un'abitudine da mettere nel tracker: serve il profilo con più abitudini (Io → Rifai il patto, profilo Adulto).</div>`;
    if (d.habitFrom) {
      const hf = d.habitFrom, id = 'pc_' + hf.k;
      if (have(id)) return `<div class="donebox small">✔ «${esc(p.habits.find(h => h.id === id).n)}» è già fra le tue abitudini</div>`;
      return `<div class="card pc-hab"><div class="row"><div class="qe">${esc(hf.e || '🎯')}</div><div class="grow"><div class="label">Nel tracker</div><b>${esc(hf.t || 'Mettilo fra le abitudini')}</b><div class="small muted">${esc(hf.why || '')}</div></div></div>
        <div class="btns"><button class="btn gold" data-act="pc-hfrom" data-n="${d.n}" data-role="core">🔥 Come atomica (fiamma)</button><button class="btn ghost" data-act="pc-hfrom" data-n="${d.n}" data-role="extra">⚡ Come extra</button></div>
        <div class="small dim">Uso il testo che hai scritto nell'esercizio (al massimo 40 caratteri): poi lo cambi da Io → Le mie abitudini.</div></div>`;
    }
    const h = habitDef(d.habit);
    if (!h) return '';
    if (have(h.id)) return `<div class="donebox small">✔ ${esc(h.e)} «${esc(h.n)}» è già fra le tue abitudini</div>`;
    return `<div class="card pc-hab"><div class="row"><div class="qe">${esc(h.e)}</div><div class="grow"><div class="label">Abitudine proposta</div><b>${esc(h.n)}</b><div class="small muted">${esc(h.why || '')}</div></div></div>
      <button class="btn gold" data-act="pc-hadd" data-id="${esc(h.id)}">➕ Aggiungila al tracker come ${esc((typeof ROLES !== 'undefined' && ROLES[h.role]) || h.role)}</button>
      <div class="small dim">Poi la trovi in Quest; da Io → Le mie abitudini la cambi o la metti in pausa.</div></div>`;
  }
  function habitDef(id) {
    const own = (DA()?.HABITS || []).find(h => h.id === id);
    if (own) return own;
    try { const b = CATALOG.find(h => h.id === id); if (b) return {...b, why: ''}; } catch (e) {}
    return null;
  }
  function amCard(c, st) {
    const n = st.n, d = dayOf(n);
    return `<div class="card pc-day"><div class="row"><div class="qe">${esc(d.e || '☀️')}</div><div class="grow"><div class="label">Mattina · ${d.min || 10} minuti</div><b style="font-size:1.3rem">${esc(d.t)}</b></div></div>
      ${recallHTML(d)}
      <div class="pc-idea">${para(d.idea)}</div>
      ${d.steps?.length ? `<h3 class="pc-q">L'esercizio</h3><ol class="pc-steps">${d.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      ${(d.ask || []).map(f => fieldHTML(n, 'am', f)).join('')}
      ${fieldHTML(n, 'am', {k: 'act', kind: 'line', q: '🎯 La mia azione di oggi', hint: d.actHint || 'Una sola cosa, concreta, che stasera saprai dire se l\'hai fatta.', ph: d.act || ''}, '')}
      <button class="btn ok big" data-act="pc-am" data-n="${n}">☀️ Fatto · stasera la review <small>+${XP_AM} XP</small></button>
      ${d.src ? `<div class="small dim pc-src">Spunto: ${esc(d.src)}</div>` : ''}</div>${habitOffer(d)}`;
  }
  function weekPanel(c) {
    if (!c.multi) return '';
    const T = c.T, hs = sortH(c.H.filter(h => !c.pausedNow.has(h.id)));
    if (!hs.length) return '';
    const vals = new Map();
    for (const e of S.ev) if (e.t === 'h' && e.d > addDay(T, -7) && e.d <= T) vals.set(e.id + '@' + e.d, e.v);
    const rows = hs.map(h => {
      let k = 0; const marks = [];
      for (let i = 6; i >= 0; i--) { const d = addDay(T, -i), ok = hDone(h, vals.get(h.id + '@' + d)); if (ok) k++; marks.push(ok ? '■' : '□'); }
      const s = c.hstats.get(h.id) || {chain: 0, best: 0};
      return `<div class="pc-wrow"><span class="xe">${h.e}</span><span class="grow"><b>${esc(h.n)}</b><small class="muted">${k}/7 · serie ${s.chain} · record ${s.best}</small><span class="pc-marks" aria-hidden="true">${marks.join('')}</span></span>
        <span class="pc-wb">${h.type === 'num' ? `<button class="chip sm" data-act="hup" data-id="${h.id}">🪜 Alza</button>` : ''}<button class="chip sm" data-act="hpause" data-id="${h.id}">⏸️</button></span></div>`;
    }).join('');
    return `<h3 class="pc-q">📊 Le tue abitudini negli ultimi 7 giorni</h3><div class="small dim">5 su 7 o più: tienila così o alzala. Sotto 3: rimpiccioliscila (Io → Le mie abitudini) prima di mollarla.</div><div class="pc-week">${rows}</div>`;
  }
  function habitsToday(c) {
    if (!c.multi) return '';
    const hs = sortH(c.H.filter(h => !c.pausedNow.has(h.id)));
    if (!hs.length) return '';
    const n = hs.filter(h => hDone(h, c.hvToday.get(h.id)?.v)).length;
    return `<h3 class="pc-q">🧱 Le abitudini di oggi · ${n} su ${hs.length}</h3><div class="small dim">Segna qui quello che hai fatto: è lo stesso tracker della pagina Quest.</div><div class="xlist">${hs.map(h => hrow(h, c, false)).join('')}</div>`;
  }
  function pmCard(c, st) {
    const n = st.n, d = dayOf(n), am = st.am, did = DR[key(n, 'pm', 'did')], vote = DR[key(n, 'pm', 'vote')];
    const late = st.late ? `<div class="banner small"><b>📅 È la review del giorno ${n}, l'esercizio di ${fD(am.d)}.</b> Chiudila adesso: vale per quel giorno, e oggi puoi già fare il giorno ${n + 1}.</div>` : '';
    const recap = `<div class="card"><div class="row"><div class="qe">${esc(d.e || '☀️')}</div><div class="grow"><div class="label">Stamattina · giorno ${n}</div><b>${esc(d.t)}</b>${am.act ? `<div class="small">🎯 ${esc(am.act)}</div>` : ''}</div></div>
      ${(d.ask || []).some(f => am.a[f.k] !== undefined && am.a[f.k] !== '') ? `<details class="small"><summary>Cosa ho scritto</summary>${(d.ask || []).map(f => am.a[f.k] !== undefined && am.a[f.k] !== '' ? `<div class="diary"><i>${esc(f.q)}</i><br>${esc(am.a[f.k])}</div>` : '').join('')}</details>` : ''}</div>`;
    const didBtns = DID.map(([v, e, l]) => `<button class="chip ${did === v ? 'on' : ''}" data-act="pc-pick" data-key="${key(n, 'pm', 'did')}" data-v="${v}" aria-pressed="${did === v}">${e} ${l}</button>`).join('');
    const closeBtn = did === 0
      ? `<div class="small muted" style="margin-top:8px">Non fatta: nessun problema, succede. Rifarlo domani spesso vale più che andare avanti.</div><button class="btn gold" data-act="pc-redo" data-n="${n}">🔁 Lo rifaccio domani</button><button class="btn ghost" data-act="pc-pm" data-n="${n}">▶ Vado avanti lo stesso (+${XP_PM} XP, +${GEM_PM} 💎)</button>`
      : `<button class="btn ok big" data-act="pc-pm" data-n="${n}">🌙 Chiudo il giorno ${n} <small>+${XP_PM} XP · +${GEM_PM} 💎</small></button>`;
    return late + recap + habitOffer(d) + `<div class="card pc-day"><div class="row"><div class="qe">🌙</div><div class="grow"><div class="label">Sera · 3 minuti</div><b style="font-size:1.25rem">Review del giorno ${n}</b></div></div>
      <h3 class="pc-q">L'azione di oggi${am.act ? `: «${esc(am.act)}»` : ''}</h3><div class="chips">${didBtns}</div>
      ${(d.eve || []).map(f => fieldHTML(n, 'pm', f)).join('')}
      ${d.review === 'week' || d.review === 'final' ? weekPanel(c) : ''}
      ${habitsToday(c)}
      <h3 class="pc-q">📊 Segnapunti: che voto dai alla giornata?</h3><div class="small dim">1 = da dimenticare · 10 = la giornata che volevi. Conta la tendenza, non il singolo voto.</div>
      <div class="chips pc-scale">${Array.from({length: 10}, (_, i) => i + 1).map(i => `<button class="chip sm ${vote === i ? 'on' : ''}" data-act="pc-pick" data-key="${key(n, 'pm', 'vote')}" data-v="${i}" aria-pressed="${vote === i}">${i}</button>`).join('')}</div>
      ${fieldHTML(n, 'pm', {k: 'note', kind: 'line', q: '➡️ Una cosa che porto a domani', ph: 'facoltativo'}, '')}
      ${closeBtn}
      <button class="link" data-act="pc-unam" data-n="${n}">Ho premuto «Fatto» per sbaglio: torna all'esercizio</button></div>`;
  }
  function waitCard(c, st) {
    const d = dayOf(st.n), prev = pc().days[st.n - 1];
    const undo = prev?.pm?.ts && dk(new Date(prev.pm.ts)) === dk(new Date()) ? `<button class="link" data-act="pc-unpm" data-n="${st.n - 1}">Ho chiuso per sbaglio: riapri la review del giorno ${st.n - 1}</button>` : '';
    return `<div class="card"><div class="donebox">${st.redo ? `🔁 Domani rifai il giorno ${st.n}` : `✔ Giorno ${st.n - 1} chiuso. Ben fatto.`}</div>
      <div class="row" style="margin-top:12px"><div class="qe">${esc(d.e || '☀️')}</div><div class="grow"><div class="label">Domani · giorno ${st.n}</div><b>${esc(d.t)}</b><div class="small muted">${esc(d.teaser || firstSentence(d.idea))}</div></div></div>
      <div class="small dim" style="margin-top:8px">Un giorno alla volta: la notte serve a far sedimentare. Domani mattina trovi l'esercizio qui e in Quest.</div>
      ${undo}<button class="link" data-act="pc-early">Lo faccio già oggi (eccezione)</button></div>`;
  }
  function startCard() {
    const C = DA().CYCLE || {};
    return `<div class="card pc-day"><div class="row"><div class="qe">🧭</div><div class="grow"><div class="label">Come funziona</div><b style="font-size:1.25rem">${esc(C.t || 'Percorso 30')}</b></div></div>
      <div class="pc-idea">${para(C.intro || '')}</div>
      <ol class="pc-steps"><li><b>Mattina, 10 minuti:</b> una piccola idea, un esercizio scritto, l'azione di oggi.</li><li><b>Sera, 3 minuti:</b> review. L'azione l'hai fatta? Segni le abitudini, dai il voto alla giornata.</li><li><b>Si avanza alla sera:</b> il giorno dopo si sblocca solo dopo la review. Se salti, il percorso ti aspetta: niente da recuperare.</li><li>Ogni 7 giorni una review della settimana, con le tue abitudini.</li></ol>
      <button class="btn gold big" data-act="pc-start">▶ Inizio oggi</button>
      ${C.src ? `<div class="small dim pc-src">${esc(C.src)}</div>` : ''}</div>`;
  }
  function doneCard(c) {
    const r = c.percorso || rewards(pc(), c.T), days = pc().days, N = NDAYS();
    const votes = Object.values(days).map(x => x.pm?.vote).filter(v => v > 0), avg = votes.length ? Math.round(10 * votes.reduce((a, b) => a + b, 0) / votes.length) / 10 : 0;
    const did = Object.values(days).filter(x => x.pm?.did >= 1).length;
    return `<div class="card"><div class="center"><div class="big-emoji">🏆</div><h2>Percorso completato</h2></div>
      <p class="small">${plural(did, 'azione fatta', 'azioni fatte')} su ${N}${avg ? ` · voto medio ${String(avg).replace('.', ',')}` : ''} · record di fila ${r.best}.</p>
      <p class="small muted">Il cerchio si chiude e se ne apre un altro. Le abitudini che hai messo nel tracker restano: sono loro il vero risultato.</p>
      <button class="btn gold" data-act="pc-copy">📤 Copia tutto per Giulio</button>
      <button class="btn ghost" data-act="pc-restart">🔁 Ricomincia un nuovo giro</button></div>`;
  }
  function histView(c) {
    const days = pc().days, N = NDAYS();
    const rows = [];
    for (let i = 1; i <= N; i++) {
      const x = days[i]; if (!x?.am) continue;
      const d = dayOf(i) || {t: `Giorno ${i}`};
      rows.push(`<button class="xrow" data-act="pc-read" data-n="${i}"><span class="xe">${esc(d.e || '·')}</span><span class="grow"><b>${i}. ${esc(d.t)}</b><small>${fD(x.am.d)}${x.pm ? ` · ${DID.find(z => z[0] === x.pm.did)[1]} · voto ${x.pm.vote || '–'}` : ' · review da fare'}</small></span><span class="xk">›</span></button>`);
    }
    const past = (pc().past || []).map(p => `<div class="small dim">Giro chiuso: ${fD(p.start)} → ${fD(p.end)} · ${Object.values(p.days).filter(x => x.pm).length} giorni chiusi</div>`).join('');
    return `${topbar(c)}<h2>📜 I miei giorni</h2><div class="card">${rows.join('') || '<p class="muted small">Ancora niente: il giorno 1 ti aspetta.</p>'}${past}</div>
      <button class="btn ghost" data-act="pc-back">↩️ Torna al percorso</button>`;
  }
  function readView(c) {
    const n = nav.n, x = pc().days[n], d = dayOf(n);
    if (!x?.am || !d) { nav = {scr: 'day', n: 0}; return dayView(c); }
    const qa = (fs, a) => (fs || []).map(f => a[f.k] !== undefined && a[f.k] !== '' ? `<div class="diary small"><i>${esc(f.q)}</i><br>${esc(a[f.k])}</div>` : '').join('');
    return `${topbar(c)}<h2>${esc(d.e || '')} ${n}. ${esc(d.t)}</h2>
      <div class="card"><div class="label">Mattina · ${fD(x.am.d)}</div>${qa(d.ask, x.am.a)}${x.am.act ? `<div class="diary small"><i>La mia azione</i><br>${esc(x.am.act)}</div>` : ''}</div>
      ${x.pm ? `<div class="card"><div class="label">Sera</div><div class="small">${DID.find(z => z[0] === x.pm.did).slice(1).join(' ')} · voto ${x.pm.vote || '–'}${x.pm.late ? ' · chiusa il giorno dopo' : ''}</div>${qa(d.eve, x.pm.a)}${x.pm.note ? `<div class="diary small"><i>A domani</i><br>${esc(x.pm.note)}</div>` : ''}</div>` : ''}
      <details class="card small"><summary>Rileggi l'idea del giorno</summary><div class="pc-idea">${para(d.idea)}</div>${d.steps?.length ? `<ol class="pc-steps">${d.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}</details>
      <button class="btn ghost" data-act="pc-back">↩️ Torna al percorso</button>`;
  }
  function dayView(c) {
    const st = state(pc(), c.T);
    let body = '';
    if (st.phase === 'start') body = startCard();
    else if (st.phase === 'am') body = amCard(c, st);
    else if (st.phase === 'pm') body = pmCard(c, st);
    else if (st.phase === 'wait') body = waitCard(c, st);
    else body = doneCard(c);
    const started = Object.keys(pc().days).length > 0;
    return `${topbar(c)}<h2>🧭 Percorso</h2>${headCard(c, st)}${body}
      ${started ? `<div class="card menu"><button class="btn ghost" data-act="pc-hist">📜 I miei giorni</button><button class="btn ghost" data-act="pc-copy">📤 Copia per Giulio (da incollare in Claude)</button></div>` : ''}`;
  }
  function view(c) {
    boot();
    try {
      if (nav.scr === 'hist') return histView(c);
      if (nav.scr === 'read') return readView(c);
      return dayView(c);
    } catch (e) {
      try { console.error('Percorso.view', e); } catch (_) {}
      nav = {scr: 'day', n: 0};
      return `${topbar(c)}<h2>🧭 Percorso</h2><div class="card"><b>⚠️ Qui qualcosa non va.</b><p class="small muted">Il percorso non riesce ad aprirsi. Il resto dell'app funziona e la partita è al sicuro: prova ad aggiornare.</p><button class="btn" data-act="reload">🔄 Aggiorna</button></div>`;
    }
  }
  function homeCard(c) {
    boot();
    if (!on()) return '';
    const st = state(pc(), c.T), d = dayOf(st.n) || {};
    let title, sub = '', btn = 'Apri il percorso ▶', ghost = false;
    if (st.phase === 'start') { title = `Percorso ${st.N}: 10 minuti al giorno`; sub = 'Mattina un esercizio, sera la review: si avanza solo chiudendo la giornata.'; btn = '▶ Scopri e inizia'; }
    else if (st.phase === 'am') { title = `Giorno ${st.n} · ${d.t}`; sub = '☀️ 10 minuti, quando riesci in mattinata'; btn = '▶ Inizia (10 min)'; }
    else if (st.phase === 'pm') { title = st.late ? `Review del giorno ${st.n}, rimasta aperta` : `Stasera: review del giorno ${st.n}`; sub = st.am.act ? `🎯 ${st.am.act}` : d.t; btn = '🌙 Fai la review (3 min)'; }
    else if (st.phase === 'wait') { title = st.redo ? `Domani rifai il giorno ${st.n}` : `Giorno ${st.n - 1} chiuso ✓`; sub = `Domani: ${d.t}`; ghost = true; btn = 'Apri'; }
    else { title = 'Percorso completato 🏆'; sub = 'Le abitudini restano. Quando vuoi, un nuovo giro.'; ghost = true; }
    return `<div class="card pc-hc"><div class="row"><div class="qe">🧭</div><div class="grow"><div class="label">Percorso</div><b style="font-size:1.15rem">${esc(title)}</b><div class="small muted">${esc(sub)}</div></div></div><button class="btn ${ghost ? 'ghost' : 'gold'}" data-act="pc-tab">${btn}</button></div>`;
  }
  function meCard(c) {
    boot();
    try { if (!S.profile || !isAdult() || !plain(S.pc) || !DAYS().length) return ''; } catch (e) { return ''; }
    const r = c.percorso || rewards(pc(), c.T), off = !!pc().off;
    return `<div class="card"><div class="row"><div class="qe">🧭</div><div class="grow"><b>Percorso 30</b><div class="small muted">${r.days ? `${plural(r.days, 'giorno chiuso', 'giorni chiusi')} · record di fila ${r.best}${r.cycles ? ` · ${plural(r.cycles, 'giro completo', 'giri completi')}` : ''}` : '10 minuti al mattino, review alla sera, 30 giorni.'}</div></div></div>
      <button class="btn ghost" data-act="${off ? 'pc-on' : 'pc-off'}">${off ? '🧭 Accendi la scheda Percorso' : '🧭 Scheda Percorso accesa: tocca per spegnerla'}</button>
      ${r.days ? `<button class="btn ghost" data-act="pc-copy">📤 Copia per Giulio</button>` : ''}
      ${Object.keys(pc().days).length ? `<button class="link" data-act="pc-restart">Ricomincia il percorso da capo</button>` : ''}</div>`;
  }

  /* ---------- testo per Giulio (lo skill di Claude: lo incolli in chat e lui fa la review della settimana) ---------- */
  function exportText(c) {
    const days = pc().days, N = NDAYS(), T = c.T, lines = [`PERCORSO30 · ${pc().cid} · iniziato il ${fD(pc().start)} · esportato il ${fD(T)}`];
    for (let i = 1; i <= N; i++) {
      const x = days[i]; if (!x?.am) continue;
      const d = dayOf(i) || {t: ''};
      lines.push('', `GIORNO ${i} · ${d.t} · ${fD(x.am.d)}`);
      for (const f of d.ask || []) if (x.am.a[f.k] !== undefined && x.am.a[f.k] !== '') lines.push(`  ${f.q} → ${x.am.a[f.k]}`);
      if (x.am.act) lines.push(`  Azione: ${x.am.act}`);
      if (x.pm) {
        lines.push(`  Sera: ${DID.find(z => z[0] === x.pm.did)[2]} · voto ${x.pm.vote || '–'}/10${x.pm.late ? ' · chiusa il giorno dopo' : ''}`);
        for (const f of d.eve || []) if (x.pm.a[f.k] !== undefined && x.pm.a[f.k] !== '') lines.push(`  ${f.q} → ${x.pm.a[f.k]}`);
        if (x.pm.note) lines.push(`  A domani: ${x.pm.note}`);
      } else lines.push('  Sera: review non ancora fatta');
    }
    if (c.multi) {
      const vals = new Map();
      for (const e of S.ev) if (e.t === 'h' && e.d > addDay(T, -7) && e.d <= T) vals.set(e.id + '@' + e.d, e.v);
      lines.push('', 'ABITUDINI · ultimi 7 giorni');
      for (const h of sortH(c.H)) {
        let k = 0; for (let i = 0; i < 7; i++) if (hDone(h, vals.get(h.id + '@' + addDay(T, -i)))) k++;
        const s = c.hstats.get(h.id) || {chain: 0, best: 0};
        lines.push(`  ${h.n} (${(typeof ROLES !== 'undefined' && ROLES[h.role]) || h.role}${c.pausedNow.has(h.id) ? ', in pausa' : ''}): ${k}/7 · serie ${s.chain} · record ${s.best}`);
      }
    }
    return lines.join('\n');
  }

  /* ---------- azioni ---------- */
  function collect(n, part, fields) {
    const a = {};
    for (const f of fields) {
      const k = key(n, part, f.k);
      if (!Object.prototype.hasOwnProperty.call(DR, k)) continue;
      const v = DR[k];
      if (f.kind === 'scale') { if (+v >= 1) a[f.k] = +v; } else if (String(v).trim()) a[f.k] = String(v).trim().slice(0, 2000);
    }
    return a;
  }
  function dropDrafts(n, part) { for (const k of Object.keys(DR)) if (k.startsWith(`${n}:${part}:`)) delete DR[k]; }
  function addHabit(h) {
    const p = P_();
    if (!Array.isArray(p.habits) || !p.habits.length) { toast('Serve il profilo con più abitudini (Io → Rifai il patto)'); return false; }
    if (p.habits.some(x => x.id === h.id)) { toast('È già fra le tue abitudini'); return false; }
    if (p.habits.length >= HABITS_MAX) { toast(`Massimo ${HABITS_MAX} abitudini: togline una da Io → Le mie abitudini`); return false; }
    const o = {id: h.id, e: str(h.e || '⭐', 8), n: str(h.n, 40), role: ['core', 'goal', 'extra'].includes(h.role) ? h.role : 'extra', type: h.type === 'num' ? 'num' : 'bin', slot: ['am', 'pm', 'eve', 'any'].includes(h.slot) ? h.slot : 'any', changed: today()};
    if (o.type === 'num') { o.unit = h.unit || 'volte'; if (h.one) o.one = h.one; o.mini = h.mini || 1; o.epic = h.epic || 0; o.step = h.step || 1; }
    let moved = false;
    if (o.role === 'core' && p.habits.filter(x => x.role === 'core').length >= CORE_MAX) { o.role = 'extra'; moved = true; }
    p.habits.push(o); save(); render();
    try { confetti(60, ['🧱', '✨']); } catch (e) {}
    toast(moved ? `🧱 «${o.n}» aggiunta come extra: le atomiche sono già ${CORE_MAX}` : `🧱 «${o.n}» aggiunta: la trovi in Quest`);
    return true;
  }
  function copyText(txt) {
    const fallback = () => showModal(`<div class="mc left"><h2>📤 Copia per Giulio</h2><p class="small muted">Tieni premuto nel riquadro, Seleziona tutto, Copia. Poi incollalo in Claude scrivendo «Giulio, review».</p><textarea class="txt" rows="12" readonly>${esc(txt)}</textarea><button class="btn ghost" data-act="close">Chiudi</button></div>`);
    try { if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(txt).then(() => toast('📤 Copiato: incollalo in Claude con «Giulio, review»'), fallback); return; } } catch (e) {}
    fallback();
  }
  const actions = {
    'pc-tab': () => { S.ui.tab = 'percorso'; nav = {scr: 'day', n: 0}; save(); render(); scrollTo(0, 0); },
    'pc-back': () => { nav = {scr: 'day', n: 0}; render(); scrollTo(0, 0); },
    'pc-hist': () => { nav = {scr: 'hist', n: 0}; render(); scrollTo(0, 0); },
    'pc-read': el => { const n = +el.dataset.n; if (!pc().days[n]?.am) return; S.ui.tab = 'percorso'; nav = {scr: 'read', n}; render(); scrollTo(0, 0); },
    'pc-start': () => { if (viewDay) return toast('Torna a oggi per iniziare'); pc().start = today(); save(); render(); scrollTo(0, 0); },
    'pc-pick': el => { const k = el.dataset.key, v = +el.dataset.v; if (!/^\d+:(am|pm):[a-z0-9_]+$/.test(k || '')) return; DR[k] = v; render(); },
    'pc-am': el => {
      const T = today(), st = state(pc(), T), n = +el.dataset.n, d = dayOf(n);
      if (st.phase !== 'am' || st.n !== n || !d) return render();
      const a = collect(n, 'am', d.ask || []), act = String(DR[key(n, 'am', 'act')] ?? '').trim() || d.act || '';
      mutate(() => { if (!pc().start) pc().start = T; pc().ahead = null; pc().hold = null; pc().days[n] = {am: {d: T, ts: Date.now(), a, act: act.slice(0, 240)}}; });
      dropDrafts(n, 'am');
      try { tone(SND.done); } catch (e) {}
      toast(`☀️ Giorno ${n} avviato: stasera la review (3 min)`);
      scrollTo(0, 0);
    },
    'pc-unam': el => { const n = +el.dataset.n, x = pc().days[n]; if (!x?.am || x.pm) return; for (const [k, v] of Object.entries(x.am.a)) DR[key(n, 'am', k)] = v; DR[key(n, 'am', 'act')] = x.am.act; mutate(() => { delete pc().days[n]; }); scrollTo(0, 0); },
    'pc-pm': el => {
      const T = today(), st = state(pc(), T), n = +el.dataset.n, d = dayOf(n);
      if (st.phase !== 'pm' || st.n !== n || !d) return render();
      const did = DR[key(n, 'pm', 'did')], vote = DR[key(n, 'pm', 'vote')];
      if (![0, 1, 2].includes(did)) return toast("Prima dimmi: l'azione di oggi l'hai fatta?");
      if (!(vote >= 1 && vote <= 10)) return toast('Manca il voto alla giornata (1-10)');
      const a = collect(n, 'pm', d.eve || []), note = String(DR[key(n, 'pm', 'note')] ?? '').trim().slice(0, 1000), am = pc().days[n].am;
      const b = mutate(() => { pc().days[n].pm = {d: am.d, ts: Date.now(), did, vote, a, note, late: T > am.d}; pc().hold = null; });
      dropDrafts(n, 'pm');
      if (n === NDAYS()) { try { tone(SND.boss); confetti(200, ['🏆', '✨', '🧭']); } catch (e) {} showModal(`<div class="mc"><div class="big-emoji pop">🏆</div><h2>${NDAYS()} giorni su ${NDAYS()}!</h2><p>Hai chiuso il percorso. +${GEM_CYCLE} 💎 e +${XP_CYCLE} XP.</p><p class="small muted">Copia tutto per Giulio: fate insieme il punto e scegliete il prossimo giro.</p><button class="btn gold" data-act="close">GG</button></div>`); }
      else if (n % 7 === 0) { try { confetti(120, ['📅', '✨']); } catch (e) {} toast(`📅 Settimana ${n / 7} chiusa: +${GEM_WEEK} 💎`); }
      else toast(`🌙 Giorno ${n} chiuso · domani il giorno ${n + 1}`);
      scrollTo(0, 0);
      return b;
    },
    'pc-unpm': el => { const n = +el.dataset.n, x = pc().days[n]; if (!x?.pm) return; const st = state(pc(), today()); if (st.n !== n + 1 || st.phase !== 'wait') return; DR[key(n, 'pm', 'did')] = x.pm.did; DR[key(n, 'pm', 'vote')] = x.pm.vote; for (const [k, v] of Object.entries(x.pm.a)) DR[key(n, 'pm', k)] = v; DR[key(n, 'pm', 'note')] = x.pm.note; mutate(() => { delete pc().days[n].pm; }); scrollTo(0, 0); },
    'pc-redo': el => {
      const n = +el.dataset.n, x = pc().days[n]; if (!x?.am || x.pm) return;
      for (const [k, v] of Object.entries(x.am.a)) DR[key(n, 'am', k)] = v;   // domani i campi sono già pieni (finché l'app resta aperta)
      dropDrafts(n, 'pm');
      mutate(() => { delete pc().days[n]; pc().hold = today(); pc().ahead = null; });
      toast(`🔁 Ok: domani rifai il giorno ${n}`); scrollTo(0, 0);
    },
    'pc-early': () => { pc().ahead = today(); save(); render(); scrollTo(0, 0); },
    'pc-hadd': el => { const h = habitDef(el.dataset.id); if (h) addHabit(h); },
    'pc-hfrom': el => {
      const n = +el.dataset.n, d = dayOf(n); if (!d?.habitFrom) return;
      const hf = d.habitFrom, v = String(DR[key(n, 'am', hf.k)] ?? pc().days[n]?.am?.a?.[hf.k] ?? '').trim();
      if (!v) return toast('Scrivi prima il campo qui sopra');
      addHabit({id: 'pc_' + hf.k, e: hf.e || '🎯', n: v.slice(0, 40), role: el.dataset.role === 'core' ? 'core' : 'extra', type: 'bin', slot: hf.slot || 'any'});
    },
    'pc-copy': () => { copyText(exportText(calc())); },
    'pc-restart': () => showModal(`<div class="mc"><h2>Ricomincio da capo?</h2><p class="small muted">Il giro di adesso va nello storico (gemme, XP e trofei restano tutti) e si riparte dal giorno 1. Le abitudini del tracker non si toccano.</p><button class="btn gold" data-act="pc-restartok">Sì, nuovo giro</button><button class="btn ghost" data-act="close">No</button></div>`),
    'pc-restartok': () => {
      closeAll();
      mutate(() => { const p = pc(); if (Object.keys(p.days).length) p.past.push({cid: p.cid, start: p.start, end: today(), days: p.days}); p.past = p.past.slice(-12); p.days = {}; p.start = null; p.hold = null; p.ahead = null; p.cid = str(DA()?.CYCLE?.id || p.cid, 24); });
      DR = {}; nav = {scr: 'day', n: 0}; S.ui.tab = 'percorso'; save(); render(); scrollTo(0, 0);
    },
    'pc-off': () => { pc().off = 1; if (S.ui.tab === 'percorso') S.ui.tab = 'home'; save(); render(); toast('Scheda Percorso spenta: la riaccendi da qui'); },
    'pc-on': () => { pc().off = 0; save(); render(); toast('🧭 Scheda Percorso accesa'); },
  };

  /* ---------- campi di testo: la bozza va in memoria a ogni tasto ---------- */
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('input', e => { const el = e.target && e.target.closest ? e.target.closest('[data-pcf]') : null; if (el && /^\d+:(am|pm):[a-z0-9_]+$/.test(el.dataset.pcf)) DR[el.dataset.pcf] = el.value; });
  }

  const CSS = `
.pc-q{margin:16px 0 6px; font-size:1.02rem}
.pc-idea p{margin:8px 0; line-height:1.45}
.pc-steps{margin:6px 0 4px 0; padding-left:22px; line-height:1.45} .pc-steps li{margin:4px 0}
.pc-src{margin-top:10px}
.chips.pc-scale{display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; margin:0}
.pc-scale .chip.sm{min-width:0; margin:0; justify-content:center; padding:9px 4px}
.pc-dots{display:grid; grid-template-columns:repeat(10, 1fr); gap:5px; margin-top:12px}
.pc-dot{aspect-ratio:1; border-radius:9px; border:2px solid var(--line); background:var(--bg2); color:var(--dim); font:inherit; font-size:.72rem; font-weight:800; padding:0; cursor:pointer; touch-action:manipulation}
.pc-dot[disabled]{cursor:default; opacity:.75}
.pc-dot.rev{border-style:dashed}
.pc-dot.done{background:var(--ok); border-color:var(--ok); color:#04260f}
.pc-dot.half{background:var(--card2); border-color:var(--gold); color:var(--gold)}
.pc-dot.cur{border-color:var(--gold); color:var(--text); box-shadow:0 0 0 2px var(--gold) inset}
.pc-pin{display:flex; gap:10px; align-items:flex-start; background:var(--bg2); border-radius:12px; padding:8px 12px; margin-top:8px} .pc-pin span{font-size:1.3rem}
.pc-week{margin-top:6px}
.pc-wrow{display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--line)} .pc-wrow:last-child{border-bottom:0}
.pc-wrow .grow{display:flex; flex-direction:column; min-width:0}
.pc-marks{letter-spacing:2px; color:var(--ok); font-size:.85rem}
.pc-wb{display:flex; flex:none} .pc-wb .chip.sm{min-height:40px; padding:6px 9px}
.pc-hab .btns{display:flex; gap:8px; flex-wrap:wrap} .pc-hab .btns .btn{flex:1 1 140px}
`;
  function injectCSS() {
    try {
      if (typeof document === 'undefined' || document.getElementById('percorso-css')) return;
      const s = document.createElement('style'); s.id = 'percorso-css'; s.textContent = CSS;
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
  }
  function boot() { injectCSS(); }
  injectCSS();

  // c'è una risposta scritta a metà? (allora index.html non ricarica la pagina al rientro)
  function busy() { try { return S?.ui?.tab === 'percorso' && Object.values(DR).some(v => typeof v === 'string' && v.trim()); } catch (e) { return false; } }

  root.PERCORSO = {on, view, homeCard, meCard, actions, busy, engine: {defaults, clean, state, rewards, noDiary, NDAYS}};
})(typeof self !== 'undefined' ? self : globalThis);
