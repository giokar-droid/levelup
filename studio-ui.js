/* Level Up 3.0 · Studio — l'interfaccia (viste, wizard, timer, azioni, stile).
   Script classico: tutto dentro una IIFE, un solo nome globale: STUDIO.
   Specifica: «PROPOSTA - Level Up Studio 3.0 (19.11.2026).md», § 6.

   Come è fatto, in breve:
   - i conti li fa STUDIO_ENGINE, i testi li dà STUDIO_DATA: qui si disegna e basta;
   - lo stato vero sta in S.st (e il timer in S.ui.stTimer); quale schermata è aperta e le bozze stanno in variabili del modulo;
   - i globali di Level Up (S, save, render, mutate, calc, esc, toast, showModal…) si usano solo dentro le funzioni, mai al caricamento;
   - le azioni sono data-act="st-…" (STUDIO.actions). I pulsanti + e − (data-stq) e i campi di testo (data-stf) hanno un loro
     ascoltatore qui sotto: il dispatcher di Level Up blocca i tocchi per 400 ms dopo ogni azione, e uno stepper li perderebbe. */
(function (root) {
  'use strict';

  let EN = null, DA = null;
  function boot() {
    if (!EN) EN = root.STUDIO_ENGINE;
    if (!DA) DA = root.STUDIO_DATA;
    if (!EN || !DA) throw new Error('Studio: mancano il motore o i contenuti');
    injectCSS();
  }

  /* ---------- stato di navigazione (solo in memoria) ---------- */
  let nav = {scr: 'home'};                       // home (Oggi) | full (tutto il piano) | intro | new | test | tips | cfg | hist | import | week | cal | chat
  let D = null;                                  // bozza di «nuova verifica» (o della modifica)
  let L = {i: 0, skips: 0, walk: -1, walked: false, days: null, cap: 90, again: false};   // le 3 lezioni
  let M = null;                                  // quello che sta per segnare («Cosa hai fatto davvero?»)
  let G = null;                                  // nota in scrittura
  let IMP = {code: '', list: null, err: ''};     // importa da codice
  let OFF = {a: '', b: ''};                      // giorni liberi in scrittura
  let BL = [];                                   // i blocchi di oggi come sono a schermo
  let nwI = 0;                                   // «Non ho voglia»: consiglio a rotazione
  let walkT = null;                              // intervallo della lezione 2
  let wake = null;                               // schermo acceso durante il timer
  let wakeNo = 0;                                // se il sistema rifiuta lo schermo acceso, non si richiede prima di quest'ora
  let tmUnsaved = false;                         // il timer è partito ma il dispositivo non è riuscito a salvarlo
  let PEND = null;                               // riga in attesa della risposta a «L'hai capito?»
  let UNDO = [];                                 // cosa ha accompagnato le ultime righe («l'ho capito», «non ancora»): serve ad «Annulla»

  /* ---------- piccoli attrezzi ---------- */
  const WD = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
  const WDF = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
  const W1 = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
  const MO = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const KIND = {th: {e: '📖', n: 'Teoria'}, ex: {e: '✏️', n: 'Esercizi'}, rev: {e: '🔁', n: 'Ripasso'}};
  const CONF = ['', '🥶', '😐', '😎'];
  const ACTIVE = {today: 1, rush: 1, behind: 1, ontrack: 1, ready: 1, review: 1};
  const TAG = {
    ready: ['🏆 Pronto', 'ok'], ontrack: ['✅ In regola', 'ok'], behind: ['⚠️ Indietro', 'warn'], rush: ['🏃 Di corsa', 'bad'],
    review: ['🔁 Ripasso', 'blue'], today: ['📝 È oggi', 'gold'], wait: ['⏳ Manca la nota', 'dim'], done: ['📗 Fatta', 'dim'],
  };
  const FEEL = [[1, '😰', 'Panico'], [2, '😕', 'Teso'], [3, '😐', 'Normale'], [4, '🙂', 'Calmo'], [5, '😎', 'Sicuro']];
  const SCREENS = ['home', 'today', 'full', 'intro', 'new', 'test', 'tips', 'cfg', 'hist', 'import', 'week', 'cal', 'chat'];
  const classic = () => !!S.ui && S.ui.stHome === 'full';      // pagina iniziale «Tutto il piano» (a scelta in Impostazioni)

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pad2 = n => String(n).padStart(2, '0');
  const snap5 = (v, dir) => dir > 0 ? Math.floor(v / 5) * 5 + 5 : Math.ceil(v / 5) * 5 - 5;
  const fDay = k => EN.isDay(k) ? `${WD[EN.dow(k)]} ${+k.slice(8, 10)} ${MO[+k.slice(5, 7) - 1]}` : '';
  function fMin(m) {
    m = Math.max(0, Math.round(+m || 0));
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h} h ${pad2(r)}` : `${h} h`;
  }
  const inDays = n => n === 0 ? 'oggi' : n === 1 ? 'domani' : n > 1 ? `fra ${n} giorni` : n === -1 ? 'ieri' : `${-n} giorni fa`;
  const gTxt = v => String(Math.round(v * 100) / 100).replace('.', ',');
  const subjOf = k => DA.SUBJECTS.find(s => s.k === k) || DA.SUBJECTS[DA.SUBJECTS.length - 1];
  const tTitle = t => (t && t.name) || subjOf(t && t.subj).n;
  const findT = id => (S.st.tests || []).find(t => t && t.id === id) || null;
  const dayIx = k => EN.diff('2024-01-01', k);
  const rot = (a, k, off) => a[(((dayIx(k) + (off || 0)) % a.length) + a.length) % a.length];
  // il nome entra con una funzione: come stringa di sostituzione «$$» e «$&» avrebbero un significato loro
  const line = (key, T, off) => esc(rot(DA.LINES[key] || DA.LINES.start, T, off)).replace(/\{name\}/g, () => pname());
  const own = (o, k) => !!o && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
  // mentre si segna ieri le verifiche inserite dopo quel giorno non ci sono ancora: il piano si guarda senza di loro
  const bornAfter = (t, T) => !!t && EN.isDay(t.created) && t.created > T;
  function planOf(st, T) {
    const p = EN.plan(st, T);
    if (!yest()) return p;
    const tests = p.tests.filter(s => !bornAfter(s.test, T));
    return tests.length === p.tests.length ? p : Object.assign({}, p, {tests});
  }
  // posto per verifiche nuove: 40 aperte insieme, 400 in tutto (lo dice il motore)
  const roomLeft = () => { try { return typeof EN.room === 'function' ? EN.room(S.st, today()) : Math.max(0, 40 - S.st.tests.length); } catch (e) { return 0; } };
  const roomMsg = () => S.st.tests.length >= 400 ? 'Lo storico è pieno (400 verifiche): cancellane una vecchia dallo Storico.' : 'Hai già 40 verifiche aperte: prima chiudine una con la nota, o cancellane una.';
  const rew = (c, T) => c && c.study && c.study.byDay instanceof Map ? c.study : EN.rewards(S.st, T);
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const yest = () => !!viewDay;
  const plainName = () => { const n = String((P_() && P_().name) || ''); return n ? n[0].toUpperCase() + n.slice(1) : ''; };
  const realDay = () => { try { if (typeof realToday === 'function') return realToday(); } catch (e) {} return today(); };
  const $id = id => document.getElementById(id);
  const modalOpen = () => { const m = $id('modal'); return !!m && !m.hidden; };
  function go(scr, extra) { nav = Object.assign({scr: SCREENS.includes(scr) ? scr : 'home'}, extra || {}); render(); scrollTo(0, 0); }
  function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

  /* ---------- pezzi di interfaccia ---------- */
  function sayHTML(c, html) {
    return `<div class="st-say"><div class="st-bud">${buddyHTML(c, 60)}</div><div class="st-sb">${html}</div></div>`;
  }
  function ringHTML(pct, big, small, cls) {
    const C = 263.9, off = (C * (1 - clamp(pct, 0, 1))).toFixed(1);
    return `<div class="st-ring ${cls || ''}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="t" cx="50" cy="50" r="42"/><circle class="p" cx="50" cy="50" r="42" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 50 50)"/></svg><div class="c"><b>${big}</b>${small ? `<span>${small}</span>` : ''}</div></div>`;
  }
  const ringMin = m => m < 60 ? [String(m), 'min'] : [`${Math.floor(m / 60)}<i>h</i>${m % 60 ? pad2(m % 60) : ''}`, 'da fare'];
  const stepper = (key, txt) => `<div class="stepper st-stp" data-stp="${key}"><button type="button" data-stq="-1" aria-label="meno">−</button><b>${txt}</b><button type="button" data-stq="1" aria-label="più">+</button></div>`;
  const setChips = (key, vals, cur, fmt) => `<div class="chips st-ctr">${vals.map(v => `<button class="chip ${v === cur ? 'on' : ''}" data-act="st-set" data-k="${key}" data-stc="${key}" data-v="${v}">${fmt ? fmt(v) : v}</button>`).join('')}</div>`;
  function hpHTML(left, total) {
    const pct = total > 0 ? clamp(Math.round(100 * left / total), 0, 100) : 0;
    return `<span class="st-hp" role="img" aria-label="Punti vita: ${left} su ${total}"><i style="width:${pct}%"></i></span>`;
  }
  const backHTML = (label, scr, id) => `<button class="link st-back" data-act="st-go" data-scr="${scr || 'home'}"${id ? ` data-id="${esc(id)}"` : ''}>← ${label || 'Studio'}</button>`;

  // un blocco (del piano, di un argomento o del timer) con tutto quello che serve per mostrarlo
  function blockInfo(b) {
    if (b && b.k === 'hw') return {t: null, a: null, boss: {e: '✏️', n: 'i compiti'}, sub: {e: '✏️', n: 'Compiti'}, e: '✏️', title: 'Compiti', what: `Compiti · ${fMin(b.min)}`,
      x: 'Uno alla volta, dal più difficile. Quando hai finito, segna quanto ci hai messo.'};
    const t = findT(b.tid); if (!t) return null;
    const a = b.aid ? (t.topics || []).find(x => x.id === b.aid) || null : null, boss = DA.bossFor(t), sub = subjOf(t.subj);
    if (b.k === 'rev') {
      const rv = own(DA.REVIEW, b.rev) ? DA.REVIEW[b.rev] : DA.REVIEW.recall;
      return {t, a, boss, sub, e: rv.e, title: rv.t, what: `Ripasso · ${fMin(b.min)}`, x: rv.x};
    }
    if (b.k === 'ex') return {t, a, boss, sub, e: '✏️', title: a ? a.n : 'Esercizi', what: `${plural(b.n, 'esercizio', 'esercizi')} · circa ${fMin(b.min)}`,
      x: t.sheet ? 'Tieni il formulario accanto e usalo, come in verifica.' : 'Prima da solo, fino in fondo. La soluzione si guarda dopo.'};
    // il formulario si prepara mentre si studia la teoria: negli esercizi poi lo si usa
    return {t, a, boss, sub, e: '📖', title: a ? a.n : 'Teoria', what: `Teoria · ${fMin(b.min)}`,
      x: t.sheet ? 'Mentre studi, scrivi sul formulario le formule che incontri, con due parole su quando servono. Alla fine prova a ridirla a libro chiuso.' : 'Una cosa sola: questa. Alla fine prova a ridirla a libro chiuso.'};
  }
  // un blocco su misura per un argomento (dalla scheda della verifica)
  function topicBlock(t, aid, k) {
    const a = EN.totals(S.st, t).topics.find(x => x.id === aid); if (!a) return null;
    const blk = S.st.cfg.block;
    if (!k) k = a.thLeft > 0 ? 'th' : a.kind === 'th' ? 'th' : 'ex';
    if (k === 'th') return {tid: t.id, aid, k: 'th', min: clamp(a.thLeft > 0 ? Math.min(blk, a.thLeft) : blk, 5, blk), n: 0, rev: null};
    const n = clamp(Math.floor(blk / Math.max(1, a.perEx)), 1, Math.max(1, a.exNLeft || 1));
    return {tid: t.id, aid, k: 'ex', min: clamp(n * a.perEx, 5, Math.max(5, blk)), n, rev: null};
  }

  // la frase del buddy adatta al momento
  function lineFor(c, p, r, T) {
    if (yest()) return `Stai segnando ieri, ${pname()}. Metti solo quello che hai studiato davvero.`;
    const t = p.today, has = s => p.tests.some(x => x.status === s), act = p.tests.filter(x => ACTIVE[x.status] && x.status !== 'today');
    const allReady = act.length > 0 && act.every(x => x.status === 'ready');
    let k;
    // il giorno della verifica: «il lavoro l'hai fatto» solo se è vero (piano di ogni verifica di oggi almeno all'80 %)
    if (has('today')) k = DA.LINES.testdayOk && p.tests.filter(x => x.status === 'today').every(x => x.pct >= 80) ? 'testdayOk' : 'testday';
    else if (t.full) k = allReady ? 'ready' : 'full';
    else if (t.cushion || (t.rest && act.length && !p.days[0].study && !p.days[0].off)) k = 'cushion';
    else if (t.rest || t.left <= 0) k = allReady ? 'ready' : !act.length && has('wait') ? 'wait' : 'rest';
    else if (t.done > 0) k = 'mid';
    else if (has('behind') || has('rush')) k = 'behind';
    else if (act.some(x => x.status === 'review') && !act.some(x => x.status === 'ontrack')) k = 'review';
    else if (r.streak >= 3) k = 'streak';
    else k = 'start';
    return line(k, T);
  }

  /* ---------- casa dello Studio ---------- */
  function todayCard(p, r, T) {
    const t = p.today, y = yest(), cfg = S.st.cfg, d0 = p.days[0] || {};
    const act = p.tests.filter(x => ACTIVE[x.status] && x.status !== 'today');
    BL = t.blocks.slice(0, 12);
    const many = new Set(BL.map(b => b.tid)).size > 1 || act.length > 1;
    let ring, head, sub;
    const nothing = !t.full && !t.cushion && (t.rest || t.left <= 0);
    if (t.full) { ring = ringHTML(1, '✓', 'fatto', 'full'); head = 'Quota fatta'; sub = `${fMin(t.done)} segnati${t.q > 0 ? ` su ${fMin(t.q)}` : ''}.${y ? '' : ' Il resto della giornata è tuo.'}`; }
    else if (t.cushion) { ring = ringHTML(t.done / Math.max(1, t.cushion.min), '☂️', '', 'soft'); head = `Recupero: ${fMin(t.cushion.min)}`; sub = 'Giorno cuscinetto: se vuoi rimetti in pari i conti. Nessun obbligo.'; }
    else if (nothing) {
      const cush = !d0.study && !d0.off;
      ring = ringHTML(0, d0.off ? '🏖️' : cush ? '☂️' : '😌', '', 'soft');
      head = d0.off ? 'Giorno libero' : cush ? 'Giorno cuscinetto' : t.q > 0 ? `Per ${y ? 'ieri' : 'oggi'} basta così` : y ? 'Ieri niente studio' : 'Oggi niente studio';
      sub = d0.off ? (y ? 'Il piano ieri ti saltava: lo avevi segnato libero.' : 'Il piano oggi ti salta: lo hai segnato libero.') : cush ? (y ? 'Eri in pari: riposo vero.' : 'Sei in pari: riposo vero.') : y ? 'Il piano ieri non chiedeva niente.' : 'Il piano oggi non chiede niente.';
    } else {
      const rm = ringMin(t.left);
      ring = ringHTML(t.q > 0 ? t.done / t.q : 0, rm[0], rm[1], '');
      head = t.done > 0 ? `Ancora ${fMin(t.left)}` : `${fMin(t.q)} di studio`;
      sub = t.done > 0 ? `Fatti ${fMin(t.done)} su ${fMin(t.q)}.` : `${plural(BL.length, 'blocco', 'blocchi')}, uno alla volta.`;
    }
    let out = `<div class="card st-today"><div class="row">${ring}<div class="grow"><div class="label">${y ? 'Ieri' : 'Oggi'} · ${fDay(T)}</div><div class="st-hd">${head}</div><div class="small muted">${sub}</div></div></div>`;

    // la quota è salita: lo si dice chiaro, con i numeri
    const beh = act.filter(x => x.status === 'behind' && x.quota > x.base.q && x.base.q > 0);
    const yd = r.byDay.get(EN.addD(T, -1));
    if (!t.full && !nothing) {
      // con più verifiche in gioco la frase dice di quale parla: il numero grande qui sopra è il totale del giorno
      const nums = `ora sono <b>${fMin(sum(beh, x => x.quota))}</b> al giorno, erano ${fMin(sum(beh, x => x.base.q))}.`;
      const up = !beh.length ? '' : act.length < 2 ? ' O' + nums.slice(1) : beh.length === 1 ? ` Per «${esc(tTitle(beh[0].test))}» ${nums}` : ` Per le verifiche in ritardo ${nums}`;
      if (yd && yd.q > 0 && !yd.full) out += `<div class="st-note warn small">⚠️ ${y ? 'Il giorno prima' : 'Ieri'} ${yd.min > 0 ? `solo ${fMin(yd.min)} su ${fMin(yd.q)}` : 'niente studio'}: quel lavoro non è sparito, si è spostato sui giorni dopo.${up}</div>`;
      else if (beh.length) out += `<div class="st-note warn small">⚠️ Sei indietro di ${fMin(sum(beh, x => x.behind))}.${up}</div>`;
    }

    if (BL.length && !t.full) {
      out += `<div class="st-blocks">${BL.map((b, i) => blockRow(b, i, many, i === 0 && !t.done)).join('')}</div>`;
      if (y) out += `<div class="small dim" style="margin-top:8px">Niente timer mentre segni ieri: tocca ✔ sul blocco che avevi fatto.</div>`;
    }
    if (!t.full && !nothing && !t.cushion && !y) {
      const tom = p.days[1], cushTom = !!tom && !tom.study && !tom.off, nx = t.skipNext;
      if (t.skipCost != null) out += `<div class="st-note small">😬 Se salti oggi, domani sono <b>${fMin(t.skipCost)}</b>${tom && tom.q > 0 && tom.q < t.skipCost ? ` invece di ${fMin(tom.q)}` : ''}.</div>`;
      else if (nx && nx.q > 0 && EN.isDay(nx.d)) {
        // domani non ha quota (cuscinetto o giorno libero): il conto del salto arriva il primo giorno di studio dopo, e si dice con il numero
        const dd = p.days.find(x => x.d === nx.d), gap = EN.diff(T, nx.d);
        out += `<div class="st-note small">😬 Se salti oggi, ${gap >= 2 && gap <= 6 ? WDF[EN.dow(nx.d)] : fDay(nx.d)} sono <b>${fMin(nx.q)}</b>${dd && dd.q > 0 && dd.q < nx.q ? ` invece di ${fMin(dd.q)}` : ''}.${cushTom ? ' Domani è cuscinetto: recuperi lì, se vuoi.' : ''}</div>`;
      } else if (cushTom) out += `<div class="st-note small">☂️ Domani è cuscinetto: se oggi salti, è lì che si recupera.</div>`;
    }
    if (t.full && !y) {
      const more = act.find(x => x.left > 0);
      if (more) out += `<button class="btn ghost" data-act="st-open" data-id="${esc(more.id)}">➕ Faccio un pezzo in più</button>`;
    } else if (BL.length && !y) out += `<button class="btn ghost" data-act="st-nowill">😮‍💨 Non ho voglia</button>`;
    if ((S.st.log || []).some(x => x.d === T)) out += `<button class="link" data-act="st-undo">Annulla l'ultima cosa segnata</button>`;
    return out + `</div>`;
  }
  function blockRow(b, i, many, first) {
    const f = blockInfo(b); if (!f) return '';
    return `<div class="st-blk"><span class="xe">${f.e}</span><span class="grow"><b>${esc(f.title)}</b><small><i class="st-ke">${f.e} </i>${f.what}</small>${many ? `<small class="st-of">${f.sub.e} ${esc(tTitle(f.t))}</small>` : ''}</span>${yest() ? '' : `<button class="st-ib go ${first ? 'pulse' : ''}" data-act="st-play" data-i="${i}" aria-label="Avvia il timer: ${esc(f.title)}">▶</button>`}<button class="st-ib" data-act="st-hand" data-i="${i}" aria-label="Già fatto: segno a mano ${esc(f.title)}">✔</button></div>`;
  }
  function bossCard(s) {
    const t = s.test, sub = subjOf(t.subj), b = DA.bossFor(t), tg = TAG[s.status] || TAG.ontrack, dead = s.left <= 0;
    let pace;
    if (s.status === 'ready') pace = 'Lavoro finito: da qui solo ripasso';
    else if (s.status === 'review') pace = `Solo ripasso: <b>${fMin(s.reviewMin)}</b> al giorno`;
    else if (s.status === 'today') pace = 'In bocca al lupo';
    else if (s.status === 'rush') pace = `<b>${fMin(s.left)}</b> prima della verifica`;
    else {
      pace = s.base.q > 0 && s.quota > 0 && s.quota !== s.base.q ? `<span class="${s.quota > s.base.q ? 'st-up' : 'st-down'}">${s.base.q} → <b>${fMin(s.quota)}</b></span> al giorno` : `<b>${fMin(s.quota)}</b> al giorno`;
      pace += ` · pronto entro ${fDay(s.readyBy)}`;
    }
    // la battuta del boss cambia con i punti vita rimasti; sotto, cosa si vince e entro quando
    let taunt = '', prize = '';
    try {
      const f = s.total > 0 ? s.left / s.total : 0, band = dead ? 'dead' : f > .66 ? 'hi' : f > .25 ? 'mid' : 'low', list = DA.TAUNT && DA.TAUNT[band];
      if (s.total > 0 && s.status !== 'today' && Array.isArray(list) && list.length) taunt = `<span class="small st-taunt">${esc(rot(list, today(), +String(t.id).replace(/\D/g, '') || 0))}</span>`;
    } catch (e) {}
    if (s.left > 0 && (s.status === 'ontrack' || s.status === 'behind')) prize = `🏁 Boss a terra: +25 💎 · entro ${fDay(s.readyBy)} altri +25 💎`;
    else if (s.left > 0 && s.status === 'rush') prize = '⚔️ Boss a terra prima della verifica: +25 💎';
    if (s.total <= 0 && s.status !== 'today') pace = 'Nessun argomento: aggiungili con Modifica';
    return `<button class="card st-boss ${dead ? 'dead' : ''}" data-act="st-open" data-id="${esc(t.id)}" data-boss="${esc(t.id)}">
      <span class="row"><span class="st-mon">${b.e}</span><span class="grow"><span class="label">${sub.e} ${esc(sub.n)} · ${fDay(t.date)}</span><b class="st-bn">${esc(tTitle(t))}</b><span class="small muted st-bl">${esc(b.n)} · ${inDays(s.daysTo)}</span>${taunt}</span><span class="st-go" aria-hidden="true">›</span></span>
      <span class="st-hpw">${hpHTML(s.left, s.total)}<span class="st-hpt">❤️ ${s.left} / ${s.total}</span></span>
      <span class="st-foot"><span class="st-tag ${tg[1]}">${tg[0]}</span><span class="small muted">${pace}</span></span>${prize ? `<span class="small dim st-prize">${prize}</span>` : ''}</button>`;
  }
  function streakCard(p, r, T) {
    const ws = EN.addD(T, -EN.dow(T)), byD = new Map(p.days.map(d => [d.d, d]));
    const wk = W1.map((l, i) => {
      const d = EN.addD(ws, i), h = r.byDay.get(d), x = byD.get(d);
      let cls = '', sym = '';
      if (h && h.full) { cls = 'done'; sym = '✓'; }
      else if (d < T) { if (h && h.q > 0) { cls = 'miss'; sym = h.min > 0 ? h.min + '′' : '·'; } }
      else if (x) sym = x.off ? '🏖️' : !x.study ? '☂️' : d === T && h && h.min > 0 ? h.min + '′' : '';
      return `<div class="wd ${cls} ${d === T ? 'today' : ''}">${l}<b>${sym}</b></div>`;
    }).join('');
    const full = p.today.full, toFive = 5 - (r.streak % 5);
    let st, warn = false;
    if (r.brace && !full) { warn = true; st = "⚠️ Ieri la quota è saltata. Oggi la fai e la serie continua; se salti anche oggi riparte da zero."; }
    else if (r.streak > 0) st = `${full ? '✔ Oggi è dentro.' : 'Oggi la quota e la serie sale.'} ${toFive === 5 ? 'Altri 5 giorni pieni: +15 💎.' : `Ancora ${plural(toFive, 'giorno pieno', 'giorni pieni')} e arrivano +15 💎.`}`;
    else st = r.best > 0 ? `Serie ripartita da zero (record ${r.best}). Con la quota di oggi riparte da 1.` : 'Giornata piena = quota di oggi fatta. Ogni 5 di fila: +15 💎.';
    return `<div class="card"><div class="row"><div class="flame ${r.streak > 0 ? (r.brace && !full ? 'ember' : '') : 'off'}">⚔️</div><div class="grow"><div class="label">Serie di studio</div><div class="snum">${r.streak}</div><div class="small muted">${r.streak === 1 ? 'giorno pieno' : 'giorni pieni'} di fila · record ${r.best}</div></div></div>
      <div class="state ${warn ? 'warn' : ''}">${st}</div><div class="week">${wk}</div>
      <div class="small dim" style="margin-top:8px">☂️ cuscinetto e 🏖️ giorni liberi non spezzano la serie: contano solo i giorni con una quota.</div></div>`;
  }
  // la mappa dei giorni: tutta (30 giorni, toccabile) oppure di una sola verifica (fino alla sua data)
  function mapHTML(p, r, T, tid) {
    const st = S.st, cap = st.cfg.cap, start = EN.addD(T, -EN.dow(T)), only = tid ? findT(tid) : null;
    const last = only ? only.date : EN.addD(T, 29);
    const n = clamp(Math.ceil((EN.diff(start, last) + 1) / 7) * 7, 7, 42);
    const byD = new Map(p.days.map(d => [d.d, d])), bossOn = new Map();
    const hid = yest() ? new Set(st.tests.filter(t => bornAfter(t, T)).map(t => t.id)) : null;
    for (const t of st.tests) if (t.grade == null && !(hid && hid.has(t.id)) && !bossOn.has(t.date)) bossOn.set(t.date, DA.bossFor(t).e);
    let cells = W1.map(l => `<div class="h">${l}</div>`).join('');
    for (let i = 0; i < n; i++) {
      const d = EN.addD(start, i), x = byD.get(d), num = +d.slice(8, 10);
      let cls = '', mid = '', say = fDay(d), tap = false;
      if (d < T && only) cls = 'past';                    // nella mappa di una verifica sola i giorni passati restano muti: il registro generale è di tutte
      else if (d < T) { const h = r.byDay.get(d); cls = 'past' + (h && h.full ? ' full' : h && h.q > 0 ? ' miss' : ''); mid = h && h.full ? '✓' : h && h.min > 0 ? h.min + '′' : h && h.q > 0 ? '✗' : ''; }
      else if (!x || (only && d > only.date)) cls = 'far';
      else {
        const items = only ? x.items.filter(it => it.tid === tid) : x.items;
        const q = d === T && !only ? Math.max(x.q, sum(items, it => it.min)) : sum(items, it => it.min);
        const tests = only ? x.tests.filter(id => id === tid) : hid ? x.tests.filter(id => !hid.has(id)) : x.tests;
        if (tests.length) { cls = 'test'; mid = bossOn.get(d) || '📝'; say += ': verifica'; }
        else if (x.off) { cls = 'off'; mid = '🏖️'; say += ': giorno libero'; tap = true; }
        else if (x.busy) { cls = 'off'; mid = '😴'; say += ': niente studio'; tap = true; }
        else if (x.on === false || (x.on === undefined && !x.study)) { cls = 'cush'; mid = '☂️'; say += ': cuscinetto'; tap = true; }
        else if (q > 0) {
          const rev = items.length > 0 && items.every(it => it.phase === 'review'), rush = items.some(it => it.phase === 'rush') || (!only && x.over > 0);
          cls = (rush ? 'rush' : rev ? 'rev' : 'stu') + ' l' + clamp(Math.ceil(4 * q / cap), 1, 4); mid = q + '′'; say += `: ${fMin(q)}${rev ? ' di ripasso' : ''}`; tap = true;
        } else { cls = 'free'; mid = '·'; say += ': niente'; tap = true; }
        if (d === T) cls += ' now';
      }
      const body = `<small>${num}</small><b>${mid}</b>`;
      cells += tap && !only && !yest() ? `<button class="st-c ${cls}" data-act="st-off" data-d="${d}" aria-label="${say}. Tocca per segnarlo libero o rimetterlo.">${body}</button>` : `<div class="st-c ${cls}" ${cls === 'far' ? 'aria-hidden="true"' : `title="${say}"`}>${body}</div>`;
    }
    return `<div class="st-map">${cells}</div>`;
  }
  const mapLegend = () => `<div class="legend st-leg"><span><i class="s"></i>studio</span><span><i class="r"></i>ripasso</span><span>☂️ cuscinetto</span><span>🏖️ libero</span><span>📝 verifica</span></div>`;
  function menuHTML(withNew) {
    return `${withNew ? `<button class="btn big" data-act="st-new">＋ Nuova verifica</button>` : ''}
      <div class="st-grid2"><button class="btn ghost" data-act="st-go" data-scr="import">📥 Ho un codice</button><button class="btn ghost" data-act="st-go" data-scr="tips">📘 Come si studia</button><button class="btn ghost" data-act="st-go" data-scr="cfg">⚙️ Impostazioni</button><button class="btn ghost" data-act="st-go" data-scr="hist">📜 Storico e note</button></div>`;
  }
  function vHome(c, live) {
    const st = S.st, T = today(), y = yest();
    if (live && !y) { try { if (EN.stamp(st, T)) save(); } catch (e) {} }
    const p = planOf(st, T), r = rew(c, T), late = y ? st.tests.filter(t => bornAfter(t, T)) : [];
    const act = p.tests.filter(s => ACTIVE[s.status]), wait = p.tests.filter(s => s.status === 'wait'), now = p.tests.filter(s => s.status === 'today');
    let out = topbar(c) + (nav.scr === 'full' && !y ? backHTML('Oggi') + '<h2>📊 Tutto il piano</h2>' : '')
      + (nav.scr === 'home' && classic() && !y && st.tests.length ? `<button class="link" data-act="st-go" data-scr="today">☀️ Oggi, una cosa alla volta</button>` : '');
    if (st.tests.length === late.length) {
      out += sayHTML(c, y ? `Stai segnando ieri, ${pname()}. Ieri qui non c'era ancora nessuna verifica.` : `Nessuna verifica in arrivo, ${pname()}? Quando ne spunta una mettila qui: ai conti penso io.`);
      if (y) return out;
      return out + `<div class="card center st-empty"><div class="big-emoji bob" style="font-size:84px">👾</div><h2>Ogni verifica è un boss</h2><p class="muted">Dimmi quando è e cosa c'è da sapere. Io spalmo il lavoro sui giorni e ti dico quanto fare oggi. Tu arrivi pronto due giorni prima.</p><button class="btn big pulse" data-act="st-new">＋ Nuova verifica</button></div>${menuHTML(false)}`;
    }
    out += sayHTML(c, lineFor(c, p, r, T));
    for (const s of now) {
      const b = DA.bossFor(s.test), sub = subjOf(s.test.subj), k = ((dayIx(T) % 2) + 2) % 2;
      const tips = [DA.TESTDAY[k], DA.TESTDAY[2 + k], DA.TESTDAY[4 + k]].filter(Boolean);
      out += `<div class="card st-td" data-boss="${esc(s.id)}"><div class="row"><div class="st-mon bob">${b.e}</div><div class="grow"><div class="label">Oggi · ${sub.e} ${esc(sub.n)}</div><b class="st-bn">In bocca al lupo, ${pname()}!</b><div class="small muted">${esc(tTitle(s.test))}${s.pct >= 80 ? ` · piano fatto al ${s.pct} %` : ''}</div></div></div>
        <ol class="st-tips">${tips.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
        <button class="btn ghost" data-act="st-open" data-id="${esc(s.id)}" data-grade="1">L'ho già fatta: racconto com'è andata</button></div>`;
    }
    for (const s of wait) {
      const b = DA.bossFor(s.test), sub = subjOf(s.test.subj);
      out += `<div class="card st-wait"><div class="row"><div class="st-mon">${b.e}</div><div class="grow"><div class="label">${sub.e} ${esc(sub.n)} · ${fDay(s.test.date)}</div><b class="st-bn">Com'è andata?</b><div class="small muted">${esc(tTitle(s.test))}. Segna la nota quando arriva: +10 💎, qualunque sia.</div></div></div><button class="btn gold" data-act="st-open" data-id="${esc(s.id)}" data-grade="1">📝 Segna la nota</button></div>`;
    }
    const going = act.filter(s => s.status !== 'today');
    if (going.length) out += todayCard(p, r, T);
    if (p.overload > 0 && !y) out += `<div class="banner small"><b>⚠️ Non ci sta tutto.</b> ${fMin(p.overload)} restano fuori dal tempo che hai. Il piano non li nasconde: o dai più tempo a qualche giorno, o togli qualcosa.<div class="btns"><button class="btn" data-act="st-go" data-scr="week">⏱️ La mia settimana</button></div></div>`;
    if (going.length) {
      out += `<h3>I boss</h3>${going.map(bossCard).join('')}`;
      out += streakCard(p, r, T);
      out += `<div class="card st-mapc"><b>🗓️ I prossimi 30 giorni</b>${mapHTML(p, r, T, null)}${mapLegend()}${y ? '' : `<div class="small dim" style="margin-top:8px">Vacanza, gara, gita? Tocca il giorno: diventa libero e il piano lo salta. Un altro tocco e torna com'era.</div>`}</div>`;
    } else if (!now.length && !wait.length) {
      out += `<div class="card center"><div class="big-emoji" style="font-size:72px">🏝️</div><h2>Nessun boss in vista</h2><p class="muted">Tutte le verifiche sono alle spalle. Quando ne arriva un'altra, mettila qui.</p></div>`;
      if (r.streak > 0 || r.best > 0) out += streakCard(p, r, T);
    }
    if (late.length) out += `<p class="small dim center">${late.length === 1 ? `«${esc(tTitle(late[0]))}» l'hai inserita dopo: ieri non c'era ancora.` : `${late.length} verifiche le hai inserite dopo: ieri non c'erano ancora.`}</p>`;
    if (!y) out += menuHTML(true);
    return out;
  }

  /* ---------- le 3 lezioni ---------- */
  const L1Q = k => Math.ceil(360 / (6 - clamp(k, 0, 5)) / 5) * 5;      // 60, 75, 90, 120, 180, 360
  const L2 = ['s', 's', 's', 's', 's', 's', 'r', 'r', 'v'];
  function l2Cap(w) {
    if (w < 0) return 'Verifica fra 8 giorni. Dove finisce lo studio?';
    if (w < 5) return `Giorno ${w + 1}: <b>studio</b>, un pezzo alla volta.`;
    if (w === 5) return `Giorno 6: ultimo pezzo. <b>Pronto</b>, con 2 giorni di anticipo.`;
    if (w < 8) return `${w === 6 ? 'Due giorni prima' : 'Il giorno prima'}: <b>solo ripasso</b>, niente di nuovo.`;
    return '<b>Verifica.</b> Arrivi pronto, e tranquillo.';
  }
  function introReset(again) {
    const cfg = S.st.cfg;
    L = {i: 0, skips: 0, walk: -1, walked: false, days: cfg.days.slice(), cap: cfg.cap, again: !!again};
    if (walkT) { clearInterval(walkT); walkT = null; }
  }
  function vIntro(c) {
    if (!L.days) introReset(false);
    const list = DA.INTRO, n = list.length, it = list[L.i] || list[0];
    let body = '';
    if (it.k === 'spread') {
      const k = L.skips, q = L1Q(k);
      const bars = WD.slice(0, 6).map((d, i) => {
        const sk = i < k, h = sk ? 6 : Math.round(28 + 122 * (q - 60) / 300);
        return `<div class="b ${sk ? 'skip' : k >= 5 ? 'max' : k > 0 ? 'hot' : ''}"><b>${sk ? '😬' : fMin(q).replace(' min', '′')}</b><i style="height:${h}px"></i><span>${d}</span></div>`;
      }).join('');
      body = `<div class="card st-l1"><div class="center"><div class="label">${k >= 5 ? "L'ultimo giorno" : k ? plural(6 - k, 'giorno rimasto', 'giorni rimasti') + ', ognuno da' : '6 giorni, ognuno da'}</div><div class="st-num ${k >= 5 ? 'bad' : k ? 'warn' : ''}" id="st-l1q">${fMin(q)}</div></div>
        <div class="st-bars" id="st-l1b">${bars}<div class="b v"><b></b><em>📝</em><span>verifica</span></div></div>
        ${k >= 5 ? `<div class="say">${esc(it.end || '')}</div>` : ''}
        <button class="btn ${k >= 5 ? 'ghost' : 'gold'}" data-act="st-l1">${k >= 5 ? '↺ Da capo' : esc(it.btn)}</button></div>`;
    } else if (it.k === 'ready') {
      const w = L.walk;
      body = `<div class="card st-l2"><div class="st-tl" id="st-tl">${L2.map((x, i) => `<div class="d ${x} ${i === w ? 'on' : ''} ${i < w ? 'seen' : ''}"><b>${x === 's' ? '📖' : x === 'r' ? '🔁' : '📝'}</b><span>${i < 8 ? i + 1 : '★'}</span></div>`).join('')}</div>
        <div class="legend st-leg"><span><i class="s"></i>studio</span><span><i class="r"></i>ripasso</span><span><i class="v"></i>verifica</span></div>
        <div class="st-cap" id="st-l2c">${l2Cap(w)}</div>
        ${L.walked ? `<div class="say">${esc(it.end || '')}</div>` : ''}
        <button class="btn ${L.walked ? 'ghost' : 'gold'}" data-act="st-l2">${L.walked ? '↺ Rivedi' : esc(it.btn)}</button></div>`;
    } else {
      const on = L.days.filter(Boolean).length, offs = L.days.map((v, i) => v ? null : WDF[i]).filter(Boolean);
      const note = on === 7 ? '⚠️ <b>7 su 7</b>: nessun cuscinetto. Se salti un giorno non hai dove recuperarlo.'
        : on === 6 ? `☂️ Cuscinetto: <b>${offs[0]}</b>. Tutto bene? Riposo. Saltato un giorno? Si recupera lì.`
        : `☂️ ${7 - on} giorni cuscinetto (${offs.join(', ')}). Più respiro, ma negli altri giorni la quota sale un po'.`;
      body = `<div class="card"><b>I giorni in cui studi</b><div class="st-days">${WD.map((d, i) => `<button class="chip ${L.days[i] ? 'on' : ''}" data-act="st-l3d" data-i="${i}" aria-pressed="${!!L.days[i]}">${d}</button>`).join('')}</div>
        <div class="st-note small">${note}</div>
        <h3>Tetto al giorno</h3><p class="small muted">Più di così il piano non ti chiede, nemmeno con due verifiche insieme.</p>
        <div class="chips st-ctr">${[45, 60, 90, 120].map(v => `<button class="chip ${L.cap === v ? 'on' : ''}" data-act="st-l3c" data-v="${v}">${fMin(v)}</button>`).join('')}</div></div>
        <div class="say small">${esc(it.end || '')}</div>`;
    }
    const okNext = L.i === 0 ? L.skips > 0 : L.i === 1 ? L.walked : true;
    return `<div class="wz-top">${L.i > 0 ? '<button class="wz-back" data-act="st-l-back" aria-label="Indietro">←</button>' : ''}<div class="bar"><i style="width:${Math.round(100 * (L.i + (okNext ? 1 : .35)) / n)}%"></i></div><span class="xpc">📚 ${L.i + 1}/${n}</span></div>
      <span class="lesson">📚 Lezione ${L.i + 1} · ${esc(it.t)}</span>
      ${sayHTML(c, esc(it.x))}${body}
      <div class="wz-foot"><button class="btn big" id="st-next" data-act="st-l-next" ${okNext ? '' : 'disabled'}>${L.i === n - 1 ? '🚀 Si parte' : 'Avanti ▶'}</button>
      ${L.again ? '<button class="link" data-act="st-l-skip">Chiudi le lezioni</button>' : L.i === 0 ? '<button class="link" data-act="st-l-skip">Le conosco già: salta</button>' : ''}</div>`;
  }

  /* ---------- nuova verifica (e modifica): il buddy fa le domande ---------- */
  const newTopic = () => ({n: '', kind: 'both', conf: 2, thMin: 30, exN: 10, exMin: 5});
  // la proposta di partenza secondo «quanto lo sai già» (1 da zero · 2 così così · 3 quasi)
  const SUG = {th: [0, 45, 30, 15], ex: [0, 12, 10, 6], say: ['', 'da zero', 'così così', 'quasi']};
  function newDraft() { return {id: null, step: 'subj', subj: '', date: '', name: '', sheet: false, topics: [], t: newTopic(), ti: -1}; }
  function draftOf(t) {
    return {id: t.id, step: 'date', subj: t.subj, date: t.date, name: t.name || '', sheet: !!t.sheet,
      topics: t.topics.map(a => ({id: a.id, n: a.n, kind: a.kind, conf: a.conf, thMin: a.thMin || 30, exN: a.exN || 10, exMin: a.exMin || 5, thFin: a.thFin ? 1 : 0})), t: newTopic(), ti: -1};
  }
  const topicClean = a => ({id: a.id, n: a.n, kind: a.kind, conf: a.conf, thMin: a.kind === 'ex' ? 0 : a.thMin, exN: a.kind === 'th' ? 0 : a.exN, exMin: a.kind === 'th' ? 0 : a.exMin, thFin: a.kind === 'ex' ? 0 : (a.thFin ? 1 : 0)});
  const draftData = () => ({subj: D.subj, name: D.name.trim(), date: D.date, sheet: !!D.sheet, topics: D.topics.map(topicClean)});
  const topicMin = a => (a.kind === 'ex' ? 0 : a.thMin) + (a.kind === 'th' ? 0 : a.exN * a.exMin);
  function topicSum(a) {
    const parts = [];
    if (a.kind !== 'ex') parts.push(`<span class="st-nw">📖 ${fMin(a.thMin)}</span>`);
    if (a.kind !== 'th') parts.push(`<span class="st-nw">✏️ ${a.exN} × ${a.exMin} min</span>`);
    return `${CONF[a.conf] || ''} ${parts.join(' + ')} <span class="st-nw">= <b>${fMin(topicMin(a))}</b></span>`;
  }
  function applyDraft(st, test) {
    const d = draftData();
    test.subj = d.subj; test.name = d.name; test.date = d.date; test.sheet = d.sheet;
    test.topics = d.topics.map(a => { const o = Object.assign({}, a); if (!o.id) delete o.id; return o; });
  }
  // i conti veri su una copia dello stato: quello che vedrà dopo aver salvato
  function simulate() {
    try {
      const T = today(), st2 = EN.clean(JSON.parse(JSON.stringify(S.st)));
      let test;
      if (D.id) { test = st2.tests.find(t => t.id === D.id); if (!test) return null; applyDraft(st2, test); if (!EN.rebase(st2, test, T)) return null; }
      else test = EN.newTest(st2, T, draftData());
      if (!test) return null;
      const p = EN.plan(st2, T), s = p.tests.find(x => x.id === test.id);
      return s ? {st2, test, p, s} : null;
    } catch (e) { return null; }
  }
  function sparkHTML(p, test, T) {
    const days = p.days.filter(x => x.d <= test.date);
    if (!days.length) return '';
    const val = x => sum(x.items.filter(it => it.tid === test.id), it => it.min), max = Math.max(15, ...days.map(val));
    const bars = days.map(x => {
      if (x.d === test.date) return `<i class="v" style="height:100%" title="${fDay(x.d)}: verifica"></i>`;
      const items = x.items.filter(it => it.tid === test.id), m = sum(items, it => it.min);
      if (!m) return `<i class="z" title="${fDay(x.d)}${x.off ? ': libero' : !x.study ? ': cuscinetto' : ''}"></i>`;
      const ph = items.some(it => it.phase === 'rush') ? 'x' : items.every(it => it.phase === 'review') ? 'r' : '';
      return `<i class="${ph}" style="height:${Math.max(8, Math.round(100 * m / max))}%" title="${fDay(x.d)}: ${fMin(m)}"></i>`;
    }).join('');
    return `<div class="st-spark">${bars}</div><div class="st-pl small dim"><span>${T === days[0].d ? 'oggi' : fDay(days[0].d)}</span><span>${days.length < EN.diff(T, test.date) + 1 ? '… ' : ''}📝 ${fDay(test.date)}</span></div>`;
  }
  function sumHTML(c) {
    const T = today(), sim = simulate();
    if (!sim) return {q: 'Qui i conti non mi tornano.', body: `<div class="card"><b>Non riesco a fare il piano.</b><p class="small muted">${!D.id && roomLeft() <= 0 ? roomMsg() : 'Controlla la data e gli argomenti.'}</p></div>`, foot: ''};
    const {p, s, test} = sim, cfg = S.st.cfg, b = DA.bossFor(test), left = s.left;
    const win = p.days.filter(x => x.d <= s.readyBy), cush = win.filter(x => !x.study && !x.off).length, offs = win.filter(x => x.off).length;
    const rush = s.status === 'rush', before = p.days.filter(x => x.d < test.date && x.study).length;
    const others = p.tests.filter(x => ACTIVE[x.status] && x.id !== test.id && x.status !== 'today').length;
    const maxDay = Math.max(0, ...p.days.map(x => x.q)), over = Math.max(s.overload, p.overload);
    let msg, cls = 'ok', opts = '';
    if (!ACTIVE[s.status]) { cls = ''; msg = 'Questa verifica è già passata: qui cambi solo i suoi dati.'; }
    else if (left <= 0) msg = '🏆 <b>Lavoro già finito.</b> Restano solo i giorni di ripasso.';
    else if (rush) {
      cls = 'bad';
      msg = `⏰ <b>È tardi per spalmare.</b> La verifica è ${inDays(s.daysTo)}: ${fMin(left)} finiscono tutti nei giorni prima. Si può fare, ma è una corsa.${over > 0 ? ` E ${fMin(over)} sforano il tetto di ${fMin(cfg.cap)} al giorno.` : ''}`;
      opts = `<ul class="st-ul small"><li>Parti dagli argomenti che sai meno.</li><li>Quello che sai già toglilo, o chiudilo con «Capito».</li><li>La prossima mettila qui appena te la dicono.</li></ul>`;
    } else if (over > 0) {
      cls = 'bad';
      msg = `⚠️ <b>Non ci sta tutto.</b> Con il tetto di ${fMin(cfg.cap)} al giorno restano fuori ${fMin(over)}. Meglio saperlo adesso.`;
      const nc = Math.min(240, cfg.cap + 30);
      opts = `<div class="st-btns" style="margin-top:8px">${cfg.cap < 240 ? `<button class="btn ghost" data-act="st-wz-cap" data-v="${nc}">Tetto a ${fMin(nc)}</button>` : ''}<button class="btn ghost" data-act="st-wz-hub">Tolgo qualcosa</button></div>`;
    } else if (s.status === 'behind') { cls = 'warn'; msg = `⚠️ Rispetto a prima sei indietro di ${fMin(s.behind)}: <b>${fMin(s.quota)}</b> al giorno.`; }
    else if (s.quota >= 60) { cls = 'warn'; msg = `💪 <b>${fMin(s.quota)} al giorno.</b> Tanto, ma ci sta: un blocco alla volta.`; }
    else msg = `✅ <b>Ci sta comodo.</b> ${fMin(s.quota)} al giorno${cfg.buffer ? ` e sei pronto ${plural(cfg.buffer, 'giorno', 'giorni')} prima` : ''}.`;
    const body = `<div class="card st-rev"><div class="row"><div class="st-mon bob">${b.e}</div><div class="grow"><div class="label">Il tuo avversario</div><b class="st-bn">${esc(b.n)}</b><div class="small muted">❤️ ${left} punti vita · 1 = 1 minuto di lavoro</div></div></div>
      <div class="st-sum"><div class="stat"><b>${fMin(left)}</b><span>${D.id && left !== s.total ? 'ANCORA DA FARE' : 'LAVORO IN TUTTO'}</span></div><div class="stat"><b>${rush ? before : s.availLeft}</b><span>GIORNI BUONI</span></div><div class="stat"><b>${left > 0 ? fMin(s.quota) : '0 min'}</b><span>AL GIORNO</span></div><div class="stat"><b>${rush ? '—' : fDay(s.readyBy)}</b><span>${rush ? 'NIENTE ANTICIPO' : 'PRONTO ENTRO'}</span></div></div>
      ${sparkHTML(p, test, T)}
      <div class="small muted" style="margin-top:8px">${rush ? '' : `☂️ ${plural(cush, 'giorno cuscinetto', 'giorni cuscinetto')}${offs ? ` · 🏖️ ${plural(offs, 'libero', 'liberi')}` : ''} · `}🔁 ${rush ? 'niente giorni di solo ripasso: si studia fino al giorno prima' : cfg.buffer ? `${plural(cfg.buffer, 'giorno', 'giorni')} di ripasso da ${fMin(s.reviewMin)}` : 'nessun giorno di ripasso'}${test.sheet ? ' · 📄 formulario' : ''}</div>
      <div class="st-note ${cls} small">${msg}${opts}</div>
      ${others ? `<div class="small muted" style="margin-top:8px">Con ${others === 1 ? "l'altra verifica" : `le altre ${others} verifiche`}: oggi <b>${fMin(p.today.q)}</b> in tutto, al massimo ${fMin(maxDay)} in un giorno.</div>` : ''}</div>`;
    return {q: D.id ? 'Piano rifatto. Questi sono i numeri.' : 'Ecco il piano. Numeri onesti, niente sconti.', body,
      foot: `<button class="btn big gold" id="st-next" data-act="st-wz-next">${D.id ? '💾 Salva le modifiche' : '⚔️ Affronta il boss'}</button>`};
  }
  function vNew(c) {
    if (!D) D = newDraft();
    const T = today(), d = D, sub = d.subj ? subjOf(d.subj) : null;
    const PCT = {subj: 6, date: 22, tn: 36, tk: 44, tc: 52, tt: 60, te: 68, hub: 78, sheet: 90, sum: 100, qdate: 40, qsize: 75};
    const next = (label, okKey, dis) => `<button class="btn big" id="st-next" data-act="st-wz-next" ${okKey ? `data-stok="${okKey}"` : ''} ${dis ? 'disabled' : ''}>${label || 'Avanti ▶'}</button>`;
    const big = (act, v, on, title, small) => `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${!!on}"><span class="grow">${title}${small ? `<small class="st-sm">${small}</small>` : ''}</span></button>`;
    const tn = esc(d.t.n.trim() || `Argomento ${d.ti >= 0 ? d.ti + 1 : d.topics.length + 1}`);
    let q = '', body = '', foot = '';
    switch (d.step) {
      case 'qdate': {
        // 4.0 · verifica veloce: un tocco sul giorno
        q = 'Quando è?';
        const ds = []; for (let n = 1; n <= 14; n++) ds.push(EN.addD(T, n));
        body = `<div class="st-qd">${ds.map(k => `<button class="chip ${d.date === k ? 'on' : ''}" data-act="st-q-date" data-v="${k}" aria-pressed="${d.date === k}"><b>${WD[EN.dow(k)]} ${+k.slice(8, 10)}</b><small>${EN.diff(T, k) === 1 ? 'domani' : MO[+k.slice(5, 7) - 1]}</small></button>`).join('')}</div>
          <h3>Più avanti?</h3><input class="txt st-date" type="date" id="st-date" data-stf="date" min="${EN.addD(T, 1)}" max="${EN.addD(T, 400)}" value="${esc(d.date)}" aria-label="Data della verifica">
          <div class="st-live" data-stl="date">${LIVE.date()}</div>`;
        foot = next('Avanti ▶', 'date', !OKF.date());
        break;
      }
      case 'qsize':
        q = 'Quanto è grossa?';
        body = `<div class="chips col">${SIZES.map(([k, e, n, x]) => big('st-q-size', k, false, `${e} ${n}`, x)).join('')}</div>
          <p class="small dim">Non serve essere precisi: dopo i primi blocchi il piano si regola sul tuo tempo vero.</p>
          <button class="link" data-act="st-q-detail">Voglio dividerla per argomenti</button>`;
        break;
      case 'date': {
        q = 'Quando è?';
        const quick = [7, 14, 21].map(n => { const k = EN.addD(T, n); return `<button class="chip ${d.date === k ? 'on' : ''}" data-act="st-wz-date" data-v="${k}">${n === 7 ? 'Fra 1 settimana' : `Fra ${n / 7} settimane`}</button>`; }).join('');
        body = `<input class="txt st-date" type="date" id="st-date" data-stf="date" min="${EN.addD(T, d.id ? -400 : 1)}" max="${EN.addD(T, 400)}" value="${esc(d.date)}" aria-label="Data della verifica">
          <div class="st-live" data-stl="date">${LIVE.date()}</div><div class="chips">${quick}</div>
          <h3>Titolo, se vuoi</h3><input class="txt" data-stf="name" maxlength="60" placeholder="Per esempio: Aree e Pitagora" value="${esc(d.name)}" autocomplete="off" aria-label="Titolo della verifica">`;
        foot = next('Avanti ▶', 'date', !OKF.date());
        break;
      }
      case 'tn':
        q = d.ti >= 0 ? 'Come si chiama questo argomento?' : d.topics.length ? `Argomento n. ${d.topics.length + 1}: come si chiama?` : 'Primo argomento: come si chiama?';
        body = `<input class="txt" id="st-tn" data-stf="tn" maxlength="60" placeholder="Per esempio: Teorema di Pitagora" value="${esc(d.t.n)}" autocomplete="off" aria-label="Nome dell'argomento"><p class="small dim">Un argomento alla volta: così sai sempre cosa stai colpendo.</p>`;
        foot = next();
        break;
      case 'tk':
        q = `«${tn}»: cosa c'è da fare?`;
        body = `<div class="chips col">${big('st-wz-kind', 'both', d.t.kind === 'both' && d.ti >= 0, '📖✏️ Capire e allenarsi', 'teoria e poi esercizi')}${big('st-wz-kind', 'th', d.t.kind === 'th' && d.ti >= 0, '📖 Solo studiare', 'cose da capire o da sapere')}${big('st-wz-kind', 'ex', d.t.kind === 'ex' && d.ti >= 0, '✏️ Solo esercizi', 'la teoria la so, mi serve la mano')}</div>`;
        break;
      case 'tc':
        q = `«${tn}»: quanto lo sai già?`;
        body = `<div class="chips col">${big('st-wz-conf', 1, d.t.conf === 1 && d.ti >= 0, '🥶 Da zero', 'mai visto, o non ci ho capito niente')}${big('st-wz-conf', 2, d.t.conf === 2 && d.ti >= 0, '😐 Così così', "qualcosa c'è, ma traballa")}${big('st-wz-conf', 3, d.t.conf === 3 && d.ti >= 0, '😎 Quasi', 'mi manca poco')}</div><p class="small dim">Quelli che sai meno il piano li mette per primi.</p>`;
        break;
      case 'tt':
        q = `«${tn}»: quanti minuti di teoria ti servono?`;
        body = `${setChips('wth', [15, 30, 45, 60, 90], d.t.thMin, v => v + '′')}${stepper('wth', fMin(d.t.thMin))}<p class="small dim center">${d.ti < 0 && d.t.thMin === SUG.th[d.t.conf] ? `Ti propongo ${fMin(d.t.thMin)} perché hai detto «${SUG.say[d.t.conf]}». Cambialo se vuoi: ` : 'Leggere, capire, saperla ridire a libro chiuso. Meglio largo: '}se la capisci prima, la chiudi con «Capito».</p>`;
        foot = next();
        break;
      case 'te':
        q = `«${tn}»: quanti esercizi vuoi fare?`;
        body = `${stepper('wexn', String(d.t.exN))}${setChips('wexn', [5, 10, 15, 20], d.t.exN)}
          <h3 class="center">Quanti minuti l'uno, più o meno?</h3>${setChips('wexm', [3, 5, 8, 10, 15], d.t.exMin, v => v + '′')}${stepper('wexm', d.t.exMin + ' min')}
          <div class="st-live center" data-stl="ex">${LIVE.ex()}</div><p class="small dim center">Non lo sai? Lascia così: dopo 3 esercizi il piano si regola sul tuo tempo vero.</p>`;
        foot = next();
        break;
      case 'hub':
        q = d.topics.length ? 'Ci sono altri argomenti?' : 'Quali argomenti ci sono?';
        body = `<div class="card st-hub">${d.topics.map((a, i) => `<div class="st-trow"><div class="grow"><b>${esc(a.n)}</b><div class="small muted">${topicSum(a)}</div></div><button class="st-ib" data-act="st-wz-tedit" data-i="${i}" aria-label="Modifica ${esc(a.n)}">✏️</button><button class="st-ib" data-act="st-wz-tdel" data-i="${i}" aria-label="Togli ${esc(a.n)}">🗑️</button></div>`).join('') || '<p class="muted small">Ancora nessuno.</p>'}
          <div class="st-tot">In tutto: <b>${fMin(sum(d.topics, topicMin))}</b> di lavoro</div></div>
          ${d.topics.length < 12 ? `<button class="btn ghost" data-act="st-wz-add">＋ Un altro argomento</button>` : '<p class="small dim center">12 argomenti: il massimo per una verifica.</p>'}`;
        foot = next('Basta così ▶', 'hub', !OKF.hub());
        break;
      case 'sheet':
        q = 'Alla verifica si può usare il formulario?';
        body = `<div class="chips col">${big('st-wz-sheet', 1, d.sheet && !!d.id, '📄 Sì, si può', 'lo preparo io e lo uso già negli esercizi')}${big('st-wz-sheet', 0, !d.sheet && !!d.id, '🚫 No', 'tutto a memoria')}</div><p class="small dim">Se non lo sai ancora, metti No: lo cambi dopo.</p>`;
        break;
      case 'sum': { const s = sumHTML(c); q = s.q; body = s.body; foot = s.foot; break; }
      default:
        d.step = 'subj';
        q = d.id ? 'Che materia è?' : `Che verifica arriva, ${pname()}?`;
        if (d.quick && EN.isDay(d.date)) q += ` <span class="small muted">(${fDay(d.date)})</span>`;
        body = `<div class="st-subj">${DA.SUBJECTS.map(s => `<button class="chip ${d.subj === s.k ? 'on' : ''}" data-act="st-wz-subj" data-v="${s.k}" aria-pressed="${d.subj === s.k}">${s.e} ${esc(s.n)}</button>`).join('')}</div>`;
    }
    return `<div class="wz-top"><button class="wz-back" data-act="st-wz-back" aria-label="Indietro">←</button><div class="bar"><i style="width:${PCT[d.step] || 6}%"></i></div><button class="iconbtn" data-act="st-wz-quit" aria-label="Chiudi">✕</button></div>
      ${sub && d.step !== 'subj' ? `<span class="lesson">${sub.e} ${esc(d.name.trim() || sub.n)}${EN.isDay(d.date) && d.step !== 'date' ? ` · ${fDay(d.date)}` : ''}</span>` : ''}
      ${sayHTML(c, q)}${body}<div class="wz-foot">${foot}</div>`;
  }
  function wzStep(step) { D.step = step; render(); scrollTo(0, 0); if (step === 'tn') { const el = $id('st-tn'); if (el && !el.value) try { el.focus({preventScroll: true}); } catch (e) {} } }
  function commitTopic() {
    const a = Object.assign({}, D.t); a.n = (a.n || '').trim().slice(0, 60) || `Argomento ${D.ti >= 0 ? D.ti + 1 : D.topics.length + 1}`;
    if (D.ti >= 0 && D.topics[D.ti]) D.topics[D.ti] = a; else if (D.topics.length < 12) D.topics.push(a);
    D.t = newTopic(); D.ti = -1;
  }
  const WZ_BACK = {date: 'subj', tk: 'tn', tc: 'tk', tt: 'tc', hub: 'date', sheet: 'hub', sum: 'sheet', qdate: 'subj', qsize: 'qdate'};

  /* ---------- scheda della verifica ---------- */
  function statusText(s, cfg) {
    if (s.overload > 0 && s.status !== 'rush') return `${fMin(s.overload)} non entrano nel tetto di ${fMin(cfg.cap)} al giorno.`;
    switch (s.status) {
      case 'ready': return s.total > 0 ? 'Boss a terra. Da qui solo ripasso, con calma.' : 'Nessun argomento: aggiungili con Modifica.';
      case 'review': return `Giorni di ripasso: ${fMin(s.reviewMin)} al giorno, niente di nuovo.`;
      case 'today': return s.total > 0 && s.left <= 0 ? "È oggi. Il lavoro l'hai già fatto: in bocca al lupo." : s.pct >= 80 ? 'È oggi. In bocca al lupo.' : "È oggi. In bocca al lupo: parti dall'esercizio che ti viene meglio.";
      case 'rush': return `Non c'è più tempo per spalmare: ${fMin(s.left)} nei giorni prima della verifica. Parti da quello che sai meno.`;
      case 'behind': return `Indietro di ${fMin(s.behind)}: la quota è passata da ${s.base.q} a ${fMin(s.quota)} al giorno. Un blocco oggi e si ferma lì.`;
      case 'wait': return 'Verifica fatta. Manca solo la nota.';
      case 'done': return 'Verifica chiusa.';
      default: return `In regola: ${fMin(s.quota)} al giorno, poi ${plural(cfg.buffer, 'giorno', 'giorni')} di solo ripasso.`;
    }
  }
  function insight(pct, grade) {
    if (pct >= 85 && grade >= 5) return 'Piano fatto e nota alta: questo ritmo funziona. La prossima volta rifallo uguale.';
    if (pct >= 85 && grade >= 4) return 'Il lavoro c\'era. Per salire ancora: più esercizi mescolati e una mini verifica nei giorni di ripasso.';
    if (pct >= 85) return 'Il lavoro l\'hai fatto e la nota non lo dice. Capita. Guarda dove sono andati via i punti: un argomento non capito o errori di distrazione? Lì vanno i minuti la prossima volta.';
    if (pct < 60 && grade >= 4.5) return `Nota buona con il ${pct} % del piano: questi argomenti li sapevi meglio di quanto pensavi. La prossima volta segna «Quasi» su quelli che sai già: il piano parte più corto, senza togliere quelli nuovi.`;
    if (pct < 60) return `Piano fatto al ${pct} %: mancava un pezzo di lavoro. La prossima volta parti dal primo giorno, anche con blocchi corti.`;
    return `Piano fatto al ${pct} %. Più piano fai, più la nota è nelle tue mani.`;
  }
  function exInsight(t) {
    const tot = EN.totals(S.st, t), off = tot.topics.filter(a => a.exN > 0).map(a => ({a, raw: (t.topics.find(x => x.id === a.id) || {}).exMin || 0})).filter(x => x.raw > 0 && x.a.perEx !== x.raw);
    if (!off.length) return '';
    const x = off[0];
    return `Stima per la prossima: in «${esc(x.a.n)}» un esercizio ti ha preso circa ${x.a.perEx} min, ne avevi messi ${x.raw}. ${x.a.perEx > x.raw ? 'Conta più largo.' : 'Puoi contare più stretto.'}`;
  }
  function gradeForm(t) {
    if (!G || G.id !== t.id) G = {id: t.id, v: t.grade != null ? t.grade : 4.5, feel: t.feel || null, note: t.note || ''};
    return `<div class="card st-grade"><b>📝 Com'è andata?</b><p class="small muted">La nota serve a stimare meglio la prossima, non a prendere gemme: +10 💎 qualunque sia.</p>
      <h3 class="center">La nota</h3>${stepper('grade', gTxt(G.v))}${setChips('grade', [3, 4, 4.5, 5, 5.5, 6], G.v, gTxt)}
      <h3>Come ti sentivi durante la verifica?</h3><div class="moods">${FEEL.map(f => `<button class="${G.feel === f[0] ? 'on' : ''}" data-act="st-feel" data-v="${f[0]}" aria-label="${f[2]}" aria-pressed="${G.feel === f[0]}">${f[1]}<span>${f[2]}</span></button>`).join('')}</div>
      <h3>Una riga, se vuoi</h3><input class="txt" data-stf="note" maxlength="200" placeholder="Cosa rifaresti uguale? Cosa cambieresti?" value="${esc(G.note)}" autocomplete="off" aria-label="Una riga sulla verifica">
      <button class="btn gold" data-act="st-grade-ok" data-id="${esc(t.id)}">Salva la nota <small>${t.grade == null ? '+10 💎' : ''}</small></button>
      ${t.grade != null ? `<button class="link" data-act="st-go" data-scr="test" data-id="${esc(t.id)}">Lascia stare</button>` : ''}</div>`;
  }
  function vTest(c) {
    const T = today(), st = S.st, t = findT(nav.id);
    const p = t ? planOf(st, T) : null, s = p ? p.tests.find(x => x.id === t.id) : null;
    if (!t || !s) { nav = {scr: 'home'}; return vHome(c, false); }          // anche: sto segnando ieri e questa verifica è nata dopo
    const r = rew(c, T), tot = EN.totals(st, t), sub = subjOf(t.subj), b = DA.bossFor(t), tg = TAG[s.status] || TAG.ontrack, dead = tot.left <= 0, y = yest();
    const canAct = !!ACTIVE[s.status] && s.status !== 'today';
    let out = `${topbar(c)}${backHTML('Studio', s.status === 'done' ? 'hist' : 'home')}`;
    out += `<div class="card st-hero" data-boss="${esc(t.id)}"><div class="center"><div class="st-mon big ${dead || s.status === 'done' ? 'dead' : 'bob'}">${b.e}</div><div class="label">${sub.e} ${esc(sub.n)} · ${fDay(t.date)}</div><h2>${esc(tTitle(t))}</h2><div class="small muted">contro <b>${esc(b.n)}</b> · ${inDays(s.daysTo)}${t.sheet ? '<br>📄 formulario permesso' : ''}</div></div>
      <div class="st-hpw">${hpHTML(s.left, s.total)}<span class="st-hpt">❤️ ${s.left} / ${s.total}</span></div>
      <div class="st-foot"><span class="st-tag ${tg[1]}">${tg[0]}</span><span class="small muted">${statusText(s, st.cfg)}</span></div>
      ${canAct && s.status !== 'ready' && s.status !== 'review' ? `<div class="stats st-3"><div class="stat"><b>${fMin(s.quota)}</b><span>AL GIORNO</span></div><div class="stat"><b>${s.availLeft}</b><span>GIORNI BUONI</span></div><div class="stat"><b>${s.status === 'rush' ? '—' : `${+s.readyBy.slice(8, 10)} ${MO[+s.readyBy.slice(5, 7) - 1]}`}</b><span>PRONTO ENTRO</span></div></div>` : ''}</div>`;

    if (s.status === 'today' && !nav.grade) {
      const k = ((dayIx(T) % 2) + 2) % 2, tips = [DA.TESTDAY[k], DA.TESTDAY[2 + k], DA.TESTDAY[4 + k]].filter(Boolean);
      out += `<div class="card st-td"><b>🍀 In bocca al lupo, ${pname()}!</b><ol class="st-tips">${tips.map(x => `<li>${esc(x)}</li>`).join('')}</ol><button class="btn ghost" data-act="st-open" data-id="${esc(t.id)}" data-grade="1">L'ho già fatta: racconto com'è andata</button></div>`;
    }
    if (s.status === 'wait' || (nav.grade && (s.status === 'today' || s.status === 'done'))) out += gradeForm(t);
    else if (s.status === 'done') {
      out += `<div class="card center"><div class="label">Nota${t.gradeD ? ` · ${fDay(t.gradeD)}` : ''}</div><div class="st-num">${gTxt(t.grade)}</div>
        <div class="st-cmp"><div class="stat"><b>${s.pct} %</b><span>PIANO FATTO</span></div><div class="st-arrow">→</div><div class="stat"><b>${gTxt(t.grade)}</b><span>NOTA</span></div></div>
        <p class="small">${insight(s.pct, t.grade)}</p>${exInsight(t) ? `<p class="small muted">${exInsight(t)}</p>` : ''}
        ${t.feel ? `<div class="small muted">In verifica ti sentivi: ${(FEEL.find(f => f[0] === t.feel) || FEEL[2])[1]} ${(FEEL.find(f => f[0] === t.feel) || FEEL[2])[2].toLowerCase()}</div>` : ''}
        ${t.note ? `<div class="say small" style="text-align:left">«${esc(t.note)}»</div>` : ''}
        ${y ? '' : `<button class="link" data-act="st-open" data-id="${esc(t.id)}" data-grade="1">✏️ Cambia la nota</button>`}</div>`;
    }

    // argomenti
    const rows = tot.topics.map(a => {
      const raw = t.topics.find(x => x.id === a.id) || {}, id = `data-tid="${esc(t.id)}" data-aid="${esc(a.id)}"`;
      const thp = a.thMin ? Math.round(100 * (a.thMin - a.thLeft) / a.thMin) : 0, exp = a.exN ? Math.round(100 * a.exNDone / a.exN) : 0;
      let h = `<div class="st-top"><div class="row"><span class="xe">${a.closed ? '✅' : CONF[a.conf] || '😐'}</span><div class="grow"><b>${esc(a.n)}</b><div class="small muted">${a.closed ? 'Chiuso' : canAct ? `ancora ${fMin(a.left)}` : `fatti ${fMin(a.total - a.left)} su ${fMin(a.total)}`}</div></div></div>`;
      if (a.kind !== 'ex') h += `<div class="st-pl small"><span>📖 Teoria</span><span>${raw.thFin ? 'capita ✓' : `${a.thDone} / ${a.thMin} min`}</span></div><div class="hbar"><i style="width:${thp}%"></i></div>`;
      if (a.kind !== 'th') h += `<div class="st-pl small"><span>✏️ Esercizi${a.perEx !== raw.exMin ? ` · ${a.perEx} min l'uno` : ''}</span><span>${a.exNDone} / ${a.exN}</span></div><div class="hbar ex"><i style="width:${exp}%"></i></div>`;
      if (canAct && !a.closed) h += `<div class="st-btns">${y ? '' : `<button class="btn ghost" data-act="st-tplay" ${id}>▶ Timer</button>`}<button class="btn ghost" data-act="st-more" ${id}>✔ Segna</button>${a.kind !== 'ex' && a.thLeft > 0 ? `<button class="btn ghost" data-act="st-fin" ${id} data-v="1">💡 Capito</button>` : ''}</div>`;
      if (canAct && raw.thFin && a.thDone < a.thMin) h += `<button class="link" data-act="st-fin" ${id} data-v="0">Non l'avevo capita: riapro la teoria</button>`;
      return h + `</div>`;
    }).join('');
    out += `<div class="card"><b>🎯 Argomenti</b>${rows || '<p class="small muted">Nessun argomento: aggiungili con Modifica.</p>'}
      ${canAct && (s.status === 'review' || s.status === 'ready') ? `<button class="btn ghost" data-act="st-more" data-tid="${esc(t.id)}" data-k="rev">🔁 Segna un ripasso</button>` : ''}</div>`;

    if (canAct) out += `<div class="card st-mapc"><b>🗓️ Il piano di questa verifica</b>${mapHTML(p, r, T, t.id)}${mapLegend()}</div>`;

    const lg = (st.log || []).filter(x => x.tid === t.id);
    if (lg.length) {
      const mins = sum(lg, x => x.m);
      out += `<div class="card"><details ${lg.length <= 4 ? 'open' : ''}><summary>📋 Registro · ${plural(lg.length, 'blocco', 'blocchi')} · ${fMin(mins)}</summary>${lg.slice(-40).reverse().map(x => {
        const a = t.topics.find(q => q.id === x.aid), kd = KIND[x.k] || KIND.th;
        return `<div class="diary small"><span class="dim">${fDay(x.d)}</span> · ${kd.e} ${esc(a ? a.n : kd.n)} · <b>${x.k === 'ex' ? plural(x.n, 'esercizio', 'esercizi') : fMin(x.m)}</b>${x.k === 'ex' ? ` <span class="dim">(${fMin(x.m)})</span>` : ''}${x.five ? ' · ⏱️ partito da 5′' : ''}</div>`;
      }).join('')}</details>${lg.some(x => x.d === T) ? `<button class="link" data-act="st-undo">Annulla l'ultima cosa segnata ${y ? 'ieri' : 'oggi'}</button>` : ''}</div>`;
    }
    if (!y) out += `<div class="st-grid2">${s.status !== 'done' ? `<button class="btn ghost" data-act="st-edit" data-id="${esc(t.id)}">✏️ Modifica</button>` : ''}<button class="btn ghost" data-act="st-share" data-id="${esc(t.id)}">📤 Passa il codice</button></div><button class="link" data-act="st-del" data-id="${esc(t.id)}" style="color:var(--bad)">Cancella questa verifica</button>`;
    return out;
  }

  /* ---------- storico, consigli, impostazioni, importa ---------- */
  function vHist(c) {
    const T = today(), st = S.st, p = EN.plan(st, T), r = rew(c, T);
    const past = p.tests.filter(s => s.status === 'done' || s.status === 'wait').sort((a, b) => a.test.date < b.test.date ? 1 : -1);
    const graded = past.filter(s => s.status === 'done');
    let out = `${topbar(c)}${backHTML()}<h2>📜 Storico e note</h2>
      <div class="stats"><div class="stat"><b>${fMin(r.minutes).replace(' min', '′')}</b><span>STUDIATI</span></div><div class="stat"><b>${r.exercises}</b><span>ESERCIZI</span></div><div class="stat"><b>${r.fullDays}</b><span>GIORNI PIENI</span></div><div class="stat"><b>${r.bosses}</b><span>BOSS</span></div><div class="stat"><b>${r.early}</b><span>IN ANTICIPO</span></div><div class="stat"><b>${r.best}</b><span>RECORD SERIE</span></div></div>`;
    if (!past.length) return out + `<div class="card center"><div class="big-emoji" style="font-size:64px">📭</div><p class="muted">Ancora nessuna verifica alle spalle. Qui troverai le note, ognuna accanto a quanto piano avevi fatto.</p></div>`;
    if (graded.length >= 2) {
      const hi = graded.filter(s => s.pct >= 80), lo = graded.filter(s => s.pct < 80), avg = a => gTxt(Math.round(4 * sum(a, s => s.test.grade) / a.length) / 4);
      out += `<div class="card"><b>🔎 Cosa dicono i numeri</b><p class="small">${hi.length && lo.length ? `Quando hai fatto almeno l'80 % del piano la media è <b>${avg(hi)}</b>; sotto l'80 % è <b>${avg(lo)}</b>.` : hi.length ? `Hai sempre fatto almeno l'80 % del piano: media <b>${avg(hi)}</b>.` : `Finora il piano è rimasto sotto l'80 %: media <b>${avg(lo)}</b>. Prova a chiuderne uno intero e guarda cosa cambia.`}</p></div>`;
    }
    out += `<div class="card st-hl">${past.map(s => {
      const t = s.test, sub = subjOf(t.subj);
      return `<button class="st-hrow" data-act="st-open" data-id="${esc(t.id)}" ${s.status === 'wait' ? 'data-grade="1"' : ''}><span class="xe">${sub.e}</span><span class="grow"><b>${esc(tTitle(t))}</b><small>${fDay(t.date)} · piano ${s.pct} %</small><span class="hbar"><i style="width:${s.pct}%"></i></span></span><span class="st-g ${s.status === 'wait' ? 'q' : ''}">${s.status === 'wait' ? '?' : gTxt(t.grade)}</span></button>`;
    }).join('')}</div><p class="small dim center">Qui si premia il lavoro, non la nota. La nota serve a tarare il prossimo piano.</p>`;
    return out;
  }
  function vTips(c) {
    let out = `${topbar(c)}${backHTML()}<h2>📘 Come si studia</h2><p class="muted small">Poche cose, tutte provate. Ognuna con il suo perché.</p>`;
    DA.SECTIONS.forEach((sec, i) => {
      const tips = DA.TIPS.filter(x => x.sec === sec.k); if (!tips.length) return;
      out += `<div class="card st-sec"><details ${i === 0 ? 'open' : ''}><summary>${sec.e} ${esc(sec.n)} <span class="dim small">· ${tips.length}</span></summary>${tips.map(x => `<div class="st-tip"><div class="row"><span class="xe">${x.e}</span><b class="grow">${esc(x.t)}</b></div><p class="small">${esc(x.x)}</p><p class="small st-why">💡 ${esc(x.why)}</p></div>`).join('')}</details></div>`;
    });
    return out + `<button class="btn ghost" data-act="st-l-redo">🎬 Rivedi le 3 lezioni</button>`;
  }
  function vCfg(c) {
    const T = today(), cfg = S.st.cfg, on = cfg.days.filter(Boolean).length;
    const offs = cfg.off.filter(d => d >= T);
    if (hasWeek()) return `${topbar(c)}${backHTML()}<h2>⚙️ Impostazioni dello studio</h2>
      <div class="card"><b>⏱️ La mia settimana</b><p class="small muted">${S.st.cfg.wk.map((v, i) => `${WD[i]} ${v ? fS(v) : '☂️'}`).join(' · ')}</p><button class="btn ghost" data-act="st-go" data-scr="week">Cambia la settimana</button></div>
      <div class="card"><b>Durata di un blocco</b><p class="small muted">Un blocco è una tirata sola, poi 5 minuti di pausa vera.</p><div class="chips st-ctr">${[15, 20, 25, 30, 45].map(v => `<button class="chip ${cfg.block === v ? 'on' : ''}" data-act="st-cfg-set" data-k="block" data-v="${v}">${v}′</button>`).join('')}</div></div>
      <div class="card"><b>Giorni di solo ripasso prima della verifica</b><p class="small muted">Di serie 2: finisci prima, arrivi tranquillo.</p><div class="chips st-ctr">${[0, 1, 2, 3].map(v => `<button class="chip ${cfg.buffer === v ? 'on' : ''}" data-act="st-cfg-set" data-k="buffer" data-v="${v}">${v}</button>`).join('')}</div></div>
      <div class="card"><b>🏖️ Giorni liberi</b><p class="small muted">Vacanze, gare, gite: il piano li salta. Un giorno solo lo segni anche dal Calendario.</p>
        ${offs.length ? `<div class="chips">${offs.slice(0, 40).map(d => `<button class="chip" data-act="st-off" data-d="${d}" aria-label="Togli ${fDay(d)}">${fDay(d)} ✕</button>`).join('')}</div>` : '<div class="small dim">Nessun giorno libero segnato.</div>'}
        <div class="st-two"><label class="small muted">Dal<input class="txt st-date" type="date" data-stf="offa" min="${T}" max="${EN.addD(T, 400)}" value="${esc(OFF.a)}"></label><label class="small muted">Al (se serve)<input class="txt st-date" type="date" data-stf="offb" min="${T}" max="${EN.addD(T, 400)}" value="${esc(OFF.b)}"></label></div>
        <button class="btn ghost" data-act="st-off-add">＋ Segna liberi</button></div>
      <div class="card"><b>🏠 Pagina iniziale dello Studio</b><p class="small muted">«Oggi» fa una domanda e dà una cosa alla volta. «Tutto il piano» mostra subito boss, serie e mappa.</p><div class="chips st-ctr"><button class="chip ${classic() ? '' : 'on'}" data-act="st-home-set" data-v="today">☀️ Oggi</button><button class="chip ${classic() ? 'on' : ''}" data-act="st-home-set" data-v="full">📊 Tutto il piano</button></div></div>
      <button class="btn ghost" data-act="st-l-redo">🎬 Rivedi le 3 lezioni</button>`;
    return `${topbar(c)}${backHTML()}<h2>⚙️ Giorni e tetto</h2>
      <div class="card"><b>I giorni in cui studi</b><div class="st-days">${WD.map((d, i) => `<button class="chip ${cfg.days[i] ? 'on' : ''}" data-act="st-cfg-day" data-i="${i}" aria-pressed="${!!cfg.days[i]}">${d}</button>`).join('')}</div>
        <div class="st-note small">${on === 7 ? '⚠️ <b>7 su 7</b>: nessun cuscinetto. Se salti un giorno non hai dove recuperarlo.' : `☂️ ${plural(7 - on, 'giorno cuscinetto', 'giorni cuscinetto')} a settimana: riposo se sei in pari, recupero se hai saltato.`}</div></div>
      <div class="card"><b>Tetto al giorno</b><p class="small muted">Il massimo che il piano ti può chiedere in un giorno, con tutte le verifiche insieme.</p>${stepper('cap', fMin(cfg.cap))}</div>
      <div class="card"><b>Durata di un blocco</b><p class="small muted">Un blocco è una tirata sola, poi 5 minuti di pausa vera.</p><div class="chips st-ctr">${[15, 20, 25, 30, 45].map(v => `<button class="chip ${cfg.block === v ? 'on' : ''}" data-act="st-cfg-set" data-k="block" data-v="${v}">${v}′</button>`).join('')}</div></div>
      <div class="card"><b>Giorni di solo ripasso prima della verifica</b><p class="small muted">Di serie 2: finisci prima, arrivi tranquillo.</p><div class="chips st-ctr">${[0, 1, 2, 3].map(v => `<button class="chip ${cfg.buffer === v ? 'on' : ''}" data-act="st-cfg-set" data-k="buffer" data-v="${v}">${v}</button>`).join('')}</div></div>
      <div class="card"><b>🏖️ Giorni liberi</b><p class="small muted">Vacanze, gare, gite: il piano li salta. Un giorno solo lo segni anche toccandolo sulla mappa.</p>
        ${offs.length ? `<div class="chips">${offs.slice(0, 40).map(d => `<button class="chip" data-act="st-off" data-d="${d}" aria-label="Togli ${fDay(d)}">${fDay(d)} ✕</button>`).join('')}</div>${offs.length > 40 ? `<div class="small dim">… e altri ${offs.length - 40}</div>` : ''}` : '<div class="small dim">Nessun giorno libero segnato.</div>'}
        <div class="st-two"><label class="small muted">Dal<input class="txt st-date" type="date" data-stf="offa" min="${T}" max="${EN.addD(T, 400)}" value="${esc(OFF.a)}"></label><label class="small muted">Al (se serve)<input class="txt st-date" type="date" data-stf="offb" min="${T}" max="${EN.addD(T, 400)}" value="${esc(OFF.b)}"></label></div>
        <button class="btn ghost" data-act="st-off-add">＋ Segna liberi</button></div>
      <div class="card"><b>⏱️ La mia settimana</b><p class="small muted">Quanto tempo hai al massimo ogni giorno, compiti compresi.</p><button class="btn ghost" data-act="st-go" data-scr="week">Metti la settimana</button></div>
      <div class="card"><b>🏠 Pagina iniziale dello Studio</b><p class="small muted">«Oggi» fa una domanda e dà una cosa alla volta. «Tutto il piano» mostra subito boss, serie e mappa.</p><div class="chips st-ctr"><button class="chip ${classic() ? '' : 'on'}" data-act="st-home-set" data-v="today">☀️ Oggi</button><button class="chip ${classic() ? 'on' : ''}" data-act="st-home-set" data-v="full">📊 Tutto il piano</button></div></div>
      <button class="btn ghost" data-act="st-l-redo">🎬 Rivedi le 3 lezioni</button>`;
  }
  // le verifiche del codice, una per una, con il loro destino: l'anteprima e «Aggiungi» leggono la stessa lista,
  // così il pulsante promette esattamente quelle che entrano (doppioni dentro il codice e posto rimasto compresi)
  const IMP_TAG = {dup: "c'è già", today: 'è oggi', old: 'passata', far: 'troppo lontana', empty: 'senza argomenti', room: "non c'è posto"};
  function impRows(T) {
    const sig = t => `${t.subj}|${(t.name || '').trim().toLowerCase()}|${t.date}`;
    const have = new Set(S.st.tests.map(sig));
    let room = roomLeft();
    return (IMP.list || []).map(t => {
      const why = have.has(sig(t)) ? 'dup' : t.date === T ? 'today' : t.date < T ? 'old' : EN.diff(T, t.date) > 400 ? 'far' : !t.topics.length ? 'empty' : room <= 0 ? 'room' : '';
      if (!why) room--;
      if (!why || why === 'room') have.add(sig(t));          // la sua gemella più sotto nel codice è un doppione, anche se per lei non c'è posto
      return {t, why, good: !why};
    });
  }
  function vImport(c) {
    const T = today();
    let out = `${topbar(c)}${backHTML()}<h2>📥 Ho un codice</h2>${sayHTML(c, IMP.list ? 'Ecco cosa c\'è dentro. Guarda se torna.' : 'Incolla qui il codice che ti hanno mandato: comincia con STUDIO1:')}`;
    if (!IMP.list) {
      out += `<textarea class="txt" id="st-code" data-stf="code" placeholder="STUDIO1:…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Codice delle verifiche">${esc(IMP.code)}</textarea>
        ${IMP.err ? `<div class="fb no small">${esc(IMP.err)}</div>` : ''}
        <button class="btn big" data-act="st-imp-read">🔎 Leggi il codice</button><p class="small dim">Prima di aggiungere ti faccio vedere cosa c'è dentro. Un codice lo crea chi ha già la verifica in Studio: scheda della verifica → 📤 Passa il codice.</p>`;
      return out;
    }
    const rows = impRows(T), ok = rows.filter(x => x.good).length, noRoom = rows.filter(x => x.why === 'room').length;
    out += `<div class="card st-hl">${rows.map(x => {
      const t = x.t, sub = subjOf(t.subj);
      return `<div class="st-hrow ${x.good ? '' : 'no'}"><span class="xe">${sub.e}</span><span class="grow"><b>${esc(t.name || sub.n)}</b><small>${fDay(t.date)} · ${inDays(EN.diff(T, t.date))}</small><span class="small muted">${t.topics.map(a => esc(a.n)).join(' · ') || 'nessun argomento'}</span><span class="small muted">${plural(t.topics.length, 'argomento', 'argomenti')} · ${fMin(EN.estimate(t.topics))}${t.sheet ? ' · 📄' : ''}</span></span><span class="st-tag ${x.good ? 'ok' : 'dim'}">${IMP_TAG[x.why] || 'nuova'}</span></div>`;
    }).join('')}</div>
      ${noRoom ? `<div class="st-note warn small">⚠️ ${roomMsg()} ${noRoom === 1 ? 'Una verifica del codice resta fuori.' : `${noRoom} verifiche del codice restano fuori.`}</div>` : ''}
      <button class="btn big gold" data-act="st-imp-add" ${ok ? '' : 'disabled'}>${ok ? `➕ Aggiungi ${plural(ok, 'verifica', 'verifiche')}` : 'Niente da aggiungere'}</button>
      <button class="btn ghost" data-act="st-imp-reset">Un altro codice</button>
      <p class="small dim">Dopo le puoi ritoccare: minuti, esercizi, «quanto lo sai già». Di serie ogni argomento parte da «così così».</p>`;
    return out;
  }

  /* =====================================================================================================
     4.0 · Il piano del giorno (22.11.2026). Massimo apre Studio e trova una domanda sola («quanto tempo hai oggi?»),
     poi una cosa sola da fare («Adesso»). Boss, serie e mappa stanno in «Tutto il piano»; le ore totali non si vedono qui.
     Ogni giorno ha il suo massimo (La mia settimana), i compiti contano come studio, la domenica resta per recuperare.
     Il coach è una chat senza AI e senza rete: capisce frasi semplici (STUDIO_ENGINE.parse) e conosce il piano.
     ===================================================================================================== */
  const TIMES = [15, 30, 45, 60, 90, 120, 180, 240];
  const HWT = [0, 15, 30, 45, 60, 90];
  const WKV = [0, 10, 15, 20, 30, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180, 210, 240];
  const HWV = [0, 10, 15, 20, 30, 40, 45, 60, 75, 90, 120];
  const KID_WEEK = [90, 40, 60, 60, 60, 240, 0];        // la settimana detta da Giorgio e Massimo il 22.11.2026 (si cambia in un attimo)
  const SIZE = {S: 60, M: 150, L: 300};
  const SIZES = [['S', '🐣', 'Piccola', 'un capitolo, qualche pagina · circa 1 h'], ['M', '🐺', 'Media', 'qualche capitolo · circa 2 h 30'],
    ['L', '🐉', 'Grossa', 'tanta roba · circa 5 h'], ['M', '🤷', 'Non lo so', 'metto media: dopo i primi blocchi si regola da solo']];
  // per materia: quanta parte è teoria e quanti minuti un esercizio (le altre materie sono solo da studiare)
  const EXS = {mate: [0.3, 6], ita: [0.6, 8], ted: [0.5, 5], fra: [0.5, 5], ing: [0.5, 5], lat: [0.5, 6], sci: [0.8, 6]};
  const DOT = {ontrack: ['🟢', 'in pari'], ready: ['🏆', 'pronto'], behind: ['🟡', 'da recuperare'], rush: ['🔴', 'di corsa'], review: ['🔁', 'ripasso'],
    today: ['📝', 'è oggi'], wait: ['📝', 'la nota?']};
  const fT = m => m > 0 ? fMin(m) : 'niente';
  const fS = m => m > 0 ? fMin(m).replace(' min', '′') : '0';
  const dInfo = k => { try { return EN.dayInfo(S.st, k); } catch (e) { return null; } };
  const hasWeek = () => !!S.st && !!S.st.cfg && Array.isArray(S.st.cfg.wk);
  const checked = T => !!S.st.cfg.av && own(S.st.cfg.av, T);
  const cap1 = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const dayName = (d, T) => { const n = EN.diff(T || today(), d); return n === 0 ? 'oggi' : n === 1 ? 'domani' : `${WDF[EN.dow(d)]} ${+d.slice(8, 10)}`; };
  const budE = c => { try { return typeof buddyEmoji === 'function' ? buddyEmoji(c ? c.stage : 0) : '🐲'; } catch (e) { return '🐲'; } };
  let CK = null;                                  // la risposta di oggi in scrittura {d, av, hw}
  let WK = null;                                  // la settimana in scrittura {wk: [7], hw: [7]}
  let wkLater = false;                            // «Dopo» sulla settimana: per questa volta non la richiedo
  let CH = [], CHIPS = [], CHQ = null, CHT = '';  // il coach: messaggi, pulsanti dell'ultimo, domanda in sospeso, testo che sta scrivendo
  let HWM = 0;                                    // compiti fatti oggi, in scrittura
  let CHO = '';                                   // il giorno in cui il coach ha già detto «non ci sta tutto» (lo dice una volta)
  // la prima domenica-cuscinetto libera da oggi in poi (per «uso anche la domenica»), o null
  function freeSunday(p) {
    for (const x of p.days.slice(0, 14)) if (EN.dow(x.d) === 6 && !x.off && !x.busy && (x.on === false || (x.on === undefined && !x.study)) && !(x.q > 0)) return x.d;
    return null;
  }
  function useSunday() {
    const T = today(), d = freeSunday(planOf(S.st, T)); if (!d) return null;
    mutate(() => { EN.setDay(S.st, T, d, {av: 60}); });
    return d;
  }

  function quickTopics(subj, size) {
    const tot = SIZE[size] || SIZE.M, ex = own(EXS, subj) ? EXS[subj] : null;
    if (!ex) return [{n: 'Il programma', kind: 'th', conf: 2, thMin: tot, exN: 0, exMin: 0}];
    const thMin = Math.max(15, Math.round(tot * ex[0] / 5) * 5), exMin = ex[1], exN = Math.max(2, Math.round((tot - thMin) / exMin));
    return [{n: 'Il programma', kind: 'both', conf: 2, thMin, exN, exMin}];
  }
  const hwLeftOf = (t, i) => Math.max(0, (t.hw != null ? t.hw : (i && i.hw) || 0) - (t.hwDone || 0));

  /* ---------- la domanda del giorno ---------- */
  function ckDraft(T) {
    if (!CK || CK.d !== T) { const i = dInfo(T) || {}; CK = {d: T, av: i.av != null ? i.av : (i.usual || 0), hw: i.hav != null ? i.hav : (i.usualHw || 0)}; }
    return CK;
  }
  function ckPreview(T, k) {
    try {
      const st2 = EN.clean(JSON.parse(JSON.stringify(S.st))), hw = Math.min(k.hw, k.av);
      EN.setDay(st2, T, T, {av: k.av, hw});
      const p = EN.plan(st2, T), q = p.today.q, room = Math.max(0, k.av - hw);
      if (k.av === 0) return 'Va bene: oggi riposo. Il lavoro non sparisce, lo sposto sui prossimi giorni.';
      if (!p.tests.some(s => ACTIVE[s.status] && s.status !== 'today')) return hw ? `Oggi solo i compiti: ${fMin(hw)}.` : 'Nessuna verifica in arrivo: oggi niente da piano.';
      let h = q > 0 ? `Oggi: ${hw ? `compiti ${fMin(hw)} + ` : ''}studio <b>${fMin(q)}</b>${q < room ? ` · ti avanzano ${fMin(room - q)}` : ''}.` : hw ? `Oggi: compiti ${fMin(hw)}. Per le verifiche niente.` : 'Oggi per le verifiche non serve niente.';
      if (p.overload > 0) h += ` <span class="st-warnt">Con il tempo di questi giorni non ci sta tutto: te lo dico dopo.</span>`;
      return h;
    } catch (e) { return ''; }
  }
  function checkinHTML(c, T) {
    const k = ckDraft(T), i = dInfo(T) || {};
    const ts = [...new Set([...TIMES, k.av].filter(v => v > 0))].sort((a, b) => a - b);
    const hs = [...new Set([...HWT, k.hw])].filter(v => v <= Math.max(k.av, 0) || v === 0).sort((a, b) => a - b);
    const chip = (act, v, on, label, tag) => `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${on}">${label}${tag ? ` <span class="tag">${tag}</span>` : ''}</button>`;
    return `${sayHTML(c, `Ciao ${pname()}! Una domanda sola: <b>quanto tempo hai oggi per studiare?</b> Compiti compresi.`)}
      <div class="card st-ck"><div class="label">⏱️ Oggi ho</div><div class="chips">${ts.map(v => chip('st-ck-av', v, k.av === v, fS(v), v === i.usual ? 'di solito' : '')).join('')}${chip('st-ck-av', 0, k.av === 0, '😴 Oggi niente')}</div>
      ${k.av > 0 ? `<div class="label" style="margin-top:14px">✏️ Di questi, compiti</div><div class="chips">${hs.map(v => chip('st-ck-hw', v, k.hw === v, v ? fS(v) : 'Nessuno', v && v === i.usualHw ? 'di solito' : '')).join('')}</div>` : ''}
      <div class="st-note small">${ckPreview(T, k)}</div>
      <button class="btn big gold" data-act="st-ck-ok">✅ Fatto: dimmi cosa fare</button></div>`;
  }

  /* ---------- Oggi: una cosa alla volta ---------- */
  function nowItemHTML(x) {
    if (x.hw) return `<div class="st-now"><div class="row"><span class="st-ne">✏️</span><div class="grow"><b>Compiti</b><div class="small muted">${fMin(x.min)} · prima quelli per domani</div></div></div>
      <p class="small">Uno alla volta, dal più difficile. Il telefono dall'altra parte della stanza.</p>
      <div class="st-grid2"><button class="btn ok" data-act="st-hw-play">▶ Inizia</button><button class="btn ghost" data-act="st-hw-done">✔ Già fatti</button></div></div>`;
    const f = blockInfo(x.b); if (!f) return '';
    return `<div class="st-now" data-boss="${esc(f.t.id)}"><div class="row"><span class="st-ne">${f.e}</span><div class="grow"><b>${esc(f.title)}</b><div class="small muted">${f.what}</div><div class="small dim">${f.sub.e} ${esc(tTitle(f.t))} · contro ${f.boss.e}</div></div></div>
      <p class="small">${esc(f.x)}</p>
      <div class="st-grid2"><button class="btn ok pulse" data-act="st-play" data-i="${x.j}">▶ Inizia</button><button class="btn ghost" data-act="st-hand" data-i="${x.j}">✔ Già fatto</button></div></div>`;
  }
  function laterRow(x) {
    if (x.hw) return `<div class="st-blk"><span class="xe">✏️</span><span class="grow"><b>Compiti</b><small>${fMin(x.min)}</small></span><button class="st-ib go" data-act="st-hw-play" aria-label="Timer dei compiti">▶</button><button class="st-ib" data-act="st-hw-done" aria-label="Compiti già fatti">✔</button></div>`;
    return blockRow(x.b, x.j, true, false);
  }
  function todayPlanHTML(c, p, r, T) {
    const t = p.today, i = dInfo(T) || {}, hw = t.hw != null ? t.hw : (i.hw || 0), hwDone = t.hwDone || 0, hwLeft = Math.max(0, hw - hwDone);
    BL = t.blocks.slice(0, 12);
    const total = t.q + hw, done = t.done + hwDone;
    let ring, head, sub;
    if (t.full) { ring = ringHTML(1, '✓', 'fatto', 'full'); head = 'Giornata piena'; sub = `${fMin(done)} oggi. Il resto della giornata è tuo.`; }
    else if (total <= 0) {
      ring = ringHTML(0, i.busy ? '😴' : t.cushion ? '☂️' : '😌', '', 'soft');
      head = i.busy ? 'Oggi riposo' : t.cushion ? `Recupero: ${fMin(t.cushion.min)}, se vuoi` : 'Oggi niente da fare';
      sub = i.busy ? 'Hai detto che oggi non hai tempo: il piano ha spostato il lavoro.' : t.cushion ? 'Giorno cuscinetto: se vuoi rimetti in pari i conti. Nessun obbligo.' : 'Il piano oggi non chiede niente.';
    } else {
      const rm = ringMin(Math.max(0, total - done));
      ring = ringHTML(done / total, rm[0], rm[1], '');
      head = done > 0 ? `Ancora ${fMin(total - done)}` : `Oggi: ${fMin(total)}`;
      sub = [hw ? `✏️ compiti ${fMin(hw)}` : '', t.q ? `📚 studio ${fMin(t.q)}` : ''].filter(Boolean).join(' + ') + (done > 0 ? ` · fatti ${fMin(done)}` : '');
    }
    let out = `<div class="card st-today"><div class="row">${ring}<div class="grow"><div class="label">Oggi · ${fDay(T)}</div><div class="st-hd">${head}</div><div class="small muted">${sub}</div></div></div>`;
    if (i.max != null) out += `<button class="link st-chg" data-act="st-ck-redo">⏱️ Oggi hai ${fT(i.max)}${i.hw ? `, compiti ${fMin(i.hw)}` : ''} · cambia</button>`;
    if (!t.full && p.days[0] && overWhy(p.days[0])) out += `<div class="st-note warn small">${overWhy(p.days[0]).trim()}</div>`;
    const list = [];
    if (!t.full) { if (hwLeft > 0) list.push({hw: 1, min: hwLeft}); BL.forEach((b, j) => list.push({b, j})); }
    if (list.length) {
      out += `<div class="label st-lab">▶ Adesso</div>${nowItemHTML(list[0])}`;
      const rest = list.slice(1);
      if (rest.length) out += `<div class="label st-lab">Poi</div><div class="st-blocks">${rest.slice(0, 4).map(laterRow).join('')}</div>${rest.length > 4 ? `<div class="small dim" style="margin-top:6px">… e altri ${rest.length - 4}, uno alla volta.</div>` : ''}`;
    }
    if (!t.full && t.q > 0 && t.skipCost != null) {
      // con il massimo per giorno domani può non salire: allora il conto del salto va a ridosso della verifica, e si dice
      const tom = p.days[1], late = q => q.tests.reduce((a, x) => a + (ACTIVE[x.status] ? (x.tight || 0) + (x.overload || 0) : 0), 0);
      let extra = 0; try { extra = late(EN.plan(S.st, EN.addD(T, 1))) - late(p); } catch (e) {}
      out += `<div class="st-note small">😬 Se salti oggi, domani sono <b>${fMin(t.skipCost)}</b>${tom && tom.q > 0 && tom.q < t.skipCost ? ` invece di ${fMin(tom.q)}` : ''}${extra >= 5 ? ` e <b>${fMin(extra)}</b> finiscono a ridosso della verifica` : ''}.</div>`;
    }
    if (!t.full && i.av != null && i.usual > 0 && i.av < i.usual && i.av > 0) out += `<div class="small dim" style="margin-top:8px">Oggi hai meno tempo del solito: quello che non ci sta l'ho spostato sui prossimi giorni.</div>`;
    if (t.full) {
      const more = p.tests.find(x => ACTIVE[x.status] && x.status !== 'today' && x.left > 0);
      if (more) out += `<button class="btn ghost" data-act="st-open" data-id="${esc(more.id)}">➕ Faccio un pezzo in più</button>`;
    } else if (list.length) out += `<div class="st-grid2"><button class="btn ghost" data-act="st-nowill">😮‍💨 Non ho voglia</button><button class="btn ghost" data-act="st-go" data-scr="chat">💬 Chiedi al coach</button></div>`;
    if ((S.st.log || []).some(x => x.d === T)) out += `<button class="link" data-act="st-undo">Annulla l'ultima cosa segnata</button>`;
    return out + `</div>`;
  }
  function upcomingHTML(p) {
    const list = p.tests.filter(s => ACTIVE[s.status] || s.status === 'wait');
    if (!list.length) return '';
    return `<div class="card st-upc"><b>📅 Le tue verifiche</b>${list.slice(0, 8).map(s => {
      const t = s.test, sub = subjOf(t.subj), b = DA.bossFor(t), live = ACTIVE[s.status] && s.status !== 'today';
      const dt = s.overload > 0 && live ? ['🟠', 'non ci sta'] : s.tight > 0 && live && s.status !== 'rush' ? ['🟡', 'a ridosso'] : DOT[s.status] || DOT.ontrack;
      return `<button class="st-urow" data-act="st-open" data-id="${esc(t.id)}"${s.status === 'wait' ? ' data-grade="1"' : ''} data-boss="${esc(t.id)}"><span class="xe">${b.e}</span><span class="grow"><b>${sub.e} ${esc(tTitle(t))}</b><small>${fDay(t.date)} · ${inDays(s.daysTo)}</small>${s.total > 0 && ACTIVE[s.status] ? hpHTML(s.left, s.total) : ''}</span><span class="st-dot">${dt[0]}<small>${dt[1]}</small></span></button>`;
    }).join('')}${list.length > 8 ? `<div class="small dim">… e altre ${list.length - 8} in «Tutto il piano».</div>` : ''}</div>`;
  }
  function overloadHTML(p) {
    const sun = freeSunday(p), late = p.tests.filter(s => s.overload > 0).map(s => `${subjOf(s.test.subj).e} ${esc(tTitle(s.test))}`).join(', ');
    return `<div class="st-note warn small">⚠️ <b>Con il tempo che hai non ci sta tutto</b>${late ? ` (${late})` : ''}: mancano ${fMin(p.overload)}. Il piano non te li nasconde, li mette nei giorni subito prima della verifica. Si sistema dando un po' di tempo in più a qualche giorno, o parlandone con mamma o papà.
      ${sun ? `<button class="btn gold" data-act="st-use-sun">☂️ Uso anche ${dayName(sun)}: 1 h</button>` : ''}
      <div class="st-grid2"><button class="btn ghost" data-act="st-go" data-scr="cal">🗓️ Calendario</button><button class="btn ghost" data-act="st-go" data-scr="week">⏱️ La mia settimana</button></div></div>`;
  }
  function testDayCards(now, wait, T) {
    let out = '';
    for (const s of now) {
      const b = DA.bossFor(s.test), sub = subjOf(s.test.subj), k = ((dayIx(T) % 2) + 2) % 2;
      const tips = [DA.TESTDAY[k], DA.TESTDAY[2 + k], DA.TESTDAY[4 + k]].filter(Boolean);
      out += `<div class="card st-td" data-boss="${esc(s.id)}"><div class="row"><div class="st-mon bob">${b.e}</div><div class="grow"><div class="label">Oggi · ${sub.e} ${esc(sub.n)}</div><b class="st-bn">In bocca al lupo, ${pname()}!</b><div class="small muted">${esc(tTitle(s.test))}${s.pct >= 80 ? ` · piano fatto al ${s.pct} %` : ''}</div></div></div>
        <ol class="st-tips">${tips.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
        <button class="btn ghost" data-act="st-open" data-id="${esc(s.id)}" data-grade="1">L'ho già fatta: racconto com'è andata</button></div>`;
    }
    for (const s of wait) {
      const b = DA.bossFor(s.test), sub = subjOf(s.test.subj);
      out += `<div class="card st-wait"><div class="row"><div class="st-mon">${b.e}</div><div class="grow"><div class="label">${sub.e} ${esc(sub.n)} · ${fDay(s.test.date)}</div><b class="st-bn">Com'è andata?</b><div class="small muted">${esc(tTitle(s.test))}. Segna la nota quando arriva: +10 💎, qualunque sia.</div></div></div><button class="btn gold" data-act="st-open" data-id="${esc(s.id)}" data-grade="1">📝 Segna la nota</button></div>`;
    }
    return out;
  }
  function vToday(c, live) {
    const st = S.st, T = today();
    if (live) { try { if (EN.stamp(st, T)) save(); } catch (e) {} }
    const p = planOf(st, T), r = rew(c, T), i = dInfo(T) || {};
    const act = p.tests.filter(s => ACTIVE[s.status] && s.status !== 'today'), now = p.tests.filter(s => s.status === 'today'), wait = p.tests.filter(s => s.status === 'wait');
    const hwOn = (i.hw || 0) > 0 || (p.today.hwDone || 0) > 0;
    let out = topbar(c) + testDayCards(now, wait, T);
    if (!checked(T) && (act.length || hwOn || Array.isArray(st.cfg.hwk))) out += checkinHTML(c, T);
    else if (act.length || hwOn) {
      out += sayHTML(c, lineFor(c, p, r, T));
      out += todayPlanHTML(c, p, r, T);
      if (p.overload > 0) out += overloadHTML(p);
    } else if (!st.tests.length) {
      out += sayHTML(c, `Nessuna verifica in arrivo, ${pname()}? Quando ne spunta una dimmela: ai conti penso io.`)
        + `<div class="card center st-empty"><div class="big-emoji bob" style="font-size:84px">👾</div><h2>Ogni verifica è un boss</h2><p class="muted">Tre tocchi: materia, giorno, quanto è grossa. Io spalmo il lavoro sui giorni e ti dico cosa fare oggi.</p><button class="btn big pulse" data-act="st-quick">＋ Nuova verifica</button></div>`;
    } else if (!now.length && !wait.length) out += `<div class="card center"><div class="big-emoji" style="font-size:72px">🏝️</div><h2>Nessun boss in vista</h2><p class="muted">Tutte le verifiche sono alle spalle. Quando ne arriva un'altra, dimmela.</p></div>`;
    out += upcomingHTML(p);
    out += `<div class="st-grid2"><button class="btn" data-act="st-quick">＋ Verifica</button><button class="btn ghost" data-act="st-go" data-scr="chat">💬 Coach</button><button class="btn ghost" data-act="st-go" data-scr="cal">🗓️ Calendario</button><button class="btn ghost" data-act="st-go" data-scr="week">⏱️ La mia settimana</button></div>
      <button class="link" data-act="st-go" data-scr="${classic() ? 'home' : 'full'}">📊 Tutto il piano: boss, serie, mappa</button>`;
    if (r.streak > 0) out += `<p class="small dim center">⚔️ Serie di studio: ${plural(r.streak, 'giorno pieno', 'giorni pieni')} di fila</p>`;
    out += `<details class="card st-sec st-more"><summary>⋯ Altro: impostazioni, codice, consigli, storico</summary>${menuHTML(false)}</details>`;
    return out;
  }

  /* ---------- La mia settimana ---------- */
  function wkDraft() {
    if (!WK) {
      const cfg = S.st.cfg;
      const wk = hasWeek() ? cfg.wk.slice() : isAdult() ? cfg.days.map(v => v ? cfg.cap : 0) : KID_WEEK.map((v, i) => cfg.days[i] || i === 6 ? v : 0);
      WK = {wk, hw: Array.isArray(cfg.hwk) ? cfg.hwk.slice() : [0, 0, 0, 0, 0, 0, 0]};
    }
    return WK;
  }
  function vWeek(c) {
    const w = wkDraft(), first = !hasWeek();
    const rows = WDF.map((n, i) => `<div class="st-wrow ${w.wk[i] ? '' : 'cush'}"><div class="st-wn"><b>${cap1(n)}</b><small>${w.wk[i] ? 'al massimo' : '☂️ cuscinetto'}</small></div>${stepper('wk' + i, fT(w.wk[i]))}
      ${w.wk[i] ? `<div class="st-wh"><span class="small muted">✏️ compiti di solito</span>${stepper('hk' + i, fT(w.hw[i]))}</div>` : ''}</div>`).join('');
    return `${topbar(c)}${first ? '' : backHTML()}<h2>⏱️ La mia settimana</h2>
      ${sayHTML(c, first ? `Novità, ${pname()}! Dimmi quanto tempo hai <b>al massimo</b> ogni giorno per studiare, compiti compresi. Il piano non lo supera mai: solo se una verifica è vicina e non ci sta tutto, te lo dico prima.` : 'Il massimo di ogni giorno, compiti compresi. Il piano non lo supera.')}
      <div class="card st-week">${rows}<div class="st-tot" data-stl="wktot">${LIVE.wktot()}</div></div>
      ${w.wk[6] ? '<div class="st-note warn small">⚠️ Senza la domenica libera, se salti un giorno non hai dove recuperarlo.</div>' : '<div class="st-note small">☂️ La domenica resta vuota: se salti un giorno, la recuperi lì.</div>'}
      <p class="small dim">Un giorno diverso dal solito (gara, gita, più compiti)? Lo cambi dal Calendario, o lo dici al coach.</p>
      <button class="btn big gold" data-act="st-wk-save">💾 ${first ? 'Va bene così' : 'Salva la settimana'}</button>
      ${first ? '<button class="link" data-act="st-wk-later">Dopo</button>' : ''}`;
  }

  /* ---------- Calendario ---------- */
  // le materie di un giorno: compatte per il calendario, per esteso (long) per il coach
  function calItems(x, long) {
    const by = new Map();
    for (const it of x.items) { const o = by.get(it.tid) || {m: 0, rev: true}; o.m += it.min; if (it.phase !== 'review') o.rev = false; by.set(it.tid, o); }
    const out = [];
    if (long && x.hw > 0) out.push(`✏️ compiti ${fMin(x.hw)}`);
    for (const [tid, o] of by) { const t = findT(tid); if (t) out.push(long ? `${subjOf(t.subj).e} ${esc(tTitle(t))}${o.rev ? ' (ripasso)' : ''} ${fMin(o.m)}` : `${subjOf(t.subj).e} ${o.rev ? '🔁' : ''}${fS(o.m)}`); }
    if (!long && x.hw > 0) out.push(`✏️ ${fS(x.hw)}`);
    return out;
  }
  // oltre il massimo del giorno succede solo se una verifica non ci sta: si dice quale
  function overWhy(x) {
    const tot = x.q + (x.hw || 0); if (x.max == null || tot <= x.max) return '';
    const p = planOf(S.st, today()), s = p.tests.find(y => y.overload > 0 && x.items.some(it => it.tid === y.id));
    return ` ⚠️ È ${fMin(tot - x.max)} oltre il tuo massimo${s ? `: «${esc(tTitle(s.test))}» è vicina e non ci sta tutta` : ''}.`;
  }
  function vCal(c) {
    const T = today(), p = planOf(S.st, T), r = rew(c, T), mon = EN.addD(T, -EN.dow(T)), byD = new Map(p.days.map(d => [d.d, d]));
    let out = `${topbar(c)}${backHTML()}<h2>🗓️ Calendario</h2>${sayHTML(c, 'Ogni giorno: le verifiche, cosa studiare e quanto. Tocca un giorno per cambiarlo.')}`;
    for (let w = 0; w < 4; w++) {
      const ws = EN.addD(mon, 7 * w); let wsum = 0, rows = '';
      for (let k = 0; k < 7; k++) {
        const d = EN.addD(ws, k), x = byD.get(d), h = r.byDay.get(d), dd = `<span class="st-cd">${WD[k]}<b>${+d.slice(8, 10)}</b></span>`;
        const tests = (S.st.tests || []).filter(t => t.date === d).map(t => `<span class="t">📝 ${subjOf(t.subj).e} ${esc(tTitle(t))}</span>`);
        if (d < T) {
          if (h) wsum += h.min;
          rows += `<div class="st-cr past">${dd}<span class="st-ci">${tests.join(' ')}${h && h.min ? ` ${fS(h.min)} fatti` : ''}</span><span class="st-cm">${h ? (h.full ? '✅' : h.q > 0 ? '✗' : '') : ''}</span></div>`;
          continue;
        }
        if (!x) continue;
        const its = calItems(x), tot = x.q + (x.hw || 0); wsum += tot;
        const cush = x.on === false ? !x.off && !x.busy : !x.study && !x.off;
        const state = x.off ? '🏖️ libero' : x.busy ? '😴 niente' : cush && !tot ? '☂️ cuscinetto' : '';
        const right = state ? `<span class="small">${state}</span>` : tot ? `${fS(tot)}${x.max != null ? `<small>su ${fS(x.max)}</small>` : ''}` : '<small>—</small>';
        rows += `<button class="st-cr ${d === T ? 'now' : ''} ${x.over > 0 ? 'over' : ''}" data-act="st-cal-day" data-d="${d}" aria-label="${fDay(d)}: tocca per cambiarlo">${dd}<span class="st-ci">${[...tests, ...its].join(' · ') || '<span class="dim">—</span>'}</span><span class="st-cm">${right}</span></button>`;
      }
      if (rows) out += `<div class="card st-calw"><div class="st-calh"><b>${w === 0 ? 'Questa settimana' : w === 1 ? 'Settimana prossima' : `Dal ${fDay(ws)}`}</b><span class="small muted">${wsum ? fMin(wsum) + ' di studio' : ''}</span></div>${rows}</div>`;
    }
    out += `<div class="legend st-leg"><span>✏️ compiti</span><span>🔁 ripasso</span><span>📝 verifica</span><span>☂️ cuscinetto</span><span>🏖️ libero</span></div>
      <div class="st-grid2"><button class="btn" data-act="st-quick">＋ Verifica</button><button class="btn ghost" data-act="st-go" data-scr="week">⏱️ La mia settimana</button></div>`;
    return out;
  }
  function dayHTML(d) {
    const T = today(), i = dInfo(d) || {}, p = planOf(S.st, T), x = p.days.find(y => y.d === d) || {items: [], q: 0};
    const tests = (S.st.tests || []).filter(t => t.date === d && t.grade == null);
    const chip = (act, v, on, label) => `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-d="${d}" data-v="${v}" aria-pressed="${on}">${label}</button>`;
    const its = calItems(x);
    return `<div class="mc left"><h2>${cap1(WDF[EN.dow(d)])} ${+d.slice(8, 10)} ${MO[+d.slice(5, 7) - 1]}</h2>
      ${tests.length ? `<p class="small">📝 Verifica: <b>${tests.map(t => esc(tTitle(t))).join(', ')}</b></p>` : ''}
      <p class="small muted">${x.q || x.hw ? `In piano: ${its.join(' · ')} = <b>${fMin(x.q + (x.hw || 0))}</b>` : i.off ? 'Giorno libero: il piano lo salta.' : 'In piano: niente.'}</p>
      ${i.off ? '' : `<h3>⏱️ Quel giorno hai</h3><div class="chips">${[0, ...TIMES].map(v => chip('st-day-av', v, i.av != null && i.av === v, v ? fS(v) : '😴 Niente')).join('')}</div>
      <div class="small dim" style="margin-top:6px">Di solito: ${fT(i.usual)}.${i.av != null ? ` <button class="link st-inl" data-act="st-day-av" data-d="${d}" data-v="">Come di solito</button>` : ''}</div>
      <h3>✏️ Compiti quel giorno</h3><div class="chips">${HWT.map(v => chip('st-day-hw', v, i.hav != null ? i.hav === v : false, v ? fS(v) : 'Nessuno')).join('')}</div>
      <div class="small dim" style="margin-top:6px">Di solito: ${fT(i.usualHw)}.${i.hav != null ? ` <button class="link st-inl" data-act="st-day-hw" data-d="${d}" data-v="">Come di solito</button>` : ''}</div>`}
      ${tests.length ? '' : `<button class="btn ghost" data-act="st-day-off" data-d="${d}">${i.off ? '↩️ Non è più un giorno libero' : '🏖️ Giorno libero (vacanza, gara, gita)'}</button>`}
      ${d > T ? `<button class="btn ghost" data-act="st-quick" data-d="${d}">＋ Verifica in questo giorno</button>` : ''}
      <button class="btn" data-act="close">Fatto</button></div>`;
  }
  function refreshDay(d) { const m = $id('modal'); if (m && !m.hidden && m.querySelector('[data-act="st-day-av"],[data-act="st-day-off"]')) m.innerHTML = dayHTML(d); render(); }

  /* ---------- i compiti ---------- */
  function hwModal() {
    const T = today(), i = dInfo(T) || {};
    HWM = i.hwDone > 0 ? i.hwDone : (i.hw || 30);
    showModal(`<div class="mc"><div class="big-emoji pop" style="font-size:64px">✏️</div><h2>Compiti fatti oggi</h2><p class="small muted">Quanti minuti, più o meno? Contano come studio.</p>
      ${stepper('hwm', fMin(HWM))}<button class="btn ok big" data-act="st-hw-ok">✔ Segna</button>
      ${i.hwDone > 0 ? '<p class="small dim">Hai sbagliato? Metti il totale giusto: anche zero.</p>' : ''}<button class="link" data-act="close">Annulla</button></div>`);
  }
  function hwHit(total, d, add) {
    const T0 = today(), T = EN.isDay(d) && d < T0 && EN.diff(d, T0) <= 60 ? d : T0;
    if (S.ui.stTimer && S.ui.stTimer.k === 'hw') delete S.ui.stTimer;
    const p0 = EN.plan(S.st, T0), was = (dInfo(T) || {}).hwDone || 0, v = clamp(Math.round(add ? was + total : total), 0, 600);
    mutate(() => { EN.setHomework(S.st, T, v); });
    const p1 = EN.plan(S.st, T0);
    if (save() === false) return toast('⚠️ Non riesco a salvare: copia la partita da Io → Salva partita.');
    if (!p0.today.full && p1.today.full) { confetti(110, ['✏️', '💎', '✨']); toast('✅ Giornata piena: +5 XP e +5 💎'); }
    else if (v > was) { tone(SND.done); toast(`✏️ Compiti: ${fMin(v)} oggi. Contano come studio.`); }
    else toast(v ? `Compiti: ${fMin(v)}.` : 'Compiti tolti.');
  }
  function hwPlay() {
    if (yest()) return toast('Niente timer mentre segni ieri.');
    if (S.ui.stTimer && validTimer(S.ui.stTimer)) { openTimer(); return; }
    const T = today(), p = planOf(S.st, T), left = hwLeftOf(p.today, dInfo(T)) || 25;
    S.ui.stTimer = {tid: '', aid: null, k: 'hw', n: 0, min: clamp(Math.min(left, 45), 5, 240), start: Date.now(), five: 0, rev: null, d: T};
    tmUnsaved = save() === false;
    tone(SND.tap); openTimer(); wakeOn();
  }
  function startFirst() {
    const T = today(), p = planOf(S.st, T), t = p.today;
    if (hwLeftOf(t, dInfo(T)) > 0 && !t.full) return hwPlay();
    const b = t.blocks[0]; if (b) { BL = t.blocks.slice(0, 12); startTimer(b, false); } else toast('Per oggi non c\'è niente in piano. 😌');
  }

  /* ---------- il coach ---------- */
  const timeChips = () => [...TIMES.slice(0, 6).map(v => ({l: fS(v), k: 'time', v})), {l: '😴 Niente', k: 'time', v: 0}];
  const mainChips = () => [{l: '▶ Cosa faccio adesso?', k: 'say', v: 'cosa faccio adesso?'}, {l: '⏱️ Il mio tempo oggi', k: 'ask-time'},
    {l: '📅 E domani?', k: 'say', v: 'domani'}, {l: '＋ Ho una verifica', k: 'say', v: 'ho una verifica'}, {l: '😮‍💨 Non ho voglia', k: 'say', v: 'non ho voglia'}];
  function bot(h, chips) { CH.push({me: 0, h, chips: chips || []}); if (CH.length > 80) CH.splice(0, CH.length - 80); }
  function me(text) { CH.push({me: 1, h: esc(String(text).slice(0, 300))}); }
  function askTime(T) { CHQ = {k: 'time', d: T}; bot('Quanto tempo hai oggi per studiare? Compiti compresi. Tocca o scrivi (tipo «45 minuti»).', timeChips()); }
  function chatHello() {
    const T = today();
    if (yest()) return bot(`Stai segnando ieri, ${pname()}: torna a oggi e poi chiacchieriamo.`, []);
    if (!checked(T) && (S.st.tests || []).some(t => t.grade == null && t.date > T)) { bot(`Ciao ${pname()}! 👋`); return askTime(T); }
    const p = planOf(S.st, T), t = p.today, left = t.left + hwLeftOf(t, dInfo(T));
    bot(`Ciao ${pname()}! 👋 ${t.full ? 'Oggi la giornata è già piena ✅' : left > 0 ? `Oggi ti restano <b>${fMin(left)}</b>.` : 'Oggi il piano non chiede niente.'} Cosa ti serve?`, mainChips());
  }
  function todaySay(pre) {
    const T = today(), p = planOf(S.st, T), t = p.today, i = dInfo(T) || {}, hwLeft = hwLeftOf(t, i);
    const bl = t.blocks.slice(0, 4).map(b => { const f = blockInfo(b); return f ? `${f.e} ${esc(f.title)} ${fS(b.min)}` : ''; }).filter(Boolean);
    let h = pre ? pre + ' ' : '';
    if (t.full) h += '✅ Oggi la giornata è già piena. Il resto del tempo è tuo.';
    else if (!hwLeft && !t.blocks.length) h += i.busy ? 'Oggi niente studio.' : 'Oggi per le verifiche non serve niente. 😌';
    else h += `Oggi ${t.done || t.hwDone ? 'ti restano' : 'fai'}: ${[hwLeft ? `✏️ compiti ${fS(hwLeft)}` : '', ...bl].filter(Boolean).join(' · ')}${t.blocks.length > 4 ? ' · …' : ''}. Un pezzo alla volta.`;
    if (!t.full && t.skipCost != null) { const tom = p.days[1]; h += ` <span class="dim">Se salti oggi, domani sono ${fMin(t.skipCost)}${tom && tom.q > 0 && tom.q < t.skipCost ? ` invece di ${fMin(tom.q)}` : ''}.</span>`; }
    const warn = p.overload > 0 && CHO !== T;
    if (warn) { CHO = T; h += ' Una cosa onesta: con il tempo di questi giorni non ci sta tutto. Si sistema, vuoi vedere come?'; }
    const chips = [];
    if (!t.full && (hwLeft || t.blocks.length)) chips.push({l: '▶ Inizia adesso', k: 'play'});
    if (warn) chips.push({l: '🔧 Come lo sistemo?', k: 'fix'});
    chips.push({l: '⏱️ Cambia tempo', k: 'ask-time'}, {l: '📅 E domani?', k: 'say', v: 'domani'});
    bot(h, chips);
    if (!t.full && i.hav == null && i.max > 0) { CHQ = {k: 'hw', d: T}; bot(`E di compiti oggi quanti?${i.usualHw ? ` Di solito ${fMin(i.usualHw)}.` : ''}`, HWT.map(v => ({l: v ? fS(v) : 'Nessuno', k: 'hw', v}))); }
  }
  function setTimeOf(d, min) {
    const T = today(), q0 = planOf(S.st, T).today.q; min = clamp(Math.round((+min || 0) / 5) * 5, 0, 240);
    mutate(() => { EN.setDay(S.st, T, d, {av: min}); });
    if (d === T) return todaySay(min === 0 ? 'Ok, oggi riposo. Il lavoro non sparisce: lo sposto sui prossimi giorni.' : `Ok, oggi hai ${fMin(min)}.`);
    if (min > 0) return dayPlan(d, `Ok, ${dayName(d)} hai ${fMin(min)}.`);
    const q1 = planOf(S.st, T).today.q;
    bot(`Ok, ${dayName(d)} niente studio: il piano lo salta.${q1 !== q0 ? ` Oggi passa a ${fMin(q1)}.` : ' Oggi non cambia niente.'}`,
      [{l: '▶ Cosa faccio oggi?', k: 'say', v: 'cosa faccio adesso?'}, {l: '🗓️ Calendario', k: 'go', v: 'cal'}]);
  }
  function setHwOf(d, min) {
    const T = today(); min = clamp(Math.round((+min || 0) / 5) * 5, 0, 240);
    mutate(() => { EN.setDay(S.st, T, d, {hw: min}); });
    if (d === T) return todaySay(min ? `Ok, ${fMin(min)} di compiti: li conto nel tempo di oggi.` : 'Ok, niente compiti oggi.');
    dayPlan(d, `Ok, ${dayName(d)} ${min ? `${fMin(min)} di compiti` : 'niente compiti'}.`);
  }
  function dayPlan(d, pre) {
    const T = today(), p = planOf(S.st, T), x = p.days.find(y => y.d === d);
    if (!x) return bot(`${pre ? pre + ' ' : ''}Così lontano non guardo ancora: vedo le prossime sei settimane.`, mainChips());
    const its = calItems(x), tests = x.tests.map(findT).filter(Boolean).map(t => `📝 ${esc(tTitle(t))}`);
    const cush = x.on === false ? !x.off && !x.busy : !x.study && !x.off;
    let h = pre ? `${pre} In piano: ` : `<b>${cap1(dayName(d))}</b>: `;
    if (x.off) h += 'giorno libero 🏖️.';
    else if (x.busy) h += 'niente studio 😴.';
    else if (!x.q && !(x.hw > 0)) h += cush ? 'cuscinetto ☂️: resta vuoto, serve per recuperare.' : 'niente da fare per le verifiche.';
    else h += `${calItems(x, true).join(' · ')}${its.length > 1 ? `, in tutto <b>${fMin(x.q + (x.hw || 0))}</b>` : ''}.${overWhy(x)}`;
    if (tests.length) h += ` E c'è ${tests.join(', ')}.`;
    bot(h, [{l: '⏱️ Cambia quel giorno', k: 'day', v: d}, {l: '🗓️ Calendario', k: 'go', v: 'cal'}, {l: '▶ E oggi?', k: 'say', v: 'cosa faccio adesso?'}]);
  }
  function weekSay() {
    const T = today(), p = planOf(S.st, T);
    const ds = p.days.slice(0, 7).map(x => `${WD[EN.dow(x.d)]} ${x.off ? '🏖️' : x.busy ? '😴' : x.q + (x.hw || 0) ? fS(x.q + (x.hw || 0)) : '☂️'}`);
    bot(`I prossimi 7 giorni: ${ds.join(' · ')}.${p.overload > 0 ? ` ⚠️ Mancano ${fMin(p.overload)}: non ci sta tutto.` : ''}`, [{l: '🗓️ Apri il calendario', k: 'go', v: 'cal'}, {l: '⏱️ La mia settimana', k: 'go', v: 'week'}]);
  }
  function nextSay() {
    const T = today(), p = planOf(S.st, T), t = p.today, hwLeft = hwLeftOf(t, dInfo(T));
    if (!checked(T) && (S.st.tests || []).some(x => x.grade == null && x.date > T)) { bot('Prima dimmi una cosa.'); return askTime(T); }
    if (t.full) return bot('Oggi hai già fatto tutto ✅ Un pezzo in più o riposo: vanno bene tutte e due.', [{l: '➕ Un pezzo in più', k: 'go', v: 'full'}, {l: '😌 Riposo', k: 'say', v: 'grazie'}]);
    if (hwLeft > 0) return bot(`Adesso: <b>✏️ i compiti</b>, ${fMin(hwLeft)}. Prima quelli per domani, dal più difficile. Telefono lontano.`, [{l: '▶ Timer compiti', k: 'play'}, {l: '✔ Già fatti', k: 'hwdone'}]);
    const b = t.blocks[0], f = b ? blockInfo(b) : null;
    if (!f) return bot('Per oggi non c\'è niente in piano. 😌', mainChips());
    bot(`Adesso: <b>${f.e} ${esc(f.title)}</b> · ${f.what} (${f.sub.e} ${esc(tTitle(f.t))}). ${esc(f.x)}`, [{l: '▶ Inizia', k: 'play'}, {l: '😮‍💨 Non ho voglia', k: 'say', v: 'non ho voglia'}]);
  }
  function overSay() {
    const T = today(), p = planOf(S.st, T), t = p.today, total = t.left + hwLeftOf(t, dInfo(T));
    let h = `Ti capisco: vista tutta insieme sembra una montagna. Ma non devi scalarla oggi, ${pname()}. ${total > 0 ? `Oggi ti chiedo solo <b>${fMin(total)}</b>, un pezzo alla volta. Al resto penso io.` : 'Oggi non ti chiedo niente.'}`;
    if (p.overload > 0) { CHO = T; h += " Onesto: con il tempo che hai adesso non ci sta tutto. Ma si sistema, ti faccio vedere come."; }
    h += ' E se ti pesa tanto, dillo a mamma o papà: non devi tenertelo da solo.';
    bot(h, [{l: '▶ Solo il primo pezzo', k: 'say', v: 'cosa faccio adesso?'}, ...(p.overload > 0 ? [{l: '🔧 Come lo sistemo?', k: 'fix'}] : []), {l: '⏱️ Oggi ho meno tempo', k: 'ask-time'}, {l: '🗓️ Solo questa settimana', k: 'go', v: 'cal'}]);
  }
  function fixSay() {
    const T = today(), p = planOf(S.st, T), sun = freeSunday(p);
    if (!(p.overload > 0)) return bot('Adesso ci sta tutto ✅ Niente da sistemare.', mainChips());
    const late = p.tests.filter(s => s.overload > 0).map(s => `${subjOf(s.test.subj).e} ${esc(tTitle(s.test))}`).join(', ');
    bot(`Per ${late} mancano <b>${fMin(p.overload)}</b>. Cosa si può fare:${sun ? ` ☂️ usare ${dayName(sun)} (1 h);` : ''} ⏱️ dare più tempo a qualche giorno; 📋 togliere dalla verifica le cose che sai già; 👨‍👩‍👦 parlarne con papà o mamma.`,
      [...(sun ? [{l: `☂️ Uso ${dayName(sun)}`, k: 'sun'}] : []), {l: '🗓️ Calendario', k: 'go', v: 'cal'}, {l: '⏱️ La mia settimana', k: 'go', v: 'week'}]);
  }
  function nowillSay() {
    const pool = DA.NOWILL, tip = pool[nwI++ % pool.length];
    bot(`${tip.e} <b>${esc(tip.t)}</b> ${esc(tip.x)}`, [{l: '⏱️ Solo 5 minuti', k: 'five'}, {l: 'Un altro consiglio', k: 'say', v: 'non ho voglia'}]);
  }
  function crisisSay() {
    bot('Mi dispiace tanto che stai così. Questo è più importante di qualsiasi verifica. Parlane adesso con mamma, papà o un adulto di cui ti fidi. Puoi anche chiamare o scrivere al <b>147</b> di Pro Juventute: è gratis, giorno e notte, e resta tra voi.',
      [{l: '📞 Chiama il 147', k: 'url', v: 'tel:147'}, {l: '💬 Chat del 147', k: 'url', v: 'https://www.147.ch'}]);
  }
  function quickSay(q) {
    const T = today(), sj = q.subj ? subjOf(q.subj) : null;
    if (!q.subj) { CHQ = Object.assign(q, {k: 'qsubj'}); return bot('Che materia?', DA.SUBJECTS.filter(s => s.k !== 'altro').map(s => ({l: `${s.e} ${s.n}`, k: 'qsubj', v: s.k})).concat({l: '📓 Altro', k: 'qsubj', v: 'altro'})); }
    if (!q.day || q.day <= T) {
      CHQ = Object.assign(q, {k: 'qday'});
      const ds = []; for (let n = 1; n <= 10; n++) ds.push(EN.addD(T, n));
      return bot(`${sj.e} ${esc(sj.n)}: quando è? Tocca o scrivi (tipo «giovedì» o «il 3.12»).`, ds.map(k => ({l: `${WD[EN.dow(k)]} ${+k.slice(8, 10)}`, k: 'qday', v: k})));
    }
    if (EN.diff(T, q.day) > 400) { CHQ = Object.assign(q, {k: 'qday'}); return bot('Quella data è troppo lontana: controlla il giorno.', []); }
    if (!q.size) { CHQ = Object.assign(q, {k: 'qsize'}); return bot(`${sj.e} ${esc(sj.n)} · ${fDay(q.day)}: quanto è grossa?`, SIZES.map(([k, e, n]) => ({l: `${e} ${n}`, k: 'qsize', v: k}))); }
    if (roomLeft() <= 0) return bot(esc(roomMsg()), mainChips());
    let test = null;
    mutate(() => { test = EN.newTest(S.st, T, {subj: q.subj, name: '', date: q.day, sheet: false, topics: quickTopics(q.subj, q.size)}); });
    if (!test) return bot('Non sono riuscito a metterla: controlla la data.', mainChips());
    const b = DA.bossFor(test), p = planOf(S.st, T), s = p.tests.find(x => x.id === test.id);
    tone(SND.boss); confetti(80, [b.e, '⚔️']);
    bot(`⚔️ Fatto! ${sj.e} ${esc(sj.n)} ${fDay(q.day)}: in campo c'è <b>${esc(b.n)}</b>. ${s && s.status === 'rush' ? 'È vicina: niente panico, si parte da oggi.' : s ? `Sarai pronto entro ${fDay(s.readyBy)}.` : ''} Oggi in tutto: <b>${fMin(p.today.q)}</b> di studio.`,
      [{l: '▶ Cosa faccio adesso?', k: 'say', v: 'cosa faccio adesso?'}, {l: '📋 Dividila in argomenti', k: 'edit', v: test.id}, {l: '＋ Un\'altra', k: 'say', v: 'ho una verifica'}]);
  }
  function helpSay() {
    bot('Posso: dirti cosa fare <b>adesso</b>; cambiare il tempo di oggi o di un altro giorno («domani ho solo 20 minuti», «sabato ho la gara»); segnare i compiti («ho 30 minuti di compiti»); mettere una verifica («verifica di mate giovedì»); darti una mano quando non hai voglia o ti sembra troppo.', mainChips());
  }
  function respond(raw) {
    const T = today(), P = EN.parse(raw, T), I = new Set(P.intents), q = CHQ, n = P.min != null ? P.min : P.num;
    CHQ = null;
    if (I.has('crisis')) return crisisSay();
    if (q && q.k === 'time' && (n != null || P.none || I.has('usual'))) return setTimeOf(q.d || T, P.none ? 0 : n != null ? n : ((dInfo(T) || {}).usual || 0));
    if (q && q.k === 'hw' && (n != null || P.none || I.has('no'))) return setHwOf(q.d || T, P.none || I.has('no') ? 0 : n);
    if (q && q.k && q.k[0] === 'q' && q.k.length > 1 && !P.test) {
      if (q.k === 'qsubj' && P.subj) { q.subj = P.subj; return quickSay(q); }
      if (q.k === 'qday' && P.day) { q.day = P.day; return quickSay(q); }
      if (q.k === 'qsize' && (P.size || I.has('help'))) { q.size = P.size || 'M'; return quickSay(q); }
    }
    if (P.test) return quickSay({subj: P.subj, day: P.day && P.day > T ? P.day : null, size: P.size});
    if (P.hw && (P.min != null || P.none)) return setHwOf(P.day || T, P.none ? 0 : P.min);
    if (P.free && P.day && !(P.min > 0)) {
      CHQ = {k: 'time', d: P.day};
      return bot(`Ok, ${dayName(P.day)} hai un impegno. Ti resta un po' di tempo per studiare?`, [{l: '😴 Niente', k: 'time', v: 0, d: P.day}, ...[30, 60, 120].map(v => ({l: fS(v), k: 'time', v, d: P.day}))]);
    }
    if (P.min != null || (P.none && P.day)) return setTimeOf(P.day || T, P.none ? 0 : P.min);
    if (I.has('over')) return overSay();
    if (I.has('nowill')) return nowillSay();
    if (I.has('next')) return nextSay();
    if (I.has('left')) return todaySay();
    if (P.day && P.day > T) return dayPlan(P.day);
    if (P.day === T) return todaySay();
    if (I.has('week')) return weekSay();
    if (I.has('done')) return bot('Grande! 💪 Segnalo così il piano lo sa: nella pagina Oggi tocca ✔ su quello che hai fatto.', [{l: '✔ Vai a Oggi', k: 'go', v: 'home'}]);
    if (I.has('thanks')) return bot(rot(['Figurati! 💪', 'Quando vuoi.', 'Ci sono. Un pezzo alla volta.'], T), mainChips());
    if (I.has('greet')) { CH.pop(); return chatHello(); }
    if (I.has('help')) return helpSay();
    if (P.none) return setTimeOf(T, 0);
    if (n != null && n >= 5 && n <= 240 && !P.subj) return setTimeOf(T, n);
    if (P.subj) return quickSay({subj: P.subj, day: P.day && P.day > T ? P.day : null, size: P.size});
    bot('Non ho capito bene 🙈 Prova con parole semplici, tipo «ho 30 minuti», «cosa faccio adesso?» o «verifica di mate giovedì».', mainChips());
  }
  function chipDo(x) {
    const T = today();
    switch (x.k) {
      case 'say': me(x.l); return respond(x.v || x.l);
      case 'time': me(x.l); CHQ = null; return setTimeOf(EN.isDay(x.d) && x.d >= T ? x.d : T, x.v);
      case 'fix': me(x.l); return fixSay();
      case 'sun': { me(x.l); const d = useSunday(); return d ? dayPlan(d, `Fatto: ${dayName(d)} 1 h, solo per stavolta.`) : bot('Non trovo una domenica libera nei prossimi giorni.', mainChips()); }
      case 'hw': me(x.l); CHQ = null; return setHwOf(T, x.v);
      case 'ask-time': me(x.l); return askTime(T);
      case 'qsubj': case 'qday': case 'qsize': {
        me(x.l); const q = CHQ || {}; CHQ = null;
        q[x.k === 'qsubj' ? 'subj' : x.k === 'qday' ? 'day' : 'size'] = x.v; return quickSay(q);
      }
      case 'play': go('home'); return startFirst();
      case 'hwdone': return hwModal();
      case 'five': { const b = planOf(S.st, T).today.blocks[0]; if (b) { go('home'); startTimer(b, true); } else toast('Oggi non c\'è niente da fare: goditela.'); return; }
      case 'day': return showModal(dayHTML(x.v));
      case 'edit': { const t = findT(x.v); if (t) { D = draftOf(t); go('new'); } return; }
      case 'go': return go(x.v);
      case 'url': try { if (/^tel:/.test(x.v)) location.href = x.v; else window.open(x.v, '_blank', 'noopener'); } catch (e) {} return;
    }
  }
  function chatEnd() { setTimeout(() => { const e = $id('st-chat-end'); if (e) try { e.scrollIntoView({block: 'end'}); } catch (_) {} }, 30); }
  function vChat(c) {
    if (!CH.length) chatHello();
    const last = CH[CH.length - 1]; CHIPS = last && !last.me ? last.chips : [];
    const be = budE(c), nm = esc((P_() && P_().buddyName) || 'Coach');
    return `${topbar(c)}${backHTML()}<h2>💬 ${nm}, il tuo coach</h2>
      <div class="st-chat">${CH.map(m => m.me ? `<div class="st-msg me">${m.h}</div>` : `<div class="st-mrow"><span class="st-mb" aria-hidden="true">${be}</span><div class="st-msg">${m.h}</div></div>`).join('')}<div id="st-chat-end"></div></div>
      ${CHIPS.length ? `<div class="chips st-cchips">${CHIPS.map((x, i) => `<button class="chip" data-act="st-chat-chip" data-i="${i}">${esc(x.l)}</button>`).join('')}</div>` : ''}
      <div class="st-chin"><input class="txt" id="st-chat-in" data-stf="chat" maxlength="300" placeholder="Scrivi… (es. «ho 30 minuti»)" value="${esc(CHT)}" autocomplete="off" enterkeyhint="send" aria-label="Scrivi al coach"><button class="btn" id="st-next" data-act="st-chat-send" aria-label="Manda">➤</button></div>
      <p class="small dim center">Il coach non va su internet: capisce frasi semplici e conosce il tuo piano. Non è una persona: per le cose importanti, parla con mamma o papà.</p>`;
  }

  /* ---------- la vista ---------- */
  function errCard(c) {
    let top = ''; try { top = topbar(c); } catch (e) {}
    return `${top}<h2>📚 Studio</h2><div class="card"><b>⚠️ Qui qualcosa non va.</b><p class="small muted">Lo Studio non riesce a disegnare questa schermata. La partita e le verifiche sono al sicuro: torna alla Quest e riprova.</p><button class="btn" data-act="tab" data-v="home">🏠 Torna alla Quest</button></div>`;
  }
  function view(c) {
    try {
      boot();
      if (!S.st || typeof S.st !== 'object' || !S.st.cfg || !Array.isArray(S.st.tests)) S.st = EN.clean(S.st);
      const live = S.ui && S.ui.tab === 'studio';
      if (yest() && !['home', 'full', 'test'].includes(nav.scr)) nav = {scr: 'home'};
      if (live && nav.scr === 'home' && !S.st.intro && !yest()) { nav = {scr: 'intro'}; introReset(false); }
      // 4.0: la prima volta si mette la settimana (un tocco: è già compilata)
      if (live && nav.scr === 'home' && S.st.intro && !hasWeek() && !wkLater && !yest() && !classic()) { nav = {scr: 'week'}; WK = null; }
      switch (nav.scr) {
        case 'home': return yest() || classic() ? vHome(c, live) : vToday(c, live);
        case 'today': return yest() ? vHome(c, live) : vToday(c, live);
        case 'full': return vHome(c, live);
        case 'week': return vWeek(c);
        case 'cal': return vCal(c);
        case 'chat': return vChat(c);
        case 'intro': return vIntro(c);
        case 'new': return vNew(c);
        case 'test': return vTest(c);
        case 'tips': return vTips(c);
        case 'cfg': return vCfg(c);
        case 'hist': return vHist(c);
        case 'import': return vImport(c);
        default: return vHome(c, live);
      }
    } catch (e) {
      try { console.error('Studio.view', e); } catch (_) {}
      nav = {scr: 'home'};
      return errCard(c);
    }
  }
  function on() {
    try {
      if (!S || !S.profile || !S.st || typeof S.st !== 'object') return false;
      return !isAdult() || !!(S.ui && S.ui.stOn) || (Array.isArray(S.st.tests) && S.st.tests.length > 0);
    } catch (e) { return false; }
  }
  function homeCard(c) {
    boot();
    if (!on()) return '';
    const st = S.st; if (!Array.isArray(st.tests) || !st.tests.length) return '';
    const T = today(), p = planOf(st, T), t = p.today;
    const act = p.tests.filter(s => ACTIVE[s.status]), wait = p.tests.filter(s => s.status === 'wait');
    if (!act.length && !wait.length) return '';
    const nx = act[0];
    let title, sub, hp = '', btn = 'Apri lo Studio ▶', ghost = false;
    if (nx) {
      const sj = subjOf(nx.test.subj), b = DA.bossFor(nx.test);
      title = nx.status === 'today' ? 'Oggi verifica: in bocca al lupo' : t.full ? 'Quota di studio fatta ✓' : t.cushion ? `Recupero: ${fMin(t.cushion.min)}, se vuoi` : t.left > 0 ? `${fMin(t.left)} di studio` : 'Oggi niente studio';
      sub = `${b.e} ${esc(tTitle(nx.test))} · ${sj.e} ${esc(sj.n)} · ${inDays(nx.daysTo)}${act.length > 1 ? ` · e ${plural(act.length - 1, "un'altra", 'altre')}` : ''}`;
      hp = `<span class="st-hpw">${hpHTML(nx.left, nx.total)}<span class="st-hpt">❤️ ${nx.left} / ${nx.total}</span></span>`;
      ghost = t.full || !(t.left > 0);
      if (!ghost && !yest()) btn = t.done > 0 ? '▶ Avanti con lo studio' : '▶ Inizia a studiare';
      // 4.0: prima la domanda del giorno
      if (!yest() && !classic() && !t.full && nx.status !== 'today' && !checked(T)) { title = 'Quanto tempo hai oggi?'; btn = '⏱️ Pianifica oggi'; ghost = false; }
      else if (!yest() && !t.full && t.hw > 0 && hwLeftOf(t) > 0) title = `${fMin(t.left + hwLeftOf(t))} oggi, compiti compresi`;
    } else { title = "Com'è andata la verifica?"; sub = 'Segna la nota quando arriva: +10 💎, qualunque sia.'; btn = '📝 Segna la nota'; }
    return `<div class="card st-hc"><div class="row"><div class="qe">📚</div><div class="grow"><div class="label">Studio oggi</div><b style="font-size:1.2rem">${title}</b><div class="small muted">${sub}</div></div></div>${hp}<button class="btn ${ghost ? 'ghost' : ''}" data-act="st-tab">${btn}</button></div>`;
  }
  function meCard(c) {
    boot();
    if (!S.profile || !S.st) return '';
    const adult = isAdult(), r = c && c.study, has = Array.isArray(S.st.tests) && S.st.tests.length > 0, isOn = on();
    if (!adult && !(r && r.sessions > 0)) return '';
    const stats = r && r.sessions > 0 ? `${fMin(r.minutes)} di studio · ${plural(r.bosses, 'boss sconfitto', 'boss sconfitti')} · record ${plural(r.best, 'giorno pieno', 'giorni pieni')} di fila` : 'Verifiche che diventano boss: il piano ti dice quanto studiare ogni giorno.';
    return `<div class="card"><div class="row"><div class="qe">📚</div><div class="grow"><b>Studio</b><div class="small muted">${stats}</div></div></div>
      ${adult ? (has ? `<div class="small dim" style="margin-top:8px">La scheda Studio resta accesa finché ci sono verifiche.</div>` : `<button class="btn ghost" data-act="st-toggle">${isOn ? '📚 Scheda Studio accesa: tocca per spegnerla' : '📚 Accendi la scheda Studio'}</button>`) : `<button class="btn ghost" data-act="st-tab" data-scr="hist">📜 Storico e note</button>`}</div>`;
  }
  function help() {
    return `<p><b>📚 Studio:</b> metti una verifica con i suoi argomenti e il piano spalma il lavoro sui giorni: ti dice i minuti di oggi e ti fa arrivare <b>pronto 2 giorni prima</b>. Gli ultimi giorni sono solo ripasso.</p>
  <p><b>👾 Boss di studio:</b> ogni verifica è un mostro e i suoi punti vita sono i minuti di lavoro rimasti. Ogni blocco lo colpisce. A zero è sconfitto: +25 💎, e altri +25 se sei in anticipo.</p>
  <p><b>😬 Se salti:</b> il lavoro non sparisce, si sposta sui giorni dopo e la quota sale. Il giorno cuscinetto (di serie la domenica) serve a recuperare. Vacanze e gare: tocca il giorno sulla mappa e il piano lo salta.</p>
  <p><b>⏱️ Il tuo tempo:</b> in «La mia settimana» dici quanto tempo hai al massimo ogni giorno, compiti compresi (la domenica resta vuota per recuperare). Ogni giorno Studio ti chiede quanto tempo hai oggi e ti dà una cosa alla volta. La verifica più vicina passa per prima.</p>
  <p><b>✏️ Compiti:</b> contano come studio. Occupano il tempo del giorno e valgono per la giornata piena.</p>
  <p><b>💬 Coach:</b> scrivigli come a un amico («ho 20 minuti», «verifica di mate giovedì», «non ho voglia»). Non va su internet.</p>
  <p><b>⚔️ Serie di studio:</b> quota di oggi fatta = giornata piena (+5 XP e +5 💎; ogni 5 di fila +15 💎; se quel giorno hai fatto anche la quest, un colpo in più al boss della settimana). 1 XP ogni 3 minuti. Si premia il lavoro: la nota vale +10 💎 qualunque sia.</p>`;
  }

  /* ---------- timer di blocco e «Cosa hai fatto davvero?» ---------- */
  const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${pad2(s % 60)}`; };
  // il timer salvato si controlla campo per campo (S.ui si può scrivere a mano) e si rimette in forma: n intero, compito di ripasso e giorno noti
  function validTimer(tm) {
    if (!tm || typeof tm !== 'object' || typeof tm.tid !== 'string' || !['th', 'ex', 'rev', 'hw'].includes(tm.k)) return false;
    if (!Number.isFinite(tm.start) || tm.start > Date.now() + 60e3 || !Number.isFinite(tm.min) || tm.min < 1 || tm.min > 240) return false;
    if (!(tm.aid == null || typeof tm.aid === 'string') || !(tm.end == null || Number.isFinite(tm.end)) || (tm.k !== 'hw' && !findT(tm.tid))) return false;
    tm.n = tm.k === 'ex' ? clamp(typeof tm.n === 'number' && Number.isFinite(tm.n) ? Math.round(tm.n) : 1, 1, 200) : 0;
    tm.rev = own(DA.REVIEW, tm.rev) ? tm.rev : null;
    tm.five = tm.five ? 1 : 0;
    if (!(EN.isDay(tm.d) && tm.d <= realDay())) delete tm.d;         // d = il giorno in cui è partito
    return true;
  }
  // schermo acceso mentre il timer corre. Il sistema rilascia il blocco quando l'app va sullo sfondo: al rientro si richiede;
  // se lo rifiuta (capita con l'app in Home su alcuni iOS) si riprova dopo un minuto, non ogni secondo
  function wakeOn() {
    try {
      if (wake || !navigator.wakeLock || document.visibilityState !== 'visible' || Date.now() < wakeNo) return;
      wake = 1;
      navigator.wakeLock.request('screen').then(w => {
        if (wake !== 1) { try { w.release().catch(() => {}); } catch (e) {} return; }      // nel frattempo il timer è finito
        wake = w;
        try { w.addEventListener('release', () => { if (wake === w) wake = null; }); } catch (e) {}
      }).catch(() => { if (wake === 1) wake = null; wakeNo = Date.now() + 60e3; });
    } catch (e) { wake = null; }
  }
  function wakeOff() { try { if (wake && wake.release) wake.release().catch(() => {}); } catch (e) {} wake = null; }
  function startTimer(b, five) {
    if (yest()) return toast('Niente timer mentre segni ieri.');
    if (S.ui.stTimer && validTimer(S.ui.stTimer)) { openTimer(); return; }
    const t = findT(b.tid); if (!t) return;
    const min = five ? 5 : clamp(Math.round(b.min) || S.st.cfg.block, 1, 240);
    let n = b.k === 'ex' ? Math.max(1, b.n || 1) : 0;
    if (five && b.k === 'ex') n = 1;
    // d: il giorno in cui parte. Se lo lascia scadere e riapre l'app dopo mezzanotte, il blocco va segnato lì
    S.ui.stTimer = {tid: b.tid, aid: b.aid || null, k: b.k, n, min, start: Date.now(), five: five ? 1 : 0, rev: b.rev || null, d: today()};
    tmUnsaved = save() === false;
    tone(SND.tap); openTimer();
    wakeOn();                                      // la prima richiesta parte dentro il tocco
  }
  function runHTML(tm) {
    const f = blockInfo(tm) || {e: '📖', title: 'Studio', boss: {e: '📚'}, t: null, x: ''};
    const left = tm.start + tm.min * 60e3 - Date.now(), C = 282.74;
    return `<div class="mc st-tm" id="st-tm" data-state="run">
      <div class="label">${f.boss.e} ${f.t ? esc(tTitle(f.t)) : ''}</div><h2>${f.e} ${esc(f.title)}</h2>
      <div class="st-clock"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="t" cx="50" cy="50" r="45"/><circle class="p" id="st-tmr" cx="50" cy="50" r="45" stroke-dasharray="${C}" stroke-dashoffset="${(C * (1 - clamp(left / (tm.min * 60e3), 0, 1))).toFixed(1)}" transform="rotate(-90 50 50)"/></svg><div class="c"><b id="st-tmt" role="timer">${clock(left)}</b><span>${tm.five ? 'solo 5 minuti' : `su ${fMin(tm.min)}`}</span></div></div>
      <p class="st-tmx">${tm.k === 'ex' && !tm.five ? `Obiettivo: <b>${plural(tm.n, 'esercizio', 'esercizi')}</b>. ` : ''}${esc(tm.five ? 'Cinque minuti e poi decidi. Parti dalla cosa più facile.' : f.x)}</p>
      <p class="small dim">📵 Telefono dall'altra parte della stanza.${tmUnsaved ? '<b class="st-warnt"> Non riesco a salvare: tieni l\'app aperta fino alla fine.</b>' : '<span class="st-x2"> Puoi chiudere l\'app: il tempo corre lo stesso.</span>'}</p>
      <button class="btn ghost" data-act="st-tm-stop">✋ Ho finito prima</button>
      <button class="link" data-act="st-tm-cancel">Annulla il timer</button></div>`;
  }
  // dal timer (finito o fermato) alla domanda «cosa hai fatto davvero?»
  function askFromTimer(tm) {
    const end = Math.min(tm.end || Date.now(), tm.start + tm.min * 60e3), el = clamp(Math.round((end - tm.start) / 60e3), 0, tm.min), early = el < tm.min;
    const t = findT(tm.tid), a = t && tm.aid ? EN.totals(S.st, t).topics.find(x => x.id === tm.aid) : null, per = a && a.perEx ? a.perEx : 5;
    return {src: 'timer', early, tid: tm.tid, aid: tm.aid || null, k: tm.k, rev: tm.rev || null, five: tm.five ? 1 : 0, elapsed: el, d: tm.d || null,
      vMin: el, vN: tm.k === 'ex' ? (early ? clamp(Math.round(el / per), 0, tm.n || 1) : (tm.n || 1)) : 0, kinds: null};
  }
  function askHTML(full) {
    const m = M; if (!m) return '';
    const f = blockInfo({tid: m.tid, aid: m.aid, k: m.k, rev: m.rev, min: m.vMin, n: m.vN}) || {e: '📖', title: 'Studio', boss: {e: '📚', n: 'il boss'}, t: null};
    const head = m.src === 'timer' ? (m.early ? 'Fermato.' : 'Tempo!') : '✔ Segno a mano';
    const kinds = m.kinds && m.kinds.length > 1 ? `<div class="chips st-ctr">${m.kinds.map(k => `<button class="chip ${m.k === k ? 'on' : ''}" data-act="st-ask-k" data-v="${k}">${KIND[k].e} ${KIND[k].n}</button>`).join('')}</div>` : '';
    const body = m.k === 'ex'
      ? `<h3>Esercizi fatti</h3>${stepper('askn', String(m.vN))}${m.src === 'timer' ? `<div class="small dim">in ${fMin(Math.max(1, m.elapsed))}</div>` : ''}`
      : `<h3>Minuti di ${m.k === 'rev' ? 'ripasso' : m.k === 'hw' ? 'compiti' : 'teoria'}</h3>${stepper('askm', fMin(m.vMin))}`;
    return `<div class="mc ${full ? 'st-tm' : ''}" id="st-tm" data-state="ask">
      ${m.src === 'timer' ? `<div class="big-emoji pop" style="font-size:72px">${m.early ? '✋' : '⏰'}</div>` : ''}
      <h2>${head} ${m.src === 'timer' ? 'Cosa hai fatto davvero?' : ''}</h2>
      <p class="muted">${f.e} <b>${esc(f.title)}</b>${f.t ? ` · ${esc(tTitle(f.t))}` : ''}</p>${kinds}
      ${m.src === 'timer' && EN.isDay(m.d) && m.d < today() ? `<p class="small st-warnt">🕛 Questo timer era di ${fDay(m.d)}: lo segno su quel giorno.</p>` : ''}
      ${body}<div class="st-live" data-stl="askhp">${LIVE.askhp()}</div>
      <button class="btn ok big" data-act="st-ask-ok">${m.k === 'rev' ? '✔ Segna il ripasso' : m.k === 'hw' ? '✔ Segna i compiti' : `💥 Colpisci ${esc(f.boss.n)}`}</button>
      <p class="small dim">Segna solo quello che hai fatto davvero: il piano si regola da solo.</p>
      <button class="link" data-act="st-ask-no">${m.src === 'timer' ? 'Non segno niente' : 'Annulla'}</button></div>`;
  }
  function openTimer() {
    const tm = S.ui.stTimer; if (!validTimer(tm)) return;
    if (tm.end || Date.now() >= tm.start + tm.min * 60e3) { M = askFromTimer(tm); showModal(askHTML(true), {sticky: true}); }
    else showModal(runHTML(tm), {sticky: true});
  }
  function timeUp(tm) {
    M = askFromTimer(tm);
    const m = $id('modal'); if (m) m.innerHTML = askHTML(true);
    tone(SND.chest); confetti(40, ['⏰', '✨']); wakeOff();
  }
  function tick() {
    boot();
    const tm = S.ui && S.ui.stTimer;
    if (!tm) { if (wake) wakeOff(); return; }
    if (!validTimer(tm)) { delete S.ui.stTimer; save(); return; }
    const box = $id('st-tm');
    if (!box) {
      if (!modalOpen() && !document.body.classList.contains('wz') && !yest() && !document.hidden) {
        // un timer che non si riesce nemmeno a disegnare si butta: altrimenti l'errore torna ogni secondo e ▶ non risponde più
        try { openTimer(); } catch (e) { try { console.error('Studio timer', e); } catch (_) {} delete S.ui.stTimer; save(); }
      }
      return;
    }
    if (box.dataset.state !== 'run') return;
    const left = tm.start + tm.min * 60e3 - Date.now();
    if (left <= 0) { timeUp(tm); return; }
    wakeOn();
    const tx = $id('st-tmt'), rg = $id('st-tmr');
    if (tx) tx.textContent = clock(left);
    if (rg) rg.setAttribute('stroke-dashoffset', (282.74 * (1 - clamp(left / (tm.min * 60e3), 0, 1))).toFixed(1));
  }

  /* ---------- il colpo al boss ---------- */
  const PUNCH = [[180, 0, .09, 'sawtooth', .05], [120, .07, .14, 'sawtooth', .05]];
  function bossFx(tid, pct0, hp) {
    const el = document.querySelector(`[data-boss="${tid}"]`);
    if (!el) { if (hp > 0) floatXP(`−${hp} HP`); return; }
    try { el.scrollIntoView({block: 'center'}); } catch (e) {}
    const bar = el.querySelector('.st-hp i');
    if (bar && pct0 != null) { const w = bar.style.width; bar.style.transition = 'none'; bar.style.width = pct0 + '%'; void bar.offsetWidth; bar.style.transition = ''; bar.style.width = w; }
    if (hp > 0) {
      el.classList.remove('st-hit'); void el.offsetWidth; el.classList.add('st-hit');
      setTimeout(() => { try { el.classList.remove('st-hit'); } catch (e) {} }, 800);
      const rc = el.getBoundingClientRect();
      floatXP(`−${hp} HP`, {left: rc.left, width: rc.width, top: rc.top + Math.min(70, rc.height / 2)});
    }
  }
  function victory(t, early, daysTo) {
    const b = DA.bossFor(t);
    // si premia il lavoro: alla vittoria si legge quanto ce n'è dietro
    const lg = (S.st.log || []).filter(x => x.tid === t.id), gg = new Set(lg.map(x => x.d)).size, ex = sum(lg, x => x.k === 'ex' ? x.n : 0);
    tone(SND.boss); confetti(200, [b.e, '⚔️', '💎']);
    showModal(`<div class="mc st-win"><div class="big-emoji pop st-ko">${b.e}</div><div class="lvup">BOSS SCONFITTO!</div><h2>Sei pronto.</h2>
      <p><b>${esc(b.n)}</b> è a terra: <b class="st-nw">+25 💎</b></p>
      ${early ? `<div class="donebox">🏁 Pronto in anticipo: <span class="st-nw">altri +25 💎</span></div><p class="small muted">${daysTo > 1 ? `Mancano ${daysTo} giorni` : 'La verifica è domani'}: da qui solo ripasso, niente di nuovo. Così arrivi anche tranquillo.</p>` : `<p class="small muted">Finito a ridosso della verifica. La prossima volta si parte un giorno prima e arrivano anche le gemme dell'anticipo.</p>`}
      ${lg.length ? `<p class="small st-work">Questo l'hai fatto tu: <b>${fMin(sum(lg, x => x.m))}</b> in ${plural(gg, 'giorno', 'giorni')}${ex ? `, ${plural(ex, 'esercizio', 'esercizi')}` : ''}. Un pezzo alla volta.</p>` : ''}
      <button class="btn gold" data-act="close">GG ▶</button></div>`);
  }
  // segna una riga e fa vedere il colpo: scossa, «−25 HP», coriandoli, e le domande che servono dopo
  // questa riga esaurisce i minuti di teoria dell'argomento? Allora prima di segnarla si chiede «L'hai capito?»
  function endsTheory(row) {
    if (row.k !== 'th' || !row.aid) return null;
    const t = findT(row.tid), raw = t ? t.topics.find(x => x.id === row.aid) : null;
    if (!raw || raw.thFin) return null;
    const a = EN.totals(S.st, t).topics.find(x => x.id === row.aid);
    return a && a.thLeft > 0 && row.m >= a.thLeft ? a : null;
  }
  function askCapito(row, a) {
    PEND = row;
    showModal(`<div class="mc"><div class="big-emoji pop" style="font-size:72px">💡</div><h2>«${esc(a.n)}»: l'hai capito?</h2><p class="muted">Con questo blocco i minuti di teoria che avevi previsto sono finiti. Prova a ridirlo a libro chiuso: ti torna?</p>
      <button class="btn ok" data-act="st-fin-yes">✅ Sì, l'ho capito</button>
      <button class="btn ghost" data-act="st-fin-no">Non ancora: altri 15 minuti</button>
      <p class="small dim">«Non ancora» è una risposta da campione: il piano si rifà, onestamente.</p></div>`, {sticky: true});
  }
  // extra: 'fin' = «l'ho capito» (chiude la teoria) · 'ext' = «non ancora» (+15 minuti), nella stessa mossa della riga
  // row.d (solo dal timer): il giorno in cui il blocco è stato fatto, se non è oggi
  function hit(row, extra) {
    const T0 = today(), st = S.st, t = findT(row.tid);
    const T = EN.isDay(row.d) && row.d < T0 && EN.diff(row.d, T0) <= 60 ? row.d : T0;
    if (row.timer && S.ui.stTimer) delete S.ui.stTimer;
    if (!t) { save(); render(); return; }
    if (bornAfter(t, T)) { save(); render(); toast('Quel giorno questa verifica non c\'era ancora: non lo segno.'); return; }
    const c0 = calc(), a0 = EN.totals(st, t), p0 = EN.plan(st, T0), top0 = row.aid ? a0.topics.find(x => x.id === row.aid) : null;
    const pct0 = a0.total > 0 ? Math.round(100 * a0.left / a0.total) : 0, behind0 = sum(p0.tests, x => x.behind);
    const raw0 = extra && row.aid ? t.topics.find(x => x.id === row.aid) : null;
    const note = raw0 ? {x: extra, tid: t.id, aid: raw0.id, thMin0: raw0.thMin, thFin0: raw0.thFin ? 1 : 0, base0: JSON.stringify(t.base)} : null;
    let added = null;
    const c1 = mutate(() => {
      added = EN.log(st, {d: T, tid: row.tid, aid: row.aid || null, k: row.k, m: row.m, n: row.n || 0, ts: Date.now(), five: row.five ? 1 : 0});
      if (added && extra === 'fin') EN.setFin(st, row.tid, row.aid, true, T);
      if (added && extra === 'ext') EN.extend(st, row.tid, row.aid, 15, T);
      if (added && T !== T0) EN.stamp(st, T0, true);         // la quota di oggi si rifà con il registro giusto
    });
    if (!added) { toast('Non sono riuscito a segnarlo. Riprova.'); return; }
    // cosa ha accompagnato la riga: «Annulla l'ultima cosa segnata» la disfa insieme a lei
    if (note) { note.ts = added.ts; note.d = added.d; note.thMin1 = raw0.thMin; note.base1 = JSON.stringify(t.base); UNDO.push(note); if (UNDO.length > 20) UNDO.shift(); }
    const a1 = EN.totals(st, t), p1 = EN.plan(st, T0), s1 = p1.tests.find(x => x.id === t.id), b = DA.bossFor(t);
    const hp = a0.left - a1.left + (extra === 'ext' ? a1.total - a0.total : 0);           // il colpo di questa riga (i 15 minuti in più si dicono a parte)
    const top1 = row.aid ? a1.topics.find(x => x.id === row.aid) : null;
    bossFx(t.id, pct0, hp);
    if (hp > 0) tone(PUNCH); else tone(SND.tap);
    // il dispositivo non ha salvato (memoria piena, navigazione privata): niente festa per un blocco che al prossimo avvio non ci sarà
    if (save() === false) {
      showModal(`<div class="mc"><div class="big-emoji" style="font-size:64px">⚠️</div><h2>Questo blocco non è stato salvato</h2><p>Il telefono non riesce a scrivere la partita. Copia la partita da <b>Io → Salva partita</b> prima di chiudere l'app.</p><button class="btn" data-act="close">Ho capito</button></div>`);
      return;
    }
    const r0 = c0.study || {}, r1 = c1.study || {};
    const won = (r1.bosses || 0) > (r0.bosses || 0), early = (r1.early || 0) > (r0.early || 0);
    const nowFull = !p0.today.full && p1.today.full;
    const xp = (r1.xp || 0) > (r0.xp || 0) ? ` +${r1.xp - r0.xp} XP` : '';
    if (T !== T0) toast(`🕛 Segnato su ${fDay(T)}: è lì che l'avevi fatto.`);
    if (extra === 'ext') toast(`💥 −${hp} HP, e altri 15 minuti di teoria nel piano. Onesto: così si impara davvero.`);
    else if (extra === 'fin' && !won) toast(`💡 Teoria chiusa: −${hp} HP a ${b.n}.`);
    else if (!extra && !nowFull) {
      if (hp > 0) toast(a1.left > 0 ? `💥 −${hp} HP a ${b.n}. Ne restano ${a1.left}.${xp}` : `💥 −${hp} HP: ${b.n} è a zero.${xp}`);
      else if (row.k === 'rev') toast(`🔁 Ripasso segnato: ${fMin(added.m)}.${xp}`);
      // esercizi segnati e punti vita fermi (o saliti): il tempo vero per esercizio è più lungo della stima, e il piano l'ha ritoccata
      else if (row.k === 'ex' && top0 && top0.exNLeft > 0) toast(`✔ Segnato: ${plural(added.n, 'esercizio', 'esercizi')}. Ci metti più del previsto: da domani il piano ne tiene conto.`);
      else toast(`✔ Segnato: ${fMin(added.m)}. Qui il boss era già a posto.`);
    }
    if (nowFull) {
      confetti(110, ['⚔️', '💎', '✨']);
      toast(`✅ Quota di oggi fatta: +5 XP e +5 💎${r1.streak >= 2 ? ` · serie ${r1.streak}` : ''}`);
      if (r1.streak > 0 && r1.streak % 5 === 0 && r1.streak !== r0.streak) toast(`⚔️ ${r1.streak} giorni pieni di fila: +15 💎`);
    }
    if (behind0 > 0 && sum(p1.tests, x => x.behind) === 0 && !won) toast('🧗 ' + rot(DA.LINES.comeback, T0).replace(/\{name\}/g, () => plainName()));
    if (top0 && top1 && !top0.closed && top1.closed && a1.left > 0) toast(`✅ «${top1.n}» chiuso: +3 💎`);
    if (won) victory(t, early, s1 ? s1.daysTo : 0);
    else if (row.five && T === T0 && p1.today.left > 0 && p1.today.blocks.length) {
      const nb = p1.today.blocks[0], f = blockInfo(nb);
      showModal(`<div class="mc"><div class="big-emoji pop" style="font-size:72px">🧊</div><h2>Ghiaccio rotto</h2><p>I primi 5 minuti erano i più difficili, e sono fatti.</p>${f ? `<p class="small muted">Il prossimo pezzo: ${f.e} <b>${esc(f.title)}</b>, ${fMin(nb.min)}.</p>` : ''}
        <button class="btn ok" data-act="st-play-next">▶ Già che ci sono, vado avanti</button><button class="btn ghost" data-act="close">Per ora basta così</button></div>`);
    }
  }
  // «Annulla»: la riga tolta era quella di un «l'ho capito» o di un «non ancora»? Allora si disfa anche quello.
  // Restituisce 'fin' / 'ext' se l'ha disfatto, 'left' se non può più (app ricaricata o verifica modificata nel frattempo), null se non c'era niente
  function unExtra(r, T) {
    const t = findT(r.tid), a = t && r.aid ? t.topics.find(x => x.id === r.aid) : null;
    const k = UNDO.findIndex(u => u.ts === r.ts && u.d === r.d && u.tid === r.tid && u.aid === r.aid);
    if (k < 0) return r.k === 'th' && a && (a.thFin || (t.base && t.base.x > 0)) ? 'left' : null;
    const u = UNDO.splice(k, 1)[0];
    if (!a) return null;
    if (u.x === 'fin') { if (a.thFin && !u.thFin0) EN.setFin(S.st, t.id, a.id, false, T); return 'fin'; }
    if (a.thMin !== u.thMin1) return 'left';
    a.thMin = u.thMin0; a.thFin = u.thFin0;
    if (JSON.stringify(t.base) === u.base1) { t.base = JSON.parse(u.base0); EN.stamp(S.st, T, true); }      // niente è cambiato da allora: tutto com'era
    else EN.rebase(S.st, t, T);                                                                              // altrimenti la promessa si rifà sul lavoro di adesso
    if (T !== realDay()) EN.stamp(S.st, realDay(), true);
    return 'ext';
  }

  /* ---------- campi vivi: quello che cambia senza ridisegnare tutto ---------- */
  const LIVE = {
    date() {
      if (!D) return '';
      const T = today();
      if (!EN.isDay(D.date)) return '<span class="dim">Tocca il campo e scegli il giorno.</span>';
      const n = EN.diff(T, D.date);
      if (n <= 0 && !D.id) return '<span class="st-badt">Serve un giorno dopo oggi.</span>';
      if (n > 400) return `<b>${fDay(D.date)} ${D.date.slice(0, 4)}</b> · <span class="st-badt">Troppo lontana: controlla l'anno.</span>`;
      return `<b>${fDay(D.date)}</b> · ${inDays(n)}${n > 0 && n <= S.st.cfg.buffer + 1 ? ' · <span class="st-warnt">è vicinissima</span>' : ''}`;
    },
    ex() { return D ? `${D.t.exN} × ${D.t.exMin} min = <b>${fMin(D.t.exN * D.t.exMin)}</b> di esercizi` : ''; },
    wktot() {
      if (!WK) return '';
      const tot = sum(WK.wk, x => x), h = sum(WK.hw.map((x, i) => WK.wk[i] ? x : 0), x => x);
      return `In una settimana: fino a <b>${fMin(tot)}</b>${h ? `, di cui compiti ${fMin(h)}` : ''}`;
    },
    askhp() {
      const m = M; if (!m) return '';
      if (m.k === 'rev') return m.vMin > 0 ? 'Il ripasso conta per la quota di oggi.' : 'Zero minuti: niente da segnare.';
      if (m.k === 'hw') return m.vMin > 0 ? 'I compiti contano come studio.' : 'Zero minuti: niente da segnare.';
      const t = findT(m.tid), a = t && m.aid ? EN.totals(S.st, t).topics.find(x => x.id === m.aid) : null;
      if (!a) return '';
      const hp = m.k === 'ex' ? Math.min(m.vN, a.exNLeft) * a.perEx : Math.min(m.vMin, a.thLeft);
      if (m.k === 'ex' ? m.vN < 1 : m.vMin < 1) return 'Zero: niente da segnare. Capita.';
      return hp > 0 ? `= <b class="st-badt">−${hp} HP</b> al boss` : 'Questo pezzo era già chiuso: conta per la quota di oggi.';
    },
  };
  const OKF = {
    // oltre i 400 giorni è quasi sempre l'anno sbagliato nella rotella: il piano guarda avanti un anno
    date: () => !!D && EN.isDay(D.date) && (!!D.id || EN.diff(today(), D.date) > 0) && EN.diff(today(), D.date) <= 400,
    hub: () => !!D && D.topics.length > 0,
  };
  function live() {
    document.querySelectorAll('[data-stl]').forEach(el => { const f = LIVE[el.dataset.stl]; if (f) el.innerHTML = f(); });
    document.querySelectorAll('[data-stok]').forEach(el => { const f = OKF[el.dataset.stok]; if (f) el.disabled = !f(); });
  }
  const STP = {
    askm: {get: () => M ? M.vMin : 0, set: v => { if (M) M.vMin = v; }, next: (v, d) => clamp(snap5(v, d), 0, 240), fmt: fMin},
    askn: {get: () => M ? M.vN : 0, set: v => { if (M) M.vN = v; }, next: (v, d) => clamp(v + d, 0, 200), fmt: String},
    wth: {get: () => D.t.thMin, set: v => { D.t.thMin = v; }, next: (v, d) => clamp(snap5(v, d), 5, 600), fmt: fMin},
    wexn: {get: () => D.t.exN, set: v => { D.t.exN = v; }, next: (v, d) => clamp(v + d, 1, 200), fmt: String},
    wexm: {get: () => D.t.exMin, set: v => { D.t.exMin = v; }, next: (v, d) => clamp(v + d, 1, 60), fmt: v => v + ' min'},
    grade: {get: () => G ? G.v : 4, set: v => { if (G) G.v = v; }, next: (v, d) => clamp(Math.round((v + d * .25) * 4) / 4, 1, 6), fmt: gTxt},
    cap: {get: () => S.st.cfg.cap, set: v => { S.st.cfg.cap = v; EN.stamp(S.st, today(), true); save(); }, next: (v, d) => clamp(Math.round((v + d * 15) / 15) * 15, 30, 240), fmt: fMin},
    hwm: {get: () => HWM, set: v => { HWM = v; }, next: (v, d) => clamp(snap5(v, d), 0, 600), fmt: fMin},
  };
  // 4.0: la settimana, giorno per giorno (valori comodi: 40 minuti si raggiunge, 4 ore anche)
  const stepIn = (list, v, d) => d > 0 ? (list.find(x => x > v) ?? list[list.length - 1]) : ([...list].reverse().find(x => x < v) ?? list[0]);
  for (let i = 0; i < 7; i++) {
    STP['wk' + i] = {get: () => wkDraft().wk[i], set: v => { const w = wkDraft(), was = w.wk[i]; w.wk[i] = v; if (w.hw[i] > v) w.hw[i] = stepIn(HWV, v + 1, -1); if (!was !== !v) setTimeout(render, 0); }, next: (v, d) => stepIn(WKV, v, d), fmt: fT};
    STP['hk' + i] = {get: () => wkDraft().hw[i], set: v => { const w = wkDraft(); w.hw[i] = Math.min(v, w.wk[i]); }, next: (v, d) => stepIn(HWV, v, d), fmt: fT};
  }
  function syncStp(key) {
    if (/^wk\d$/.test(key) && STP['hk' + key[2]]) setTimeout(() => syncStp('hk' + key[2]), 0);
    const s = STP[key]; if (!s) return;
    const v = s.get();
    document.querySelectorAll(`[data-stp="${key}"] b`).forEach(b => { b.textContent = s.fmt(v); });
    document.querySelectorAll(`[data-stc="${key}"]`).forEach(c => { c.classList.toggle('on', +c.dataset.v === v); });
    live();
  }
  const FIELD = {
    date: v => { if (D) D.date = EN.isDay(v) ? v : ''; },
    name: v => { if (D) D.name = String(v).slice(0, 60); },
    tn: v => { if (D) D.t.n = String(v).slice(0, 60); },
    note: v => { if (G) G.note = String(v).slice(0, 200); },
    code: v => { IMP.code = String(v).slice(0, 400000); },
    chat: v => { CHT = String(v).slice(0, 300); },
    offa: v => { OFF.a = EN.isDay(v) ? v : ''; },
    offb: v => { OFF.b = EN.isDay(v) ? v : ''; },
  };
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', e => {
      const b = e.target && e.target.closest ? e.target.closest('[data-stq]') : null; if (!b) return;
      e.preventDefault();
      try {
        boot();
        const box = b.closest('[data-stp]'), s = box ? STP[box.dataset.stp] : null; if (!s) return;
        const v = s.get(), nv = s.next(v, +b.dataset.stq > 0 ? 1 : -1);
        if (nv !== v) { s.set(nv); try { tone(SND.tap); } catch (_) {} }
        syncStp(box.dataset.stp);
      } catch (err) { try { console.error('Studio stepper', err); } catch (_) {} }
    });
    const onField = e => {
      const el = e.target && e.target.closest ? e.target.closest('[data-stf]') : null; if (!el) return;
      try { boot(); const f = FIELD[el.dataset.stf]; if (f) { f(el.value); live(); } } catch (err) {}
    };
    document.addEventListener('input', onField);
    document.addEventListener('change', onField);
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || !e.target || !e.target.matches || !e.target.matches('input[data-stf]')) return;
      const b = $id('st-next'); if (b && !b.disabled) { e.preventDefault(); try { e.target.blur(); } catch (_) {} b.click(); }
    });
  }

  /* ---------- azioni ---------- */
  function setCfg(fn) { fn(S.st.cfg); EN.stamp(S.st, today(), true); save(); render(); }
  function quitWizard() { const id = D && D.id; D = null; go(id && findT(id) ? 'test' : 'home', id ? {id} : null); }
  function askManual(b, kinds) {
    M = {src: 'hand', early: false, tid: b.tid, aid: b.aid || null, k: b.k, rev: b.rev || null, five: 0, elapsed: null, vMin: b.k === 'ex' ? 0 : b.min, vN: b.k === 'ex' ? b.n : 0, kinds: kinds || null};
    showModal(askHTML(false));
  }
  function toggleOff(d) {
    const cfg = S.st.cfg, T = today();
    if (!EN.isDay(d) || d < T) return;
    if ((S.st.tests || []).some(t => t.date === d && t.grade == null)) return toast('Quel giorno c\'è una verifica: non si può segnare libero.');
    const was = cfg.off.includes(d), q0 = EN.plan(S.st, T).today.q;
    setCfg(g => { g.off = was ? g.off.filter(x => x !== d) : g.off.concat(d).sort(); });
    const q1 = EN.plan(S.st, T).today.q;
    toast(was ? `${fDay(d)} torna un giorno normale.` : `🏖️ ${fDay(d)} è libero: il piano lo salta.${q1 !== q0 ? ` Oggi: ${fMin(q1)}.` : ''}`);
  }
  const A = {
    'st-tab': el => { S.ui.tab = 'studio'; nav = {scr: el.dataset.scr === 'hist' ? 'hist' : 'home'}; save(); render(); scrollTo(0, 0); },
    'st-go': el => { const scr = el.dataset.scr; if (scr === 'import') IMP = {code: '', list: null, err: ''}; G = null; go(scr, el.dataset.id ? {id: el.dataset.id} : null); },
    'st-open': el => { const t = findT(el.dataset.id); if (!t) return; if (el.dataset.grade) G = null; go('test', {id: t.id, grade: el.dataset.grade ? 1 : 0}); },
    'st-toggle': () => { S.ui.stOn = S.ui.stOn ? 0 : 1; save(); render(); toast(S.ui.stOn ? '📚 Scheda Studio accesa' : 'Scheda Studio spenta'); },

    // lezioni
    'st-l1': () => {
      const old = [...document.querySelectorAll('#st-l1b i')].map(i => i.style.height);
      L.skips = L.skips >= 5 ? 0 : L.skips + 1; render();
      [...document.querySelectorAll('#st-l1b i')].forEach((i, j) => { const h = i.style.height; if (old[j] && old[j] !== h) { i.style.transition = 'none'; i.style.height = old[j]; void i.offsetHeight; i.style.transition = ''; i.style.height = h; } });
      const q = $id('st-l1q'); if (q && L.skips) { q.classList.remove('pop'); void q.offsetWidth; q.classList.add('pop'); }
      if (L.skips >= 5) tone([[196, 0, .14, 'sawtooth', .05], [147, .14, .3, 'sawtooth', .05]]); else if (L.skips) tone([[260 + 70 * L.skips, 0, .12, 'square', .04]]); else tone(SND.tap);
    },
    'st-l2': () => {
      if (walkT) return;
      L.walk = -1; L.walked = false; render();
      const step = () => {
        const tl = $id('st-tl');
        if (!tl || nav.scr !== 'intro' || L.i !== 1) { clearInterval(walkT); walkT = null; return; }
        L.walk++;
        [...tl.children].forEach((d, i) => { d.classList.toggle('on', i === L.walk); d.classList.toggle('seen', i < L.walk); });
        const cap = $id('st-l2c'); if (cap) cap.innerHTML = l2Cap(L.walk);
        tone([[L.walk < 6 ? 520 : L.walk < 8 ? 660 : 880, 0, .07, 'sine', .04]]);
        if (L.walk >= L2.length - 1) { clearInterval(walkT); walkT = null; L.walked = true; setTimeout(() => { if (nav.scr === 'intro' && L.i === 1) render(); }, 700); }
      };
      walkT = setInterval(step, 520); step();
    },
    'st-l3d': el => { const i = +el.dataset.i; if (!(i >= 0 && i < 7)) return; const d = L.days.slice(); d[i] = d[i] ? 0 : 1; if (!d.some(Boolean)) return toast('Almeno un giorno di studio serve.'); L.days = d; tone(SND.tap); render(); },
    'st-l3c': el => { const v = +el.dataset.v; if ([45, 60, 90, 120].includes(v)) { L.cap = v; tone(SND.tap); render(); } },
    'st-l-back': () => { if (walkT) { clearInterval(walkT); walkT = null; } if (L.i > 0) { L.i--; render(); scrollTo(0, 0); } },
    'st-l-next': () => {
      if (walkT) { clearInterval(walkT); walkT = null; }
      if (L.i < DA.INTRO.length - 1) { L.i++; tone(SND.tap); render(); scrollTo(0, 0); return; }
      const first = !S.st.intro;
      S.st.intro = 1; S.st.cfg.days = L.days.map(v => v ? 1 : 0); S.st.cfg.cap = L.cap;
      EN.stamp(S.st, today(), true); save(); L.days = null;
      go('home');
      if (first) { tone(SND.done); confetti(90, ['📚', '⚔️']); toast('📚 Studio è pronto. Metti la prima verifica.'); }
    },
    'st-l-skip': () => { if (walkT) { clearInterval(walkT); walkT = null; } if (!S.st.intro) { S.st.intro = 1; save(); } L.days = null; go('home'); },
    'st-l-redo': () => { introReset(true); go('intro'); },

    // nuova verifica
    'st-new': () => { if (roomLeft() <= 0) return toast(roomMsg()); D = newDraft(); go('new'); },
    'st-edit': el => { const t = findT(el.dataset.id); if (!t) return; D = draftOf(t); go('new'); },
    'st-wz-subj': el => { const v = el.dataset.v; if (!DA.SUBJECTS.some(s => s.k === v)) return; D.subj = v; tone(SND.tap); wzStep(D.quick ? (EN.isDay(D.date) && D.date > today() ? 'qsize' : 'qdate') : 'date'); },
    'st-wz-date': el => { if (!EN.isDay(el.dataset.v)) return; D.date = el.dataset.v; tone(SND.tap); render(); },
    'st-wz-kind': el => { if (!['th', 'ex', 'both'].includes(el.dataset.v)) return; D.t.kind = el.dataset.v; tone(SND.tap); wzStep('tc'); },
    'st-wz-conf': el => {
      const v = +el.dataset.v; if (![1, 2, 3].includes(v)) return;
      // argomento nuovo: la proposta segue la risposta, finché i numeri sono ancora quelli proposti (se li ha cambiati lui restano i suoi)
      if (D.ti < 0) { if (D.t.thMin === SUG.th[D.t.conf]) D.t.thMin = SUG.th[v]; if (D.t.exN === SUG.ex[D.t.conf]) D.t.exN = SUG.ex[v]; }
      D.t.conf = v; tone(SND.tap); wzStep(D.t.kind === 'ex' ? 'te' : 'tt');
    },
    'st-wz-sheet': el => { D.sheet = el.dataset.v === '1'; tone(SND.tap); wzStep('sum'); },
    'st-wz-add': () => { if (D.topics.length >= 12) return; D.t = newTopic(); D.ti = -1; wzStep('tn'); },
    'st-wz-tedit': el => { const i = +el.dataset.i, a = D.topics[i]; if (!a) return; D.t = Object.assign({}, a); D.ti = i; wzStep('tn'); },
    'st-wz-tdel': el => { const i = +el.dataset.i; if (!D.topics[i]) return; D.topics.splice(i, 1); render(); },
    'st-wz-hub': () => wzStep('hub'),
    'st-wz-cap': el => { const v = +el.dataset.v; if (!(v >= 30 && v <= 240)) return; S.st.cfg.cap = v; EN.stamp(S.st, today(), true); save(); render(); toast(`Tetto al giorno: ${fMin(v)}.`); },
    'st-wz-back': () => {
      const s = D.step;
      if (s === 'subj') return A['st-wz-quit']();
      if (s === 'tn') { const edit = D.ti >= 0; D.t = newTopic(); D.ti = -1; return wzStep(edit || D.topics.length ? 'hub' : 'date'); }
      if (s === 'te') return wzStep(D.t.kind === 'both' ? 'tt' : 'tc');
      wzStep(WZ_BACK[s] || 'subj');
    },
    'st-wz-next': () => {
      const s = D.step;
      if (s === 'qdate') { if (!OKF.date()) return toast(EN.isDay(D.date) && EN.diff(today(), D.date) > 400 ? "Data troppo lontana: controlla l'anno." : 'Scegli il giorno della verifica.'); return wzStep('qsize'); }
      if (s === 'date') { if (!OKF.date()) return toast(EN.isDay(D.date) && EN.diff(today(), D.date) > 400 ? 'Data troppo lontana: controlla l\'anno.' : 'Scegli il giorno della verifica.'); D.name = D.name.trim(); return wzStep(D.topics.length ? 'hub' : 'tn'); }
      if (s === 'tn') return wzStep('tk');
      if (s === 'tt') { if (D.t.kind === 'both') return wzStep('te'); commitTopic(); return wzStep('hub'); }
      if (s === 'te') { commitTopic(); return wzStep('hub'); }
      if (s === 'hub') { if (!D.topics.length) return toast('Metti almeno un argomento.'); return wzStep('sheet'); }
      if (s === 'sum') return A['st-wz-save']();
    },
    'st-wz-save': () => {
      const T = today(), st = S.st, id = D.id;
      let test = null;
      mutate(() => {
        if (id) { test = findT(id); if (test) { applyDraft(st, test); if (!EN.rebase(st, test, T)) test = null; } }
        else test = EN.newTest(st, T, draftData());
      });
      if (!test) return toast(!id && roomLeft() <= 0 ? roomMsg() : 'Non sono riuscito a salvarla: controlla la data.');
      D = null;
      const b = DA.bossFor(test), tot = EN.totals(st, test);
      go('home');
      if (id) toast('Piano rifatto ✓');
      else {
        tone(SND.boss); confetti(120, [b.e, '⚔️']);
        const q = EN.plan(st, T).today.q;
        toast(`⚔️ ${b.n} è in campo.${q > 0 ? ` Oggi di studio: ${fMin(q)}.` : ''}`);
      }
    },
    'st-wz-quit': () => {
      if (D && !D.id && (D.topics.length || D.step !== 'subj')) return showModal(`<div class="mc"><h2>Lascio perdere questa verifica?</h2><p class="small muted">Quello che hai scritto fin qui non viene salvato.</p><button class="btn" data-act="st-wz-quitok">Sì, esco</button><button class="btn ghost" data-act="close">No, continuo</button></div>`);
      quitWizard();
    },
    'st-wz-quitok': () => { closeModal(); quitWizard(); },

    // 4.0 · verifica veloce
    'st-quick': el => {
      if (roomLeft() <= 0) return toast(roomMsg());
      const d = el.dataset.d; if (modalOpen()) closeModal();
      D = newDraft(); D.quick = true; if (EN.isDay(d) && d > today()) D.date = d;
      go('new');
    },
    'st-q-date': el => { if (!EN.isDay(el.dataset.v)) return; D.date = el.dataset.v; tone(SND.tap); wzStep('qsize'); },
    'st-q-size': el => { const v = el.dataset.v; if (!own(SIZE, v) || !D) return; D.topics = quickTopics(D.subj, v); D.sheet = false; tone(SND.tap); A['st-wz-save'](); },
    'st-q-detail': () => { D.quick = false; D.topics = []; D.t = newTopic(); D.ti = -1; wzStep('tn'); },

    // 4.0 · la domanda del giorno
    'st-ck-av': el => { const v = +el.dataset.v; if (!(v >= 0 && v <= 240)) return; const k = ckDraft(today()); k.av = v; if (k.hw > v) k.hw = 0; tone(SND.tap); render(); },
    'st-ck-hw': el => { const v = +el.dataset.v; if (!(v >= 0 && v <= 240)) return; ckDraft(today()).hw = v; tone(SND.tap); render(); },
    'st-ck-ok': () => {
      const T = today(), k = ckDraft(T);
      mutate(() => { EN.setDay(S.st, T, T, {av: k.av, hw: Math.min(k.hw, k.av)}); });
      CK = null; tone(SND.done); scrollTo(0, 0);
      const p = planOf(S.st, T);
      toast(k.av === 0 ? '😴 Ok, oggi riposo.' : p.today.full ? '✅ Oggi sei già a posto.' : `✅ Piano fatto: ${fMin(p.today.q + (p.today.hw || 0))} oggi, un pezzo alla volta.`);
    },
    'st-ck-redo': () => { const T = today(); CK = null; mutate(() => { EN.setDay(S.st, T, T, {av: null}); }); go('home'); },

    // 4.0 · la settimana
    'st-wk-save': () => {
      const w = wkDraft(), T = today(), first = !hasWeek();
      if (!w.wk.some(v => v > 0)) return toast('Almeno un giorno con un po\' di tempo serve.');
      let ok = false;
      mutate(() => { ok = EN.setWeek(S.st, T, w.wk, w.hw.map((h, i) => w.wk[i] ? h : 0)); });
      if (!ok) return toast('Non sono riuscito a salvarla. Riprova.');
      WK = null; tone(SND.done);
      go('home');
      toast(first ? '⏱️ Fatto! Da adesso ogni giorno ti chiedo solo quanto tempo hai.' : '⏱️ Settimana salvata: il piano è rifatto.');
    },
    'st-wk-later': () => { wkLater = true; WK = null; go('home'); },
    'st-home-set': el => { const v = el.dataset.v; if (v !== 'full' && v !== 'today') return; S.ui.stHome = v === 'full' ? 'full' : undefined; if (!S.ui.stHome) delete S.ui.stHome; save(); tone(SND.tap); render(); },
    'st-use-sun': () => {
      const p0 = planOf(S.st, today()), d = useSunday();
      if (!d) return toast('Non trovo una domenica libera nei prossimi giorni.');
      const p1 = planOf(S.st, today());
      toast(`☂️ ${cap1(dayName(d))}: 1 h, solo per stavolta.${p1.overload < p0.overload ? ` Mancano ${p1.overload ? fMin(p1.overload) : 'zero minuti'}.` : ''}`);
    },

    // 4.0 · il calendario
    'st-cal-day': el => { const d = el.dataset.d; if (!EN.isDay(d) || d < today()) return; showModal(dayHTML(d)); },
    'st-day-av': el => { const d = el.dataset.d, v = el.dataset.v; if (!EN.isDay(d) || d < today()) return; mutate(() => { EN.setDay(S.st, today(), d, {av: v === '' ? null : +v}); }); tone(SND.tap); refreshDay(d); },
    'st-day-hw': el => { const d = el.dataset.d, v = el.dataset.v; if (!EN.isDay(d) || d < today()) return; mutate(() => { EN.setDay(S.st, today(), d, {hw: v === '' ? null : +v}); }); tone(SND.tap); refreshDay(d); },
    'st-day-off': el => { const d = el.dataset.d; if (!EN.isDay(d)) return; toggleOff(d); refreshDay(d); },

    // 4.0 · i compiti
    'st-hw-play': () => hwPlay(),
    'st-hw-done': () => hwModal(),
    'st-hw-ok': () => { closeModal(); hwHit(HWM, today(), false); },

    // 4.0 · il coach
    'st-chat-send': () => {
      const el = $id('st-chat-in'), text = String((el && el.value) || CHT || '').trim().slice(0, 300);
      if (!text) return;
      CHT = ''; me(text); respond(text);
      if (nav.scr === 'chat') { render(); chatEnd(); }
    },
    'st-chat-chip': el => {
      const x = CHIPS[+el.dataset.i]; if (!x) return;
      tone(SND.tap); chipDo(x);
      if (nav.scr === 'chat' && !modalOpen()) { render(); chatEnd(); }
    },

    // steppers a chip (aggiornano sul posto)
    'st-set': el => { const s = STP[el.dataset.k], v = +el.dataset.v; if (!s || !Number.isFinite(v)) return; s.set(v); tone(SND.tap); syncStp(el.dataset.k); },

    // oggi
    'st-play': el => { const b = BL[+el.dataset.i]; if (b) startTimer(b, false); },
    'st-play-next': () => { closeModal(); const b = EN.plan(S.st, today()).today.blocks[0]; if (b) startTimer(b, false); },
    'st-hand': el => { const b = BL[+el.dataset.i]; if (b) askManual(b); },
    'st-tplay': el => { const t = findT(el.dataset.tid), b = t ? topicBlock(t, el.dataset.aid) : null; if (b) startTimer(b, false); },
    'st-more': el => {
      const t = findT(el.dataset.tid); if (!t) return;
      if (el.dataset.k === 'rev') { const s = EN.plan(S.st, today()).tests.find(x => x.id === t.id); return askManual({tid: t.id, aid: null, k: 'rev', rev: null, min: s ? s.reviewMin : 15, n: 0}); }
      const a = EN.totals(S.st, t).topics.find(x => x.id === el.dataset.aid), b = a ? topicBlock(t, a.id) : null; if (!b) return;
      askManual(b, a.kind === 'both' ? ['th', 'ex'].filter(k => k === 'th' ? a.thLeft > 0 : a.exNLeft > 0) : null);
    },
    'st-nowill': () => {
      const b = BL[0], pool = DA.NOWILL;
      const pref = b && b.k === 'ex' ? 3 : b && b.k === 'rev' ? 7 : 0;
      const tip = pool[(pref + nwI) % pool.length];
      showModal(`<div class="mc"><div class="big-emoji" style="font-size:72px">${tip.e}</div><h2>${esc(tip.t)}</h2><p>${esc(tip.x)}</p>
        <button class="btn gold big" data-act="st-five">⏱️ Solo 5 minuti</button>
        <p class="small dim">Timer da 5. Allo squillo decidi tu: se smetti, hai comunque rotto il ghiaccio.</p>
        <button class="btn ghost" data-act="st-nowill-next">Un altro consiglio</button><button class="link" data-act="close">Chiudi</button></div>`);
    },
    'st-nowill-next': () => { nwI++; closeModal(); A['st-nowill'](); },
    'st-five': () => { closeModal(); const b = BL[0] || EN.plan(S.st, today()).today.blocks[0]; if (b) startTimer(b, true); },
    'st-undo': () => {
      const T = today(); let r = null, back = null;
      mutate(() => { r = EN.undo(S.st, T); if (r) back = unExtra(r, T); });
      toast(!r ? 'Niente da annullare.' : back === 'ext' ? 'Tolta, e con lei i 15 minuti di teoria in più.' : back === 'fin' ? 'Tolta. La teoria è di nuovo aperta.'
        : back === 'left' ? 'Tolta. «Capito» o i minuti in più di teoria restano: li cambi dalla scheda della verifica.' : 'Tolta. Nessun problema.');
    },
    'st-off': el => toggleOff(el.dataset.d),

    // timer
    'st-tm-stop': () => {
      const tm = S.ui.stTimer; if (!validTimer(tm)) { delete S.ui.stTimer; save(); closeModal(); return; }
      tm.end = Date.now(); save(); M = askFromTimer(tm); wakeOff();
      const m = $id('modal'); if (m) m.innerHTML = askHTML(true);
    },
    'st-tm-cancel': () => { delete S.ui.stTimer; M = null; save(); wakeOff(); closeModal(); toast('Timer annullato: non ho segnato niente.'); },
    'st-ask-k': el => { if (!M || !M.kinds || !M.kinds.includes(el.dataset.v)) return; const t = findT(M.tid), b = t ? topicBlock(t, M.aid, el.dataset.v) : null; if (!b) return; M.k = b.k; M.vMin = b.k === 'ex' ? 0 : b.min; M.vN = b.k === 'ex' ? b.n : 0; const m = $id('modal'); if (m) m.innerHTML = askHTML(false); },
    'st-ask-no': () => { const tm = M && M.src === 'timer'; M = null; if (tm) { delete S.ui.stTimer; save(); } closeModal(); if (tm) toast('Niente segnato. Va bene così.'); },
    'st-ask-ok': () => {
      const m = M; if (!m) return closeModal();
      const row = {tid: m.tid, aid: m.aid, k: m.k, five: m.five, n: m.k === 'ex' ? m.vN : 0, m: m.k === 'ex' ? (m.src === 'timer' ? Math.max(1, m.elapsed) : 0) : m.vMin};
      if (m.k === 'ex' ? row.n < 1 : row.m < 1) return toast('Zero non si segna: metti quello che hai fatto, o annulla.');
      if (m.k === 'hw') { M = null; closeModal(); return hwHit(row.m, m.src === 'timer' ? m.d : null, true); }
      if (m.src === 'timer' && EN.isDay(m.d)) row.d = m.d;      // il blocco è del giorno in cui è partito il timer, anche se risponde dopo mezzanotte
      row.timer = m.src === 'timer';                 // il timer si toglie solo quando la riga è scritta: se chiude l'app a metà, la domanda torna
      const end = endsTheory(row);
      M = null;
      closeModal();
      if (end) askCapito(row, end); else hit(row);
    },

    // l'ho capito / non ancora
    'st-fin': el => {
      const t = findT(el.dataset.tid), aid = el.dataset.aid, on = el.dataset.v === '1'; if (!t) return;
      const T = today(), c0 = calc(), a0 = EN.totals(S.st, t), pct0 = a0.total > 0 ? Math.round(100 * a0.left / a0.total) : 0;
      let ok = false;
      const c1 = mutate(() => { ok = EN.setFin(S.st, t.id, aid, on, T); });
      if (!ok) return;
      const a1 = EN.totals(S.st, t), hp = a0.left - a1.left;
      if (on) { bossFx(t.id, pct0, hp); tone(hp > 0 ? PUNCH : SND.tap); toast(hp > 0 ? `💡 Capito: teoria chiusa, −${hp} HP.` : '💡 Teoria chiusa.'); }
      else toast('Teoria riaperta: il piano si rifà.');
      if ((c1.study && c1.study.bosses || 0) > (c0.study && c0.study.bosses || 0)) { const s = EN.plan(S.st, T).tests.find(x => x.id === t.id); victory(t, (c1.study.early || 0) > (c0.study.early || 0), s ? s.daysTo : 0); }
    },
    'st-fin-yes': () => { const row = PEND; PEND = null; closeModal(); if (row) hit(row, 'fin'); },
    'st-fin-no': () => { const row = PEND; PEND = null; closeModal(); if (row) hit(row, 'ext'); },

    // scheda verifica
    'st-del': el => { const t = findT(el.dataset.id); if (!t) return; showModal(`<div class="mc"><h2>Cancello «${esc(tTitle(t))}»?</h2><p class="small muted">Spariscono la verifica e il suo registro. XP e gemme guadagnati con quei blocchi tornano indietro.</p><button class="btn" style="background:var(--bad);box-shadow:0 5px 0 #b02a48" data-act="st-delok" data-id="${esc(t.id)}">Sì, cancella</button><button class="btn ghost" data-act="close">No</button></div>`); },
    'st-delok': el => { const id = el.dataset.id; closeModal(); nav = {scr: 'home'}; mutate(() => { EN.removeTest(S.st, id, today()); }); scrollTo(0, 0); toast('Verifica cancellata.'); },
    'st-share': async el => {
      const t = findT(el.dataset.id); if (!t) return;
      const code = EN.encode({tests: [t]}), again = !!el.dataset.again;
      const ok = await copyText(code, '📤 Codice copiato: mandalo a un compagno. Lui lo incolla in Studio → 📥 Ho un codice.');
      if (ok) { if (again) closeModal(); return; }
      if (again) return toast('Ancora niente. Tieni premuto sul codice e scegli Copia.');
      // la copia non è passata: il codice si mostra. Su iPhone select() non seleziona un campo readonly: serve setSelectionRange
      showModal(`<div class="mc left"><h2>📤 Il codice</h2><p class="small muted">Copialo e mandalo a un compagno: lo incolla in Studio → 📥 Ho un codice. Dentro ci sono solo materia, data e argomenti.</p><textarea class="txt" id="st-codeout" readonly onclick="this.focus();this.setSelectionRange(0,this.value.length)">${esc(code)}</textarea><button class="btn" data-act="st-share" data-id="${esc(t.id)}" data-again="1">📋 Riprova a copiare</button><button class="btn ghost" data-act="close">Chiudi</button></div>`);
    },
    'st-feel': el => { if (!G) return; const v = +el.dataset.v; G.feel = G.feel === v ? null : v; document.querySelectorAll('[data-act="st-feel"]').forEach(b => { const o = +b.dataset.v === G.feel; b.classList.toggle('on', o); b.setAttribute('aria-pressed', o); }); tone(SND.tap); },
    'st-grade-ok': el => {
      const t = findT(el.dataset.id); if (!t || !G || G.id !== t.id) return;
      const T = realDay(), first = t.grade == null, v = clamp(Math.round(G.v * 4) / 4, 1, 6), g = G;
      mutate(() => { t.grade = v; t.gradeD = t.gradeD && !first ? t.gradeD : (T < t.date ? t.date : T); t.feel = g.feel || null; t.note = (g.note || '').trim().slice(0, 200); EN.stamp(S.st, today(), true); });
      G = null; nav = {scr: 'test', id: t.id, grade: 0}; render(); scrollTo(0, 0);
      const s = EN.plan(S.st, today()).tests.find(x => x.id === t.id), pct = s ? s.pct : 0, ex = exInsight(t);
      if (first) { tone(SND.chest); confetti(70, ['📝', '💎']); }
      showModal(`<div class="mc"><div class="big-emoji pop" style="font-size:72px">📝</div><h2>Nota segnata</h2>
        <div class="st-cmp"><div class="stat"><b>${pct} %</b><span>PIANO FATTO</span></div><div class="st-arrow">→</div><div class="stat"><b>${gTxt(v)}</b><span>NOTA</span></div></div>
        <p>${insight(pct, v)}</p>${ex ? `<p class="small muted">${ex}</p>` : ''}
        <p class="small dim">${first ? '+10 💎 per averla segnata. ' : ''}Qui si premia il lavoro, non la nota.</p><button class="btn gold" data-act="close">Ok</button></div>`);
    },

    // impostazioni
    'st-cfg-day': el => { const i = +el.dataset.i; if (!(i >= 0 && i < 7)) return; const d = S.st.cfg.days.slice(); d[i] = d[i] ? 0 : 1; if (!d.some(Boolean)) return toast('Almeno un giorno di studio serve.'); setCfg(g => { g.days = d; }); tone(SND.tap); },
    'st-cfg-set': el => { const k = el.dataset.k, v = +el.dataset.v; if (k === 'block' && [15, 20, 25, 30, 45].includes(v)) setCfg(g => { g.block = v; }); else if (k === 'buffer' && [0, 1, 2, 3].includes(v)) setCfg(g => { g.buffer = v; }); else return; tone(SND.tap); },
    'st-off-add': () => {
      const T = today(), a = OFF.a, b = OFF.b && OFF.b >= a ? OFF.b : a;
      if (!EN.isDay(a) || a < T) return toast('Scegli il primo giorno libero (da oggi in poi).');
      const n = EN.diff(a, b) + 1; if (n > 60) return toast('Al massimo 60 giorni alla volta.');
      const tests = new Set(S.st.tests.filter(t => t.grade == null).map(t => t.date)), add = [];
      for (let i = 0; i < n; i++) { const d = EN.addD(a, i); if (!tests.has(d) && !S.st.cfg.off.includes(d)) add.push(d); }
      OFF = {a: '', b: ''};
      setCfg(g => { g.off = g.off.concat(add).sort(); });
      toast(add.length ? `🏖️ ${plural(add.length, 'giorno libero segnato', 'giorni liberi segnati')}: il piano li salta.` : 'Quei giorni erano già liberi.');
    },

    // importa
    'st-imp-read': () => {
      const el = $id('st-code'); if (el) IMP.code = el.value;
      try { IMP.list = EN.decode(IMP.code).tests; IMP.err = ''; tone(SND.tap); }
      catch (e) { IMP.list = null; IMP.err = !IMP.code.trim() ? 'Incolla prima il codice.' : String(e && e.message || 'Codice non valido.'); }
      render(); scrollTo(0, 0);
    },
    'st-imp-reset': () => { IMP = {code: '', list: null, err: ''}; render(); },
    'st-imp-add': () => {
      // entrano solo quelle che l'anteprima ha promesso (stessa lista: niente passate, vuote, doppioni, né oltre il posto rimasto)
      const T = today(), rows = impRows(T), list = rows.filter(x => x.good).map(x => x.t), full = roomLeft() <= 0;
      let n = 0;
      mutate(() => { n = EN.importTests(S.st, list, T); });
      IMP = {code: '', list: null, err: ''};
      go('home');
      if (n) { tone(SND.boss); confetti(100, ['👾', '⚔️']); toast(`⚔️ ${plural(n, 'boss nuovo in campo', 'boss nuovi in campo')}. Il piano è rifatto.`); }
      if (n < list.length) toast(`⚠️ ${n ? `Ne sono entrate ${n} su ${list.length}` : 'Non ne è entrata nessuna'}: ${roomLeft() <= 0 ? 'non c\'è più posto.' : 'controlla le date nel codice.'}`);
      else if (!n) toast(full ? `Non c'è più posto. ${roomMsg()}` : rows.some(x => x.why === 'dup') ? 'Niente di nuovo: quelle verifiche sono già presenti.' : 'Niente di nuovo da aggiungere.');
    },
  };
  const actions = {};
  for (const k of Object.keys(A)) {
    actions[k] = el => {
      try { boot(); const r = A[k](el && el.dataset ? el : {dataset: {}}); if (r && typeof r.catch === 'function') r.catch(() => {}); }
      catch (e) {
        try { console.error('Studio ' + k, e); } catch (_) {}
        try { toast('⚠️ Qui qualcosa non ha funzionato. Riprova.'); } catch (_) {}
      }
    };
  }

  /* ---------- stile (solo le variabili di Level Up: funziona con tutti i temi) ---------- */
  const CSS = `
.st-say{display:flex; align-items:flex-end; gap:12px; margin:14px 0 6px}
.st-bud{flex:none; width:68px; text-align:center; padding-top:20px}
.st-bud .buddy{font-size:60px}
.st-bud .buddy .hat{font-size:26px; top:-17px}
.st-bud .buddy::before{inset:-9px !important}
.st-sb{position:relative; flex:1; min-width:0; background:#fff; color:#1b1640; border-radius:18px; padding:11px 14px; font-weight:700; font-size:1.04rem; line-height:1.3; box-shadow:0 4px 0 rgba(0,0,0,.28); overflow-wrap:anywhere; margin-bottom:8px}
.st-sb::before{content:''; position:absolute; left:-9px; bottom:16px; border:9px solid transparent; border-left:0; border-right-color:#fff}
.st-back{display:inline-block; margin:6px 0 -6px; padding:10px 4px}
.st-hd{font-size:1.5rem; font-weight:800; line-height:1.1; margin:2px 0 3px}
.st-num{font-size:3rem; font-weight:800; line-height:1.05; font-variant-numeric:tabular-nums}
.st-num.warn,.st-warnt{color:var(--gold)} .st-num.bad,.st-badt{color:var(--bad)}
.st-ctr{justify-content:center} .st-ctr .chip{min-width:44px; justify-content:center}
.lesson{max-width:100%; overflow-wrap:anywhere}
.st-live{margin:10px 2px; min-height:1.4em; line-height:1.3}
.st-sm{display:block; font-size:.8rem; font-weight:700; opacity:.78; margin-top:2px}
.st-ring{position:relative; width:104px; height:104px; flex:none}
.st-ring svg{width:100%; height:100%; display:block}
.st-ring circle{fill:none; stroke-width:10; stroke-linecap:round}
.st-ring .t{stroke:var(--bg2)} .st-ring .p{stroke:var(--acc); transition:stroke-dashoffset .6s}
.st-ring.full .p{stroke:var(--ok)} .st-ring.soft .p{stroke:var(--blue)}
.st-ring .c{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; line-height:1}
.st-ring .c b{font-size:2.1rem; font-variant-numeric:tabular-nums} .st-ring .c b i{font-style:normal; font-size:1.1rem; margin:0 1px}
.st-ring .c span{font-size:.72rem; color:var(--dim); font-weight:800; margin-top:3px; text-transform:uppercase; letter-spacing:.05em}
.st-ring.full .c b{color:var(--ok)}
.st-note{margin-top:12px; background:var(--bg2); border:2px solid var(--line); border-radius:14px; padding:9px 12px; font-weight:700; line-height:1.3}
.st-note b{color:var(--gold)}
.st-note.warn{background:rgba(255,194,61,.12); border-color:rgba(255,194,61,.55)}
.st-note.bad{background:rgba(255,90,122,.13); border-color:var(--bad)} .st-note.bad b{color:var(--text)}
.st-note.ok{background:rgba(61,220,132,.13); border-color:var(--ok)} .st-note.ok b{color:var(--text)}
.st-ul{margin:6px 0 0; padding-left:1.2em; font-weight:700} .st-ul li{margin:.2em 0}
.st-blocks{display:flex; flex-direction:column; gap:8px; margin-top:12px}
.st-blk,.st-trow{display:flex; align-items:center; gap:8px; background:var(--card2); border:2px solid var(--line); border-radius:14px; padding:8px 8px 8px 10px; min-height:64px; box-shadow:0 3px 0 rgba(0,0,0,.25)}
.st-blk .xe{font-size:1.6rem; width:32px; text-align:center; line-height:1; flex:none}
.st-blk b,.st-trow b{display:block; font-size:1.05rem; line-height:1.15; overflow-wrap:anywhere}
.st-blk small{display:block; font-size:.7rem; color:var(--dim); font-weight:800; text-transform:uppercase; letter-spacing:.04em; margin-top:3px; line-height:1.25}
.st-ib{flex:none; width:48px; height:48px; border-radius:14px; border:2px solid var(--line); background:var(--card); color:var(--text); font:inherit; font-size:1.2rem; font-weight:800; cursor:pointer; touch-action:manipulation; box-shadow:0 3px 0 rgba(0,0,0,.25); padding:0}
.st-ib.go{background:var(--ok); border-color:var(--ok); color:#04260f; box-shadow:0 3px 0 var(--ok-d)}
.st-ib:active{transform:translateY(2px); box-shadow:none}
.st-blk small.st-of{white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-transform:none; letter-spacing:0; font-size:.76rem}
.st-nw{white-space:nowrap} .st-trow .small b{display:inline; font-size:inherit}
.st-ke{display:none; font-style:normal}
.st-trow{margin-bottom:8px} .st-tot{text-align:right; margin-top:4px; color:var(--muted)}
.st-boss{display:block; width:100%; text-align:left; font:inherit; color:inherit; cursor:pointer; touch-action:manipulation}
.st-boss .row,.st-boss .st-hpw,.st-boss .st-foot{display:flex}
.st-boss .label,.st-bn,.st-bl{display:block}
.st-mon{font-size:54px; line-height:1.05; flex:none; display:inline-block; filter:drop-shadow(0 5px 0 rgba(0,0,0,.25))}
.st-mon.big{font-size:88px}
.st-boss.dead .st-mon,.st-mon.dead{filter:grayscale(1); opacity:.55; transform:rotate(90deg)}
.st-bn{font-size:1.25rem; line-height:1.15; overflow-wrap:anywhere}
.st-go{font-size:1.8rem; color:var(--dim); font-weight:800; flex:none}
.st-taunt{display:block; font-style:italic; margin-top:4px; line-height:1.25; overflow-wrap:anywhere}
.st-prize{display:block; margin-top:8px; line-height:1.3}
.st-work{background:var(--bg2); border-radius:12px; padding:8px 12px; margin:8px 0 4px; line-height:1.3}
/* la vittoria deve stare in uno schermo piccolo senza scorrere: mostro e titolo più raccolti */
.st-win{padding-top:16px; padding-bottom:16px} .st-win .big-emoji{font-size:72px} .st-win .lvup{font-size:clamp(1.55rem,8.4vw,2.4rem); white-space:nowrap} .st-win h2{margin:.15em 0 .2em} .st-win p{margin:.35em 0} .st-win .donebox{padding:9px; margin-top:8px; font-size:1.02rem} .st-win .btn{margin-top:10px}
.st-hpw{display:flex; align-items:center; gap:10px; margin-top:12px}
.st-hp{flex:1; min-width:0; height:16px; border-radius:99px; background:var(--bg2); border:2px solid var(--line); overflow:hidden; display:block}
.st-hp i{display:block; height:100%; border-radius:99px; background:linear-gradient(90deg,var(--bad),var(--fire)); transition:width .7s cubic-bezier(.2,.9,.3,1)}
.st-hpt{font-weight:800; font-size:.9rem; white-space:nowrap; font-variant-numeric:tabular-nums}
.st-foot{display:flex; align-items:center; gap:6px 10px; flex-wrap:wrap; margin-top:10px; line-height:1.3}
.st-tag{display:inline-block; font-size:.78rem; font-weight:800; padding:3px 10px; border-radius:99px; background:var(--bg2); color:var(--muted); white-space:nowrap; flex:none}
.st-tag.ok{background:rgba(61,220,132,.18); color:var(--ok)} .st-tag.warn{background:rgba(255,194,61,.2); color:var(--gold)} .st-tag.bad{background:rgba(255,90,122,.2); color:var(--bad)} .st-tag.blue{background:rgba(76,195,255,.2); color:var(--blue)} .st-tag.gold{background:var(--gold); color:#2a1d00}
.st-up{color:var(--gold); font-weight:800} .st-down{color:var(--ok); font-weight:800}
.st-hero h2{margin:.15em 0 .1em; overflow-wrap:anywhere}
.st-3{margin-top:12px} .st-3 .stat b{font-size:1.2rem; white-space:nowrap}
.st-td{border-color:var(--gold)} .st-wait{border-color:var(--blue)}
.st-tips{font-weight:700; padding-left:1.25em} .st-tips li{margin:.45em 0; line-height:1.3}
@keyframes st-hit{0%,100%{transform:translateX(0) rotate(0)}15%{transform:translateX(-10px) rotate(-1.5deg)}30%{transform:translateX(9px) rotate(1.5deg)}45%{transform:translateX(-7px)}60%{transform:translateX(5px)}80%{transform:translateX(-2px)}}
.st-hit{animation:st-hit .55s ease-in-out; border-color:var(--bad) !important}
.st-ko{filter:grayscale(1); transform:rotate(90deg)}
.st-mapc{padding-left:6px; padding-right:6px} .st-mapc>b:first-child,.st-mapc>.small,.st-mapc>.legend{margin-left:6px; margin-right:6px}
.st-map{display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:3px; margin-top:10px}
.st-map .h{text-align:center; font-size:.72rem; font-weight:800; color:var(--dim)}
.st-c{position:relative; min-height:48px; border-radius:10px; border:2px solid var(--line); background:var(--bg2); color:var(--text); font:inherit; padding:0; margin:0; display:flex; flex-direction:column; align-items:center; justify-content:center; line-height:1; min-width:0; overflow:hidden}
button.st-c{cursor:pointer; touch-action:manipulation}
.st-c::before{content:''; position:absolute; inset:0; background:var(--acc); opacity:0}
.st-c>*{position:relative}
.st-c small{font-size:.64rem; font-weight:800; color:var(--dim)}
.st-c b{font-size:.84rem; margin-top:4px; white-space:nowrap; min-height:.84rem}
.st-c.l1::before{opacity:.2} .st-c.l2::before{opacity:.36} .st-c.l3::before{opacity:.52} .st-c.l4::before{opacity:.85}
.st-c.l4 b,.st-c.l4 small{color:var(--on-acc)}
.st-c.rev::before{background:var(--blue)} .st-c.rev.l4 b,.st-c.rev.l4 small{color:#012}
.st-c.rush::before{background:var(--bad)} .st-c.rush{border-color:var(--bad)}
.st-c.test{border-color:var(--gold)} .st-c.test::before{background:var(--gold); opacity:.22} .st-c.test b{font-size:1.15rem; margin-top:2px}
.st-c.off{background:repeating-linear-gradient(45deg,var(--bg2) 0 6px,var(--card2) 6px 12px)}
.st-c.cush b,.st-c.free b{opacity:.75}
.st-c.past{opacity:.45; border-style:dotted} .st-c.past.full{opacity:.85; border-color:var(--ok); border-style:solid} .st-c.past.full b{color:var(--ok)}
.st-c.far{visibility:hidden}
.st-c.past.miss{border-color:var(--bad); border-style:solid} .st-c.past.miss b{color:var(--bad)}
.st-c.now{border-style:dashed; border-color:#fff}
.st-leg i.s,.st-tl .d.s i{background:var(--acc)} .st-leg i.r{background:var(--blue)} .st-leg i.v{background:var(--gold)}
.st-grid2{display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px}
.st-grid2 .btn{margin:0; font-size:1rem; padding:12px 6px; min-height:52px}
.st-btns{display:flex; gap:8px; margin-top:10px}
.st-btns .btn{margin:0; padding:8px 4px; font-size:.95rem; min-height:46px; flex:1; min-width:0}
.st-top{padding:12px 0; border-bottom:2px solid var(--line)} .st-top:last-of-type{border-bottom:0}
.st-top .xe{font-size:1.6rem; width:34px; text-align:center; flex:none}
.st-top .hbar{margin-top:3px} .st-top .hbar.ex i{background:linear-gradient(90deg,var(--gold),var(--fire))}
.st-pl{display:flex; justify-content:space-between; gap:8px; margin-top:8px; font-weight:700; color:var(--muted)}
.st-subj{display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:6px}
.st-subj .chip{margin:0; width:100%; min-height:52px}
.st-days{display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:3px; margin:10px -8px 2px}
.st-days .chip{margin:0; padding:9px 0; justify-content:center; font-size:.85rem; white-space:nowrap; min-width:0; min-height:48px}
.st-date{min-height:54px; -webkit-appearance:none; appearance:none; text-align:left; display:block}
.st-two{display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px} .st-two label{display:block; font-weight:700; min-width:0} .st-two .txt{padding:10px 8px; font-size:1rem}
.st-stp b{min-width:128px} .st-stp button{touch-action:manipulation; color:var(--text)}
.st-sum{display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:14px 0 4px}
.st-sum .stat b{font-size:1.45rem; white-space:nowrap}
.st-spark{display:flex; align-items:flex-end; gap:2px; height:64px; margin-top:12px}
.st-spark i{flex:1; min-width:0; border-radius:4px 4px 2px 2px; background:var(--acc); display:block}
.st-spark i.r{background:var(--blue)} .st-spark i.x{background:var(--bad)} .st-spark i.z{background:var(--line); height:4px} .st-spark i.v{background:var(--gold); flex:0 0 6px; border-radius:3px}
.st-bars{display:flex; align-items:flex-end; gap:6px; height:196px; margin:10px 0 6px}
.st-bars .b{flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%}
.st-bars .b i{display:block; width:100%; border-radius:10px 10px 4px 4px; background:linear-gradient(180deg,var(--blue),var(--acc)); transition:height .55s cubic-bezier(.2,1.3,.4,1); box-shadow:0 3px 0 rgba(0,0,0,.25)}
.st-bars .b.skip i{background:transparent; border:2px dashed var(--line); box-shadow:none}
.st-bars .b.hot i{background:linear-gradient(180deg,var(--gold),var(--fire))}
.st-bars .b.max i{background:linear-gradient(180deg,var(--fire),var(--bad))}
.st-bars .b b{font-size:.8rem; margin-bottom:4px; white-space:nowrap; min-height:1em}
.st-bars .b span{font-size:.72rem; color:var(--dim); font-weight:800; margin-top:5px; white-space:nowrap}
.st-bars .b em{font-style:normal; font-size:1.7rem; line-height:1}
.st-bars .b.v{flex:0 0 34px} .st-bars .b.v span{font-size:.6rem}
.st-tl{display:grid; grid-template-columns:repeat(9,minmax(0,1fr)); gap:4px; margin:6px 0 4px}
.st-tl .d{border-radius:10px; border:2px solid var(--line); background:var(--bg2); text-align:center; padding:8px 0 5px; transition:transform .25s, background .25s; min-width:0}
.st-tl .d b{display:block; font-size:1.15rem; line-height:1.1} .st-tl .d span{display:block; font-size:.66rem; font-weight:800; color:var(--dim); margin-top:3px}
.st-tl .d.s{border-color:var(--acc)} .st-tl .d.r{border-color:var(--blue)} .st-tl .d.v{border-color:var(--gold)}
.st-tl .d.seen{opacity:.8}
.st-tl .d.on{transform:translateY(-6px) scale(1.12); background:var(--card2); box-shadow:0 6px 0 rgba(0,0,0,.3)}
.st-tl .d.on.s{background:var(--acc)} .st-tl .d.on.s span{color:var(--on-acc)} .st-tl .d.on.r{background:var(--blue)} .st-tl .d.on.r span{color:#012} .st-tl .d.on.v{background:var(--gold)} .st-tl .d.on.v span{color:#2a1d00}
.st-cap{background:var(--bg2); border-radius:12px; padding:10px 12px; margin-top:10px; font-weight:700; min-height:3.1em; line-height:1.3}
.st-tm{max-width:520px; min-height:calc(100vh - 32px); max-height:calc(100vh - 32px); min-height:calc(100dvh - 32px); max-height:calc(100dvh - 32px); display:flex; flex-direction:column; justify-content:flex-start; background:var(--bg2); animation:none}
.st-tm>:first-child{margin-top:auto} .st-tm>:last-child{margin-bottom:auto}
.st-tm .btn{flex:none}
.st-tm h2{overflow-wrap:anywhere}
.st-clock{position:relative; width:min(68vw,270px); aspect-ratio:1; margin:14px auto 10px; flex:none}
.st-clock svg{width:100%; height:100%; display:block}
.st-clock circle{fill:none; stroke-width:5; stroke-linecap:round} .st-clock .t{stroke:var(--card2)} .st-clock .p{stroke:var(--acc); transition:stroke-dashoffset 1s linear}
.st-clock .c{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; line-height:1}
.st-clock .c b{font-size:clamp(3rem,17vw,4.4rem); font-variant-numeric:tabular-nums; letter-spacing:-.02em}
.st-clock .c span{font-size:.85rem; color:var(--dim); font-weight:800; margin-top:8px; text-transform:uppercase; letter-spacing:.06em}
.st-tmx{font-size:1.02rem; color:var(--muted)}
.st-cmp{display:flex; align-items:center; justify-content:center; gap:10px; margin:12px 0}
.st-cmp .stat{flex:1; max-width:150px} .st-cmp .stat b{font-size:1.9rem}
.st-arrow{font-size:1.8rem; font-weight:800; color:var(--dim)}
.st-grade .moods button.on{border-color:var(--gold); background:var(--card); box-shadow:0 0 0 2px var(--gold) inset} .st-grade .moods button{font-family:inherit; color:inherit; min-width:0} .st-grade .moods button span{font-size:.6rem; white-space:nowrap}
.st-hl{padding:6px 12px}
.st-hrow{display:flex; align-items:center; gap:10px; width:100%; background:none; border:0; border-bottom:2px solid var(--line); padding:12px 0; font:inherit; color:inherit; text-align:left; min-height:64px}
button.st-hrow{cursor:pointer; touch-action:manipulation}
.st-hrow:last-child{border-bottom:0} .st-hrow.no{opacity:.55}
.st-hrow .xe{font-size:1.8rem; width:38px; text-align:center; flex:none}
.st-hrow b{display:block; font-size:1.05rem; line-height:1.2; overflow-wrap:anywhere}
.st-hrow small{display:block; font-size:.72rem; color:var(--dim); font-weight:800; text-transform:uppercase; letter-spacing:.04em; margin:2px 0 4px}
.st-hrow .grow>span{display:block}
.st-g{font-size:1.9rem; font-weight:800; color:var(--gold); min-width:52px; text-align:center; flex:none} .st-g.q{color:var(--dim)}
.st-sec{padding:6px 16px} .st-sec details{margin:0} .st-sec summary{font-size:1.08rem; color:var(--text)}
.st-tip{border-top:2px solid var(--line); padding:12px 0 6px} .st-tip .xe{font-size:1.6rem; width:34px; text-align:center; flex:none} .st-tip p{margin:.4em 0}
.st-why{color:var(--muted); font-style:italic}
.st-empty h2{margin-top:.2em}
/* i trofei di Studio hanno nomi lunghi («Ammazzaverifiche»): a 320 px allargavano la griglia dei Trofei oltre lo schermo */
.grid3>.badge{min-width:0; overflow-wrap:anywhere; -webkit-hyphens:auto; hyphens:auto}
.st-hc .btn{margin-top:12px}
/* 4.0: Oggi, la domanda del giorno, la settimana, il calendario, il coach */
.st-lab{margin-top:14px}
.st-now{background:var(--card2); border:2px solid var(--acc); border-radius:16px; padding:12px; margin-top:6px; box-shadow:0 4px 0 rgba(0,0,0,.25)}
.st-now .st-ne{font-size:2.3rem; width:50px; text-align:center; flex:none; line-height:1}
.st-now b{display:block; font-size:1.2rem; line-height:1.2; overflow-wrap:anywhere}
.st-now p{margin:.6em 0 0}
.st-now .st-grid2{margin-top:10px}
.st-chg{margin:8px 0 0; padding:6px 0; min-height:40px; font-size:.9rem; text-align:left}
.st-ck .label{margin-bottom:4px}
.st-ck .chip{min-width:56px; justify-content:center}
.st-upc{padding:10px 14px}
.st-urow{display:flex; align-items:center; gap:10px; width:100%; background:none; border:0; border-top:2px solid var(--line); padding:10px 0; font:inherit; color:inherit; text-align:left; cursor:pointer; min-height:58px; touch-action:manipulation}
.st-upc>b+.st-urow{border-top:0; margin-top:4px}
.st-urow .xe{font-size:1.8rem; width:38px; text-align:center; flex:none}
.st-urow .grow{min-width:0}
.st-urow b{display:block; overflow-wrap:anywhere; line-height:1.2}
.st-urow small{display:block; color:var(--dim); font-weight:800; font-size:.76rem; margin:2px 0 4px}
.st-dot{flex:none; text-align:center; font-size:1.3rem; min-width:62px; line-height:1.1} .st-dot small{display:block; font-size:.64rem; color:var(--muted); font-weight:800; margin-top:2px}
.st-week{padding:6px 14px}
.st-wrow{display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:2px 8px; padding:10px 0; border-top:2px solid var(--line)}
.st-wrow:first-child{border-top:0}
.st-wrow .st-wn b{display:block; font-size:1.05rem} .st-wrow .st-wn small{color:var(--dim); font-weight:700; font-size:.78rem}
.st-wrow .stepper{margin:0; gap:6px} .st-wrow .stepper b{font-size:1.15rem; min-width:78px} .st-wrow .stepper button{width:44px; height:44px}
.st-wh{grid-column:1 / -1; display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:4px}
.st-wh .stepper b{font-size:1rem; min-width:70px; color:var(--muted)} .st-wh .stepper button{width:40px; height:40px; font-size:1.2rem}
.st-wrow.cush .st-wn b{color:var(--muted)}
.st-calw{padding:6px 12px}
.st-calh{display:flex; justify-content:space-between; align-items:baseline; gap:8px; padding:6px 0}
.st-cr{display:flex; align-items:center; gap:8px; width:100%; background:none; border:0; border-top:2px solid var(--line); padding:8px 4px; font:inherit; color:inherit; text-align:left; min-height:52px}
button.st-cr{cursor:pointer; touch-action:manipulation}
.st-cr.now{background:rgba(255,194,61,.1); border-radius:10px; border-top-color:transparent}
.st-cr.over .st-cm{color:var(--bad)}
.st-cr.past{opacity:.55}
.st-cd{flex:none; width:42px; font-weight:800; color:var(--muted); font-size:.78rem; line-height:1.05; text-transform:uppercase} .st-cd b{display:block; font-size:1.25rem; color:var(--text)}
.st-ci{flex:1; min-width:0; font-size:.92rem; line-height:1.35; overflow-wrap:anywhere}
.st-ci .t{color:var(--gold); font-weight:800}
.st-cm{flex:none; text-align:right; font-weight:800; font-size:.95rem; white-space:nowrap} .st-cm small{display:block; font-size:.7rem; color:var(--dim); font-weight:700}
.st-inl{display:inline; margin:0; padding:0 4px; min-height:0}
.st-qd{display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px}
.st-qd .chip{flex-direction:column; align-items:center; justify-content:center; margin:0; padding:6px 2px; text-align:center; gap:0; min-width:0}
.st-qd .chip small{font-size:.66rem; opacity:.85; font-weight:700}
.st-chat{display:flex; flex-direction:column; gap:8px; margin:10px 0}
.st-mrow{display:flex; align-items:flex-end; gap:6px}
.st-mb{font-size:1.7rem; flex:none; line-height:1}
.st-msg{background:var(--card); border:2px solid var(--line); border-radius:16px 16px 16px 4px; padding:9px 12px; max-width:86%; line-height:1.4; overflow-wrap:anywhere}
.st-msg b{color:var(--gold)}
.st-msg.me{align-self:flex-end; background:var(--acc); color:var(--on-acc); border-color:var(--acc); border-radius:16px 16px 4px 16px}
.st-cchips{margin:4px -4px 8px}
.st-cchips .chip{font-size:.95rem}
.st-chin{display:flex; gap:8px; align-items:center; margin-top:6px}
.st-chin .txt{margin:0; flex:1; min-width:0; font-size:16px}
.st-chin .btn{width:auto; margin:0; padding:12px 18px; flex:none}
@media (max-height:620px){ .st-tm{padding:12px 16px} .st-tm h2{font-size:1.3rem; margin:.25em 0} .st-clock{width:min(50vw,190px); margin:8px auto 6px} .st-clock .c b{font-size:2.7rem} .st-tmx{font-size:.95rem; margin:.3em 0} .st-x2{display:none} .st-tm .big-emoji{font-size:52px !important} .st-tm h3{margin:.6em 0 .3em} .st-tm p{margin:.3em 0} }
@media (max-width:350px){ .st-grade .moods button span{font-size:.54rem}  .st-today{padding:12px} .st-blk{gap:6px; padding:8px 6px 8px 10px} .st-blk .xe{display:none} .st-ke{display:inline} .st-blk small{letter-spacing:0} .st-ring{width:88px; height:88px} .st-ring .c b{font-size:1.75rem} .st-hd{font-size:1.3rem} .st-mon{font-size:46px} .st-mon.big{font-size:76px} .st-ib{width:44px; height:44px} .st-sum .stat b{font-size:1.25rem} .st-stp b{min-width:104px} .st-num{font-size:2.6rem} .st-bud{width:60px} .st-bud .buddy{font-size:52px} }
`;
  function injectCSS() {
    try {
      if (typeof document === 'undefined' || $id('studio-css')) return;
      const s = document.createElement('style'); s.id = 'studio-css'; s.textContent = CSS;
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
  }
  injectCSS();

  root.STUDIO = {on, view, homeCard, meCard, help, actions, tick};
})(typeof self !== 'undefined' ? self : globalThis);
