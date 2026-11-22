/* Level Up · Studio — il motore (logica pura).
   Niente DOM, niente localStorage, niente orologio: «oggi» arriva sempre come parametro T ('AAAA-MM-GG').
   Gira nel browser (script classico, un solo nome globale: STUDIO_ENGINE) e in Node (module.exports) per i test.
   Specifica: «PROPOSTA - Level Up Studio 3.0 (19.11.2026).md», § 3 (dati), § 4 (piano), § 5 (premi).

   Come ragiona, in breve:
   - il lavoro di una verifica sono minuti (teoria) + esercizi × minuti l'uno; i «punti vita» del boss sono i minuti rimasti;
   - plan(st, T) spalma il lavoro rimasto sui giorni buoni fino a «pronto entro» (verifica − buffer − 1), a multipli di 5;
   - la quota di oggi si calcola con il registro fino a ieri: mentre studia scende «left», non la quota;
   - st.days[giorno] = {q} è la quota timbrata: serve ai premi per ricordare i giorni passati (con q0, la prima quota
     di quel giorno, quando è diversa da q). La scrivono da sole log(), undo(), newTest(), rebase(), removeTest(),
     setFin(), extend(); chi cambia st.cfg a mano chiama stamp(st, T, true);
   - plan() e rewards() non modificano mai lo stato e non lanciano (se qualcosa va storto: risultato vuoto con .error). */
(function (root) {
  'use strict';

  /* ---------- limiti ---------- */
  const MAXT = 40;          // verifiche aperte insieme (senza nota e non ancora passate)
  const MAXALL = 400;       // verifiche in tutto, storico compreso
  const MAXA = 12, MAXLOG = 3000, MAXSTAMP = 1500, MAXOFF = 366;
  const MAXAGE = 366;       // una verifica non nasce più di un anno prima della sua data
  const MAXW = 200000;      // lavoro previsto di una verifica, in minuti (12 argomenti al massimo)
  const MAXB = 40;          // blocchi mostrati in un giorno
  const HOR = 365;          // quanto lontano guarda il piano (giorni)
  const HIST = 1500;        // quanto indietro guardano i premi (giorni): tutta la scuola media e oltre
  const BACK = 60;          // giorni senza timbro che stamp() recupera all'indietro
  const NDAYS = 42;         // giorni restituiti da plan().days
  const KINDS = ['th', 'ex', 'both'], ROWK = ['th', 'ex', 'rev'];
  const RID = /^[A-Za-z0-9_-]{1,16}$/;
  const PREFIX = 'STUDIO1:';

  /* ---------- date: solo aritmetica di calendario, mai l'orologio e mai UTC ---------- */
  const pad = n => String(n).padStart(2, '0');
  // 'AAAA-MM-GG' → numero del giorno (0 = 01.01.1970)
  function num(k) {
    const y0 = +k.slice(0, 4), m = +k.slice(5, 7), d = +k.slice(8, 10);
    const y = m <= 2 ? y0 - 1 : y0, era = Math.floor(y / 400), yoe = y - era * 400;
    const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    return era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
  }
  // numero del giorno → 'AAAA-MM-GG'
  function key(n) {
    const z = n + 719468, era = Math.floor(z / 146097), doe = z - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153), d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp < 10 ? mp + 3 : mp - 9;
    return String(yoe + era * 400 + (m <= 2 ? 1 : 0)).padStart(4, '0') + '-' + pad(m) + '-' + pad(d);
  }
  function isDay(k) {
    if (typeof k !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(k)) return false;
    const y = +k.slice(0, 4);
    return y >= 1970 && y < 2200 && key(num(k)) === k;      // 31 febbraio e simili: no
  }
  const dowN = n => (((n + 3) % 7) + 7) % 7;                 // 0 = lunedì (il 01.01.1970 era giovedì)
  const addD = (k, n) => isDay(k) ? key(num(k) + (Number.isFinite(n) ? Math.round(n) : 0)) : k;
  const dow = k => isDay(k) ? dowN(num(k)) : 0;
  const diff = (a, b) => isDay(a) && isDay(b) ? num(b) - num(a) : 0;   // giorni da a a b

  /* ---------- piccoli attrezzi ---------- */
  const isObj = o => o !== null && typeof o === 'object' && !Array.isArray(o);
  const arr = a => Array.isArray(a) ? a : [];
  const flag = v => (v === 1 || v === true) ? 1 : 0;
  const ceil5 = m => Math.ceil(m / 5) * 5;
  const floor5 = m => Math.floor(m / 5) * 5;
  const round5 = m => Math.round(m / 5) * 5;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const numOf = v => typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  function int(v, lo, hi, def) { const n = numOf(v); return Number.isFinite(n) ? clamp(Math.round(n), lo, hi) : def; }
  // caratteri di controllo, invisibili e di direzione del testo (per codice, cosi' il file resta ASCII in questo punto)
  const BAD = new RegExp('[' + [[0, 31], [127, 159], [0x200b, 0x200b], [0x200e, 0x200f], [0x2028, 0x202e], [0xfeff, 0xfeff]].map(r => String.fromCharCode(r[0]) + '-' + String.fromCharCode(r[1])).join('') + ']', 'g');
  // stringa pulita: niente caratteri di controllo, spazi compattati, tagliata per caratteri interi (non a metà di un'emoji)
  function str(v, max) {
    if (typeof v !== 'string') return '';
    const s = v.slice(0, max * 8 + 64).replace(BAD, ' ').replace(/\s+/g, ' ').trim();
    const cp = Array.from(s).filter(ch => !(ch.length === 1 && ch >= '\ud800' && ch <= '\udfff'));   // surrogati spaiati: via
    return cp.slice(0, max).join('').trim();
  }

  /* ---------- il tempo di ogni giorno (4.0) ---------- */
  const MAXAV = 120;                                         // risposte «quanto tempo hai oggi?» tenute (le più recenti)
  const MAXDAY = 240;                                        // minuti al giorno: il massimo che si può dire
  // una settimana tipo valida (7 numeri da 0 a 240, a multipli di 5, almeno un giorno > 0) o null
  function weekOf(v) {
    if (!Array.isArray(v) || v.length !== 7) return null;
    const w = v.map(x => { const n = numOf(x); return Number.isFinite(n) ? clamp(round5(n), 0, MAXDAY) : NaN; });
    return w.every(Number.isFinite) && w.some(x => x > 0) ? w : null;
  }
  // le risposte del giorno: {giorno: minuti}, solo giorni veri, al massimo le 120 più recenti; null se non ce n'è nessuna
  function availOf(v) {
    if (!isObj(v)) return null;
    const ks = Object.keys(v).filter(k => isDay(k) && Number.isFinite(numOf(v[k]))).sort().slice(-MAXAV);
    if (!ks.length) return null;
    const o = {};
    for (const k of ks) o[k] = clamp(round5(numOf(v[k])), 0, MAXDAY);
    return o;
  }
  const hasTime = cfg => !!(cfg && (Array.isArray(cfg.wk) || Array.isArray(cfg.hwk) || (isObj(cfg.av) && Object.keys(cfg.av).length) || (isObj(cfg.hav) && Object.keys(cfg.hav).length)));
  const hwDone = (st, k) => isObj(st.hwd) && Number.isFinite(st.hwd[k]) ? st.hwd[k] : 0;

  /* ---------- stato ---------- */
  function defaults() {
    return {v: 1, intro: 0, cfg: {days: [1, 1, 1, 1, 1, 1, 0], cap: 90, block: 25, buffer: 2, off: []}, tests: [], log: [], days: {}};
  }

  // un argomento come lo scrive il wizard o un codice importato → campi puliti (senza id)
  function topicOf(o) {
    if (!isObj(o)) return null;
    let thMin = int(o.thMin, 0, 600, 0), exN = int(o.exN, 0, 200, 0), exMin = int(o.exMin, 0, 60, 0);
    const kind = KINDS.includes(o.kind) ? o.kind : (thMin > 0 && exN > 0 ? 'both' : exN > 0 ? 'ex' : 'th');
    if (kind === 'ex') thMin = 0; else thMin = thMin > 0 ? Math.max(5, thMin) : 30;
    if (kind === 'th') { exN = 0; exMin = 0; } else { exN = exN || 5; exMin = exMin || 5; }
    return {n: str(o.n, 60) || 'Argomento', kind, conf: int(o.conf, 1, 3, 2), thMin, exN, exMin};
  }
  // una verifica «da viaggio» (quella dei codici STUDIO1): null se manca la data
  function portable(o) {
    if (!isObj(o) || !isDay(o.date)) return null;
    const subj = typeof o.subj === 'string' ? o.subj.trim().toLowerCase() : '';
    const topics = [];
    for (const a of arr(o.topics)) { if (topics.length >= MAXA) break; const p = topicOf(a); if (p) topics.push(p); }
    return {subj: /^[a-z0-9_]{1,12}$/.test(subj) ? subj : 'altro', name: str(o.name, 60), date: o.date, sheet: o.sheet === true || o.sheet === 1, topics};
  }
  // id validi e unici: chi ne ha uno buono lo tiene, gli altri ne ricevono uno nuovo
  function withIds(raws, items, prefix) {
    const used = new Set(), ids = raws.map(o => {
      const id = isObj(o) && typeof o.id === 'string' && RID.test(o.id) && !used.has(o.id) ? o.id : null;
      if (id) used.add(id); return id;
    });
    let k = 0;
    return items.map((it, i) => {
      let id = ids[i];
      if (!id) { do { id = prefix + (++k); } while (used.has(id)); used.add(id); }
      return Object.assign({id}, it, {id});
    });
  }
  const nominal = topics => topics.reduce((s, a) => s + a.thMin + a.exN * a.exMin, 0);
  function estimate(topics) {
    let s = 0;
    for (const a of arr(topics)) { const p = topicOf(a); if (p) s += p.thMin + p.exN * p.exMin; }
    return s;
  }
  // una verifica completa e pulita (o null)
  function testOf(o, cfg) {
    const p = portable(o); if (!p) return null;
    const src = arr(o.topics).filter(a => topicOf(a)).slice(0, MAXA);
    const topics = withIds(src, p.topics, 'a').map((a, i) => { a.thFin = a.kind !== 'ex' ? flag(src[i].thFin) : 0; return a; });
    let created = isDay(o.created) && o.created <= p.date ? o.created : p.date;
    if (diff(created, p.date) > MAXAGE) created = addD(p.date, -MAXAGE);
    let grade = numOf(o.grade); grade = o.grade != null && Number.isFinite(grade) ? clamp(Math.round(grade * 4) / 4, 1, 6) : null;
    // base: la promessa {q, n} più la sua firma: w = lavoro previsto e d = data per cui è stata fatta (rebase la rifà solo
    // se cambiano), x = minuti aggiunti dopo con «non ancora»
    const w = nominal(topics);
    const base = isObj(o.base) && Number.isFinite(numOf(o.base.q)) && Number.isFinite(numOf(o.base.n))
      ? {q: int(o.base.q, 0, 1440, 0), n: int(o.base.n, 0, 366, 0), w: int(o.base.w, 0, MAXW, w), d: isDay(o.base.d) ? o.base.d : p.date, x: int(o.base.x, 0, MAXW, 0)}
      : promise(makeCal(cfg, num(created)), cfg, num(p.date), num(created), w, w, p.date);
    if (isObj(o.base) && base.lv === undefined && o.base.lv != null && Number.isFinite(numOf(o.base.lv))) {
      base.lv = int(o.base.lv, 0, 1440, 0);
      if (o.base.o != null && Number.isFinite(numOf(o.base.o)) && numOf(o.base.o) > 0) base.o = int(o.base.o, 0, MAXW, 0);
    }
    return {id: null, subj: p.subj, name: p.name, date: p.date, created, sheet: p.sheet, base, topics,
      grade, gradeD: grade == null ? null : (isDay(o.gradeD) ? o.gradeD : p.date),
      feel: o.feel == null ? null : int(o.feel, 1, 5, null), note: str(o.note, 200)};
  }
  // una riga di registro pulita (o null); tmap: id verifica → verifica pulita
  function rowOf(o, tmap) {
    if (!isObj(o) || !isDay(o.d) || !ROWK.includes(o.k) || typeof o.tid !== 'string') return null;
    const t = tmap.get(o.tid); if (!t) return null;
    const a = o.k !== 'rev' && typeof o.aid === 'string' ? t.topics.find(x => x.id === o.aid) : null;
    let m = int(o.m, 0, 600, 0);
    const n = o.k === 'ex' ? int(o.n, 0, 200, 0) : 0;
    if (!m && n && a) m = Math.min(600, n * a.exMin);        // esercizi segnati a mano senza minuti: vale la stima
    if (!m && !n) return null;
    const ts = typeof o.ts === 'number' && Number.isFinite(o.ts) && o.ts >= 0 ? Math.floor(o.ts) : null;
    return {d: o.d, tid: t.id, aid: a ? a.id : null, k: o.k, m, n, ts, five: flag(o.five)};
  }

  function cleanCore(raw) {
    const st = defaults();
    if (!isObj(raw)) return st;
    st.intro = flag(raw.intro);
    const g = isObj(raw.cfg) ? raw.cfg : {};
    if (Array.isArray(g.days) && g.days.length === 7) { const d = g.days.map(flag); if (d.some(Boolean)) st.cfg.days = d; }
    st.cfg.cap = round5(int(g.cap, 30, 240, 90));
    st.cfg.block = round5(int(g.block, 15, 45, 25));
    st.cfg.buffer = int(g.buffer, 0, 3, 2);
    st.cfg.off = [...new Set(arr(g.off).filter(isDay))].sort().slice(-MAXOFF);
    // 4.0: il tempo di ogni giorno. wk = minuti di una settimana tipo (lun..dom, 0 = cuscinetto): comanda lui su days e cap.
    // av = la risposta a «quanto tempo hai oggi?» per un giorno preciso (0 = oggi niente). Le chiavi ci sono solo se servono.
    const wk = weekOf(g.wk);
    if (wk) { st.cfg.wk = wk; st.cfg.days = wk.map(v => v > 0 ? 1 : 0); st.cfg.cap = clamp(Math.max(...wk), 30, 240); }
    const av = availOf(g.av);
    if (av) st.cfg.av = av;
    // i compiti contano come studio: hwk = minuti di compiti di solito (lun..dom), da since in poi; hav = quelli di un giorno
    const hwk = Array.isArray(g.hwk) && g.hwk.length === 7 ? g.hwk.map(x => { const n = numOf(x); return Number.isFinite(n) ? clamp(round5(n), 0, MAXDAY) : 0; }) : null;
    if (hwk && hwk.some(x => x > 0)) { st.cfg.hwk = hwk; if (isDay(g.since)) st.cfg.since = g.since; }
    const hav = availOf(g.hav);
    if (hav) st.cfg.hav = hav;
    // i minuti di compiti fatti, giorno per giorno
    if (isObj(raw.hwd)) {
      const ks = Object.keys(raw.hwd).filter(k => isDay(k) && Number.isFinite(numOf(raw.hwd[k])) && numOf(raw.hwd[k]) > 0).sort().slice(-MAXSTAMP);
      if (ks.length) { st.hwd = {}; for (const k of ks) st.hwd[k] = int(raw.hwd[k], 0, 600, 0); }
    }
    const days = {};
    let ref = null;                                          // l'ultimo giorno timbrato: l'ultima volta che l'app è stata usata
    if (isObj(raw.days)) {
      const ks = Object.keys(raw.days).filter(k => isDay(k) && isObj(raw.days[k]) && Number.isFinite(numOf(raw.days[k].q))).sort().slice(-MAXSTAMP);
      for (const k of ks) {
        const q = int(raw.days[k].q, 0, 1440, 0), q0 = int(raw.days[k].q0, 0, 1440, q);
        days[k] = q0 !== q ? {q, q0} : {q}; ref = k;
      }
    }
    let all = [];
    for (const o of arr(raw.tests)) {
      if (all.length >= MAXALL * 5) break;
      const t = testOf(o, st.cfg); if (t) all.push({o, t, i: all.length});
    }
    // troppe aperte insieme (senza nota, non ancora passate l'ultima volta che ha usato l'app): restano le 40 più vicine
    const open = all.filter(x => x.t.grade == null && (ref === null || x.t.date >= ref));
    if (open.length > MAXT) { const out = new Set(open.sort((a, b) => a.t.date < b.t.date ? -1 : a.t.date > b.t.date ? 1 : a.i - b.i).slice(MAXT)); all = all.filter(x => !out.has(x)); }
    // troppe in tutto: restano le più recenti
    if (all.length > MAXALL) { const keep = new Set(all.slice().sort((a, b) => a.t.date > b.t.date ? -1 : a.t.date < b.t.date ? 1 : b.i - a.i).slice(0, MAXALL)); all = all.filter(x => keep.has(x)); }
    st.tests = withIds(all.map(x => x.o), all.map(x => x.t), 't');
    const tmap = new Map(st.tests.map(t => [t.id, t])), rows = [];
    for (const o of arr(raw.log)) { const r = rowOf(o, tmap); if (r) rows.push(r); }
    st.log = rows.slice(-MAXLOG);
    st.days = days;
    return st;
  }
  // non lancia MAI: qualunque cosa riceva, restituisce uno stato valido
  function clean(raw) { try { return cleanCore(raw); } catch (e) { return defaults(); } }

  /* ---------- calendario: giorni buoni (di studio e non «off») ---------- */
  /* 4.0: ogni giorno ha il suo tempo.
     max(n) = il tempo che ha quel giorno, compiti compresi: la risposta di oggi (av), se no la settimana tipo (wk), se no il tetto.
     hw(n)  = i compiti previsti (risposta del giorno hav, se no i compiti di solito hwk dal giorno in cui li ha messi: since).
     capOf(n) = il posto che resta per le verifiche = max − compiti. Il piano non lo supera mai, salvo che il lavoro non ci stia.
     Senza wk, hwk, av e hav il calendario è quello della 3.0, identico. */
  function makeCal(cfg, anchor) {
    const offs = new Set(cfg.off.map(num)), wd = cfg.days;
    const wk = Array.isArray(cfg.wk) && cfg.wk.length === 7 ? cfg.wk : null, hwk = Array.isArray(cfg.hwk) && cfg.hwk.length === 7 ? cfg.hwk : null;
    const since = isDay(cfg.since) ? num(cfg.since) : -Infinity, av = new Map(), hav = new Map();
    if (isObj(cfg.av)) for (const k in cfg.av) if (isDay(k)) av.set(num(k), cfg.av[k]);
    if (isObj(cfg.hav)) for (const k in cfg.hav) if (isDay(k)) hav.set(num(k), cfg.hav[k]);
    const plain = !wk && !hwk && !av.size && !hav.size;
    const on = n => !offs.has(n) && (av.has(n) ? av.get(n) > 0 : wd[dowN(n)] === 1);       // giorno in cui studia
    const max = n => offs.has(n) ? 0 : av.has(n) ? av.get(n) : wk ? wk[dowN(n)] : wd[dowN(n)] === 1 ? cfg.cap : 0;
    const hw = n => hav.has(n) ? hav.get(n) : offs.has(n) || av.get(n) === 0 || !hwk || n < since ? 0 : hwk[dowN(n)];
    const capOf = plain ? (() => cfg.cap) : (n => on(n) ? Math.max(0, max(n) - hw(n)) : 0);
    const good = plain ? (n => wd[dowN(n)] === 1 && !offs.has(n)) : (n => on(n) && capOf(n) >= 5);
    // conteggi precalcolati attorno ad anchor («oggi»): indietro quanto guardano i premi, avanti quanto guarda il piano
    const B = anchor - HIST - 8, N = HIST + HOR + 32, pre = new Int32Array(N + 1);
    let minCap = plain ? cfg.cap : Infinity;
    for (let k = 0; k < N; k++) { const g = good(B + k); pre[k + 1] = pre[k] + (g ? 1 : 0); if (g && !plain) minCap = Math.min(minCap, capOf(B + k)); }
    // quanti giorni buoni da a a b compresi
    const cnt = (a, b) => {
      if (b < a) return 0;
      if (a >= B && b < B + N) return pre[b - B + 1] - pre[a - B];
      let c = 0; for (let d = a, e = Math.min(b, a + HOR + 8); d <= e; d++) if (good(d)) c++;
      return c;
    };
    return {good, cnt, capOf, max, hw, on, plain, minCap: minCap === Infinity ? 0 : minCap,
      isOff: n => offs.has(n), busy: n => !offs.has(n) && av.get(n) === 0,
      cushion: n => wd[dowN(n)] !== 1 && !offs.has(n) && !av.has(n)};
  }
  // il livello λ (minuti): Σ min(posto del giorno, λ) = L sui giorni buoni da S a we. o = quello che non ci sta nemmeno pieni
  function levelFor(cal, S, we, L) {
    const caps = [];
    for (let d = S; d <= we && d <= S + HOR; d++) if (cal.good(d)) caps.push(cal.capOf(d));
    if (!caps.length || L <= 0) return {lv: 0, o: Math.max(0, L)};
    caps.sort((a, b) => a - b);
    let left = L, k = caps.length;
    for (const c of caps) { if (c * k >= left) return {lv: Math.min(1440, ceil5(left / k)), o: 0}; left -= c; k--; }
    return {lv: caps[caps.length - 1], o: left};
  }
  /* Riempie i giorni come si riempiono dei bicchieri: u unità da 5 minuti, c[j] = posto del giorno j (in unità).
     Parti uguali col resto sui primi giorni; un giorno con poco posto prende quel che può e il resto va sugli altri.
     Con poco lavoro blocchi da 15 minuti sui primi giorni, come share(). rest = quello che non ci sta. */
  const sum5 = a => a.reduce((s, x) => s + x, 0);
  function fill(u, c) {
    const r = c.length, m = new Array(r).fill(0);
    if (u <= 0 || !r) return {m, rest: Math.max(0, u)};
    let left = u;
    if (u < 3 * r) {
      for (let j = 0; j < r && left > 0; j++) { const x = Math.min(3, c[j], left); m[j] = x; left -= x; }
      if (left <= 0) return {m, rest: 0};
    }
    const room = c.map((x, j) => Math.max(0, x - m[j]));
    let tot = 0, hi = 0; for (const x of room) { tot += x; if (x > hi) hi = x; }
    if (tot <= left) { for (let j = 0; j < r; j++) m[j] += room[j]; return {m, rest: left - tot}; }
    let lo = 1;                                              // il livello più basso che basta
    while (lo < hi) { const mid = (lo + hi) >> 1; let s = 0; for (const x of room) s += Math.min(x, mid); if (s >= left) hi = mid; else lo = mid + 1; }
    let s = 0; const add = room.map(x => { const v = Math.min(x, lo - 1); s += v; return v; });
    let extra = left - s;
    for (let j = 0; j < r; j++) { if (extra > 0 && room[j] >= lo) { add[j]++; extra--; } m[j] += add[j]; }
    return {m, rest: 0};
  }

  /* ---------- quanto lavoro tocca a ogni giorno ----------
     u = lavoro in unità da 5 minuti, r = giorni buoni, j = giorno (0 = il primo).
     Di norma parti uguali, con il resto sui primi giorni (72 unità in 6 giorni = 12 l'uno = 60 min).
     Se verrebbero meno di 15 minuti al giorno si fanno blocchi da 15 finché c'è lavoro: 5 minuti non sono studio.
     È crescente in u giorno per giorno: più lavoro non abbassa mai nessun giorno. */
  function share(u, r, j) {
    if (u <= 0 || r <= 0 || j >= r) return 0;
    if (u >= 3 * r) return Math.ceil((u - j) / r);
    return clamp(u - 3 * j, 0, 3);
  }
  const usedDays = (u, r) => u >= 3 * r ? r : Math.ceil(u / 3);

  // la promessa: minuti al giorno × giorni, per finire L minuti partendo dal giorno S
  function baseAt(cal, cfg, dn, S, L) {
    if (L <= 0 || S >= dn) return {q: 0, n: 0};
    const u = Math.ceil(L / 5), we = Math.min(dn - cfg.buffer - 1, S + HOR);
    let r = we >= S ? cal.cnt(S, we) : 0;
    if (!r) r = cal.cnt(Math.max(S, dn - cfg.buffer), dn - 1);        // niente finestra: i giorni di ripasso (rush)
    return {q: Math.min(1440, (r ? share(u, r, 0) : u) * 5), n: r ? usedDays(u, r) : 0};
  }

  // con il tempo per giorno (4.0) la promessa ha anche il livello lv: un giorno corto conta per quello che può dare,
  // così chi fa quello che il piano chiede in un giorno da 20 minuti non risulta «indietro». o = minuti che non ci stavano già
  function promise(cal, cfg, dn, S, L, w, d) {
    const b = baseAt(cal, cfg, dn, S, L), out = {q: b.q, n: b.n, w, d, x: 0};
    if (hasTime(cfg) && L > 0) {
      const we = Math.min(dn - cfg.buffer - 1, S + HOR);
      if (we >= S && cal.cnt(S, we) > 0) { const f = levelFor(cal, S, we, L); out.lv = f.lv; if (f.o > 0) out.o = f.o; }
    }
    return out;
  }

  /* ---------- il lavoro di una verifica, riga per riga ----------
     rows: [{r, dn}] della verifica, in ordine di giorno.
     Teoria a minuti (fino a thMin; «l'ho capito» la chiude dove è arrivata), esercizi a numero. */
  function work(x, rows) {
    const tp = x.topics.map((a, i) => ({a, id: a.id, i, conf: a.conf, thSum: 0, exSum: 0, calN: 0, calM: 0, cth: 0, cex: 0, hp: 0}));
    const ix = new Map(tp.map(p => [p.id, p]));
    for (const {r} of rows) {
      const p = r.aid != null ? ix.get(r.aid) : null; if (!p) continue;
      if (r.k === 'th') p.thSum += r.m;
      else if (r.k === 'ex') { p.exSum += r.n; if (r.n > 0 && r.m > 0) { p.calN += r.n; p.calM += r.m; } }
    }
    let total = 0, totalEff = 0, nomEff = 0;
    for (const p of tp) {
      const a = p.a;
      p.thMin = a.kind === 'ex' ? 0 : a.thMin;
      p.thDone = Math.min(p.thMin, p.thSum);
      p.thEff = a.thFin ? p.thDone : p.thMin;                  // «l'ho capito»: la teoria finisce dove è arrivata
      p.exN = a.kind === 'th' ? 0 : a.exN;
      p.exDone = Math.min(p.exN, p.exSum);
      // dopo 3 esercizi conta il tempo vero per esercizio, fra metà e il doppio della stima
      p.perEx = p.exN ? (p.calN >= 3 ? Math.max(1, Math.round(clamp(p.calM / p.calN, a.exMin * 0.5, a.exMin * 2))) : Math.max(1, a.exMin)) : 0;
      p.perNom = p.exN ? Math.max(1, a.exMin) : 0;             // la stima di partenza: è su questa che è fatta la promessa
      total += p.thMin + p.exN * p.perEx;
      totalEff += p.thEff + p.exN * p.perEx;
      nomEff += p.thEff + p.exN * p.perNom;
    }
    // punti vita tolti giorno per giorno (cumulati): hd = giorni, hc = totale tolto fino a quel giorno compreso
    // hn = lo stesso, misurato per il ritardo: sulla stima di partenza, e un esercizio vale almeno i minuti veri che è
    // costato (chi è più lento della stima ma fa la sua quota non è «in ritardo»: è la stima che era corta)
    const hd = [], hc = [], hn = [];
    let cum = 0, cn = 0;
    for (const {r, dn} of rows) {
      const p = r.aid != null ? ix.get(r.aid) : null; if (!p) continue;
      let hp = 0, cr = 0;
      if (r.k === 'th') { hp = Math.min(r.m, p.thEff - p.cth); p.cth += hp; cr = hp; }
      else if (r.k === 'ex') { const n = Math.min(r.n, p.exN - p.cex); p.cex += n; hp = n * p.perEx; cr = n > 0 ? Math.max(n * p.perNom, r.m) : 0; }
      if (hp <= 0) continue;
      p.hp += hp; cum += hp; cn += cr;
      if (hd.length && hd[hd.length - 1] === dn) { hc[hc.length - 1] = cum; hn[hn.length - 1] = cn; } else { hd.push(dn); hc.push(cum); hn.push(cn); }
    }
    let nomLeft = 0;
    for (const p of tp) { p.thLeft = p.thEff - p.thDone; p.exLeft = p.exN - p.exDone; p.left = p.thLeft + p.exLeft * p.perEx; nomLeft += p.thLeft + p.exLeft * p.perNom; }
    return {tp, total, totalEff, left: totalEff - cum, hd, hc, nomEff, hn, owe: Math.max(0, nomEff - cn), nomLeft};
  }
  // lavoro rimasto all'inizio del giorno dn (h = 1: alla fine del giorno dn)
  function leftAt(t, dn, h) {
    let cum = 0;
    for (let k = t.hd.length - 1; k >= 0; k--) if (h ? t.hd[k] <= dn : t.hd[k] < dn) { cum = t.hc[k]; break; }
    return t.totalEff - cum;
  }
  // lavoro rimasto la mattina del giorno dn, per tutte le verifiche (oggi: con i tempi misurati fino a ieri)
  const morning = (c, dn) => c.tests.map(t => dn === c.Tn ? t.left0 : leftAt(t, dn, 0));
  const sortRows = rows => { for (let k = 1; k < rows.length; k++) if (rows[k].dn < rows[k - 1].dn) { rows.sort((a, b) => a.dn - b.dn || a.ix - b.ix); break; } return rows; };

  function totals(st, test) {
    const empty = {total: 0, left: 0, done: 0, pct: 100, thTotal: 0, thLeft: 0, exTotal: 0, exLeft: 0, topics: []};
    try {
      if (!isObj(test) || !Array.isArray(test.topics)) return empty;
      const rows = [];
      arr(st && st.log).forEach((r, ix) => { if (r && r.tid === test.id && isDay(r.d)) rows.push({r, dn: num(r.d), ix}); });
      const w = work(test, sortRows(rows));
      const o = {total: w.total, left: w.left, done: w.total - w.left, pct: w.total > 0 ? Math.round(100 * (w.total - w.left) / w.total) : 100,
        thTotal: 0, thLeft: 0, exTotal: 0, exLeft: 0, topics: []};
      for (const p of w.tp) {
        o.thTotal += p.thMin; o.thLeft += p.thLeft; o.exTotal += p.exN * p.perEx; o.exLeft += p.exLeft * p.perEx;
        o.topics.push({id: p.id, n: p.a.n, kind: p.a.kind, conf: p.a.conf, thMin: p.thMin, thDone: p.thDone, thLeft: p.thLeft,
          exN: p.exN, exNDone: p.exDone, exNLeft: p.exLeft, perEx: p.perEx, total: p.thMin + p.exN * p.perEx, left: p.left, closed: p.left === 0});
      }
      return o;
    } catch (e) { return empty; }
  }

  /* ---------- il contesto di un calcolo: verifiche e registro fino al giorno Tn ---------- */
  function build(st, Tn) {
    const cfg = st.cfg, cal = makeCal(cfg, Tn);
    const by = new Map(), dayMin = new Map();
    const c = {cfg, cal, Tn, dayMin, minutes: 0, exercises: 0, sessions: 0, fives: 0, first: Tn};
    const all = [];
    st.log.forEach((r, ix) => { const dn = num(r.d); if (dn <= Tn) all.push({r, dn, ix}); });   // il futuro non esiste ancora
    sortRows(all);
    for (const e of all) {
      const r = e.r;
      dayMin.set(e.dn, (dayMin.get(e.dn) || 0) + r.m);
      c.minutes += r.m; c.sessions++; c.fives += r.five ? 1 : 0; if (r.k === 'ex') c.exercises += r.n;
      if (e.dn < c.first) c.first = e.dn;
      let l = by.get(r.tid); if (!l) by.set(r.tid, l = []); l.push(e);
    }
    c.tests = st.tests.map((x, i) => {
      const rows = by.get(x.id) || [], w = work(x, rows), dn = num(x.date);
      let revToday = 0, revN = 0, k0 = rows.length;
      for (let k = rows.length - 1; k >= 0 && rows[k].dn === Tn; k--) { k0 = k; if (rows[k].r.k === 'rev') { revToday += rows[k].r.m; revN++; } }
      // stamattina: il tempo per esercizio è quello misurato fino a ieri; quello di oggi vale da domani (la quota non balla mentre studia)
      const left0 = k0 < rows.length ? work(x, rows.slice(0, k0)).left : w.left;
      const base = x.base || {q: 0, n: 0};
      return {i, x, id: x.id, dn, cr: num(x.created), rdy: dn - cfg.buffer - 1, graded: x.grade != null,
        gdn: x.grade != null ? Math.min(Tn, isDay(x.gradeD) ? num(x.gradeD) : dn) : Infinity,   // una nota non arriva dal futuro
        tp: w.tp, total: w.total, totalEff: w.totalEff, left: w.left, left0, hd: w.hd, hc: w.hc, nomEff: w.nomEff, hn: w.hn, owe: w.owe,
        // ripasso: il 15 % del lavoro fra 15 e 40 minuti, ma mai più lungo di una giornata di studio promessa («così sei anche tranquillo»)
        rv: Math.min(clamp(round5(w.total * 0.15), 15, 40), Math.max(15, floor5(base.q))), base, revToday, revN,
        order: w.tp.slice().sort((a, b) => a.conf - b.conf || a.i - b.i), cov: null, covLo: 0};
    });
    // 4.0: per le promesse col livello, quanto lavoro copre la promessa da ogni giorno in poi (somme dal fondo)
    for (const t of c.tests) if (t.base.lv != null && !t.graded) {
      const lo = Math.max(Math.min(t.cr, Tn), t.rdy - 800), hi = t.rdy;
      if (hi < lo) continue;
      const cov = new Int32Array(hi - lo + 2);
      for (let d = hi; d >= lo; d--) cov[d - lo] = cov[d - lo + 1] + (cal.good(d) ? Math.min(cal.capOf(d), t.base.lv) : 0);
      t.cov = cov; t.covLo = lo;
    }
    c.byDate = c.tests.slice().sort((a, b) => a.dn - b.dn || a.i - b.i);       // la più vicina per prima
    return c;
  }
  // la verifica «è in gioco» il giorno S: già inserita, non ancora arrivata, senza nota
  const activeOn = (t, S) => t.cr <= S && S < t.dn && !(t.graded && t.gdn <= S);
  // ritardo: lavoro dovuto (L, vedi hn in work) oltre quello che la promessa (base) lascia per i giorni buoni che restano da dn
  function behindOf(c, t, L, dn) {
    if (t.cov) {
      const cv = dn > t.rdy ? 0 : t.cov[clamp(dn - t.covLo, 0, t.cov.length - 1)];
      return floor5(Math.max(0, L - cv - (t.base.o || 0)));
    }
    const we = Math.min(t.rdy, dn + HOR), r = we >= dn ? c.cal.cnt(dn, we) : 0;
    return floor5(Math.max(0, L - t.base.q * Math.min(r, t.base.n)));
  }

  /* ---------- il piano a partire dal giorno S, con il lavoro L[i] per verifica ----------
     4.0: prima la verifica più vicina. I giorni di ripasso si tengono per primi (sono sacri); poi ogni verifica, dalla più
     vicina alla più lontana, riempie i suoi giorni di studio con il posto che le lasciano quelle prima di lei, in parti
     uguali e senza superare il tempo del giorno. Quella lontana si prende quello che resta: in un giorno corto la vicina
     ha la precedenza. Quello che non ci sta nemmeno così resta nel piano sopra il tetto (sfora, non nasconde) ed è «over».
     quick: basta la quota del primo giorno (se nessun giorno può superare il tetto non serve altro).
     Restituisce {q0, list, tot, over}; list = verifiche in gioco con ds/ms (giorni e minuti di studio o rush) e vs (ripasso). */
  function allocate(c, S, L, quick) {
    const buf = c.cfg.buffer, cal = c.cal, good0 = cal.good(S), list = [];
    let U = 0, q0 = 0, H = 1;
    for (const t of c.byDate) {
      if (!activeOn(t, S)) continue;
      const l = L[t.i], u = l > 0 ? Math.ceil(l / 5) : 0;
      const we = Math.min(t.rdy, S + HOR), r = we >= S ? cal.cnt(S, we) : 0;                  // finestra di studio
      const rs = Math.max(S, t.dn - buf), re = t.dn - 1, rr = re >= rs && rs <= S + HOR ? cal.cnt(rs, re) : 0;   // giorni di ripasso
      const e = {t, u, r, rr, rs, re, phase: null, n: 0, from: 0, to: -1, rate: 0, over: 0, tight: 0, ds: [], ms: [], vs: [], xs: [], xm: []};
      if (u > 0) {
        if (r > 0) { e.phase = 'study'; e.n = r; e.from = S; e.to = we; }
        else if (rr > 0) { e.phase = 'rush'; e.n = rr; e.from = rs; e.to = re; }      // niente finestra: tutto nei giorni di ripasso
        else e.over = u * 5;                                                        // nessun giorno utile: non ci sta, e si dice
      }
      if (e.phase) { e.rate = share(u, e.n, 0) * 5; H = Math.max(H, e.to - S + 1); }
      if (rr > 0) H = Math.max(H, re - S + 1);
      U += e.rate + (rr > 0 ? t.rv : 0);
      if (good0) { if (e.phase && e.from === S) q0 += e.rate; if (rr > 0 && rs === S) q0 += t.rv; }
      list.push(e);
    }
    // se anche sommando le parti uguali di tutte nessun giorno arriva al suo tempo, nessuno deve cedere niente: è la 3.0
    if (quick && U <= cal.minCap) return {q0, list, tot: null, over: 0};
    const tot = new Array(H).fill(0), capAt = o => cal.capOf(S + o);
    const roomU = o => Math.max(0, Math.floor((capAt(o) - tot[o]) / 5));
    // 1. i ripassi
    for (const e of list) if (e.rr > 0) for (let d = e.rs; d <= e.re; d++) if (cal.good(d)) {
      const o = d - S, room = Math.max(0, capAt(o) - tot[o]);
      e.vs.push(o); tot[o] += e.t.rv; if (e.t.rv > room) e.over += e.t.rv - room;
    }
    // 2. lo studio, dalla verifica più vicina (list è in ordine di data)
    for (const e of list) {
      if (!e.phase) continue;
      const offs = [];
      for (let d = e.from; d <= e.to && offs.length < e.n; d++) if (cal.good(d)) offs.push(d - S);
      const f = fill(e.u, offs.map(roomU));
      let rest = f.rest;
      const ms = f.m.slice();
      // Non ci sta nei giorni di studio (4.0): i giorni prima stanno nel loro massimo. Quello che avanza va prima nel posto
      // libero dei giorni di ripasso (si finisce a ridosso: «tight»), poi sopra il massimo, ma solo nei giorni subito prima
      // della verifica (l'eccezione di Giorgio: «se domani c'è la verifica»). Si conta come «over» e il piano lo dice.
      const rv = [];
      if (rest > 0 && e.phase === 'study' && e.rr > 0 && !cal.plain) for (let d = e.rs; d <= e.re; d++) if (cal.good(d)) rv.push(d - S);
      const xm = rv.map(() => 0);
      if (rv.length) { const g = fill(rest, rv.map(roomU)); g.m.forEach((x, j) => { xm[j] = x; }); rest = g.rest; e.tight += (sum5(g.m)) * 5; }
      if (rest > 0) {
        e.over += rest * 5;
        if (rv.length) for (let j = 0; j < rv.length; j++) xm[j] += Math.ceil((rest - j) / rv.length);
        else if (e.phase === 'rush' || cal.plain) for (let j = 0; j < ms.length; j++) ms[j] += Math.ceil((rest - j) / ms.length);   // 3.0 o già a ridosso: in parti uguali
        else ms[ms.length - 1] += rest;                         // senza ripasso: il giorno prima della verifica
      }
      for (let j = 0; j < offs.length; j++) { const m = ms[j] * 5; e.ds.push(offs[j]); e.ms.push(m); tot[offs[j]] += m; }
      for (let j = 0; j < rv.length; j++) if (xm[j] > 0) { const m = xm[j] * 5; e.xs.push(rv[j]); e.xm.push(m); tot[rv[j]] += m; }
    }
    return {q0: tot[0], list, tot, over: list.reduce((s, e) => s + e.over, 0)};
  }
  const quotaAt = (c, S, L) => c.cal.good(S) ? allocate(c, S, L, true).q0 : 0;

  /* ---------- la quota della giornata e la giornata piena ---------- */
  // fatto ≥ quota − 5 min; in un giorno senza quota bastano 10 minuti (il recupero nel cuscinetto conta)
  // (con una quota di 5 minuti servono tutti e 5: un minuto solo non è una giornata)
  const fullDay = (q, min) => q > 0 ? min >= Math.max(q - 5, Math.min(q, 5)) : min >= 10;
  // La quota di oggi è quella di stamattina (registro fino a ieri): non scende mentre studia. Si ricalcola se cambiano
  // verifiche o giorni; ma una giornata già chiusa con la quota timbrata non si riapre (la quota può solo scendere).
  // «Chiusa» vuol dire piena anche rispetto alla prima quota di quel giorno (q0): abbassarla un attimo con un giro in
  // modifica o nelle impostazioni e poi rimetterla com'era non chiude la giornata.
  const dayQuota = (stamped, q0, fresh, done) => stamped != null && fullDay(stamped, done) && fullDay(q0 != null ? q0 : stamped, done) ? Math.min(stamped, fresh) : fresh;
  const stampOf = (st, T) => isObj(st.days) && isObj(st.days[T]) ? st.days[T] : null;
  // …oppure quel giorno ha finito tutto il lavoro che c'era: non resta niente da fare, la giornata è piena
  function finishedAll(c, dn, Lb, La) {
    let had = false;
    for (const t of c.tests) if (activeOn(t, dn)) { if (La[t.i] > 0) return false; if (Lb[t.i] > 0) had = true; }
    return had;
  }

  /* ---------- blocchi ---------- */
  // pezzi di lavoro (teoria, poi esercizi; prima gli argomenti che sa meno) per `need` minuti; rem ricorda cosa resta
  function workBlocks(out, t, need, rem, block) {
    const first = out.length;
    for (const p of t.order) {
      if (need <= 0 || (need < 5 && out.length > first)) break;      // niente briciole in coda
      const s = rem.get(t.id + '/' + p.id);
      if (s.th > 0) {
        let x = Math.min(s.th, need);
        const size = ceil5(x / Math.ceil(x / block));           // pezzi uguali: 30 minuti = 15 + 15, non 25 + 5
        s.th -= x; need -= x;
        for (; x > 0; x -= size) if (out.length < MAXB) out.push({tid: t.id, aid: p.id, k: 'th', min: Math.max(5, Math.min(size, x)), n: 0, rev: null});
      }
      if (need > 0 && s.ex > 0) {
        let x = Math.min(s.ex, Math.max(1, Math.round(need / p.perEx)));
        const per = Math.max(1, Math.floor(block / p.perEx)), size = Math.ceil(x / Math.ceil(x / per));
        s.ex -= x; need -= x * p.perEx;
        for (; x > 0; x -= size) { const n = Math.min(size, x); if (out.length < MAXB) out.push({tid: t.id, aid: p.id, k: 'ex', min: clamp(n * p.perEx, 5, block), n, rev: null}); }
      }
    }
  }
  // compiti di ripasso: la vigilia è leggera, prima si richiama a memoria e ci si mette alla prova
  function revBlocks(out, t, v, daysTo, block) {
    if (v <= 0) return;
    const keys = daysTo <= 1 ? (t.x.sheet ? ['sheet', 'errors', 'light'] : ['errors', 'light', 'recall'])
      : (t.x.sheet ? ['recall', 'sim', 'errors', 'sheet', 'teach'] : ['recall', 'sim', 'errors', 'teach']);
    const size = ceil5(v / Math.ceil(v / block));
    for (let x = v, k = t.revN; x > 0; x -= size, k++) if (out.length < MAXB) out.push({tid: t.id, aid: null, k: 'rev', min: Math.max(5, Math.min(size, x)), n: 0, rev: keys[k % keys.length]});
  }

  /* ---------- il piano ---------- */
  function emptyPlan(T) {
    const days = [];
    if (isDay(T)) for (let k = 0, n = num(T); k < NDAYS; k++) days.push({d: key(n + k), q: 0, off: false, study: false, over: 0, tests: [], items: []});
    return {T, today: {d: T, q: 0, done: 0, left: 0, full: false, rest: true, cushion: null, skipCost: null, skipNext: null, blocks: []}, days, tests: [], overload: 0, warnings: []};
  }
  const ACTIVE = {today: 1, rush: 1, behind: 1, ontrack: 1, ready: 1, review: 1};

  function planCore(st, T) {
    const Tn = num(T), c = build(st, Tn), cfg = c.cfg, cap = cfg.cap, cal = c.cal;
    const Lm = morning(c, Tn), Ln = c.tests.map(t => t.left);                         // stamattina · adesso
    const M = allocate(c, Tn, Lm, false);                                             // il piano di stamattina
    const done = c.dayMin.get(Tn) || 0;
    const old = stampOf(st, T);
    const q = dayQuota(old ? old.q : null, old ? old.q0 : null, M.q0, done);

    // cosa resta da fare oggi: la parte di ogni verifica (la più vicina per prima), poi il suo ripasso
    let B = Math.max(0, q - done);
    const target = B, need = [];
    for (const e of M.list) {
      const t = e.t, s0 = e.ds.length && e.ds[0] === 0 ? e.ms[0] : 0, v0 = e.vs.length && e.vs[0] === 0 ? t.rv : 0;
      const w = Math.min(Ln[t.i], Math.max(0, s0 - Math.max(0, Lm[t.i] - Ln[t.i])), B); B -= w;
      const v = Math.min(Math.max(0, v0 - t.revToday), B); B -= v;
      need.push({e, t, w, v, c: 0});
    }
    // se la quota chiede ancora minuti (es. esercizi fatti più in fretta della stima) si pesca dal lavoro dei giorni dopo
    for (const x of need) { if (B <= 0) break; const more = Math.min(Ln[x.t.i] - x.w, B); if (more > 0) { x.w += more; B -= more; } }
    const left = target - B;

    // i giorni dopo: quello che resta una volta fatta la parte di oggi
    const X = Ln.slice(); for (const x of need) X[x.t.i] = Ln[x.t.i] - x.w;
    const F = allocate(c, Tn + 1, X, false);
    const info = new Map(M.list.map(e => [e.t.i, e])), infoF = new Map(F.list.map(e => [e.t.i, e]));
    // le verifiche, una per una
    let behindSum = 0;
    const late = t => Math.min(behindOf(c, t, t.owe, Tn), floor5(Ln[t.i]));          // mai più del lavoro che resta davvero
    const tests = c.tests.map(t => {
      const e = info.get(t.i), f = infoF.get(t.i), l = Ln[t.i];
      const we = Math.min(t.rdy, Tn + HOR), r = we >= Tn ? cal.cnt(Tn, we) : 0;
      let status, behind = 0;
      if (t.graded) status = 'done';
      else if (t.dn < Tn) status = 'wait';
      else if (t.dn === Tn) status = 'today';
      else {
        behind = late(t);
        status = l <= 0 ? (Tn <= t.rdy ? 'ready' : 'review') : r === 0 ? 'rush' : behind > 0 ? 'behind' : 'ontrack';
        if (e) behindSum += behind;
      }
      const act = ACTIVE[status] && status !== 'today';
      // quello che dopo oggi non trova più posto: domani c'è già la verifica, oppure i giorni rimasti sono tutti liberi
      const lost = f ? f.over : (e ? X[t.i] : 0);
      return {id: t.id, test: t.x, status, daysTo: t.dn - Tn, total: t.total, left: l, pct: t.total > 0 ? Math.round(100 * (t.total - l) / t.total) : 100,
        readyBy: key(t.rdy), quota: !act ? 0 : status === 'review' ? t.rv : status === 'ready' ? 0 : (e ? e.rate : 0), base: {q: t.base.q, n: t.base.n},
        availLeft: act ? r : 0, behind, overload: Math.max(e ? e.over : 0, lost), reviewMin: t.rv, tight: act && e ? e.tight : 0};
    });
    const rank = s => ACTIVE[s.status] ? 0 : s.status === 'wait' ? 1 : 2;
    tests.sort((a, b) => rank(a) - rank(b) || (rank(a) === 0 ? a.daysTo - b.daysTo : b.daysTo - a.daysTo));

    // cuscinetto: giorno libero non «off»; se è indietro propone il recupero, senza obbligo
    let cushion = null;
    if (cal.cushion(Tn) && behindSum > 0) {
      cushion = {min: Math.min(cap, ceil5(behindSum))};
      let budget = cushion.min;
      for (const x of need) { const b = Math.min(late(x.t), Ln[x.t.i] - x.w, budget); if (b > 0) { x.c = b; budget -= b; } }
    }

    // blocchi ancora da fare oggi
    const blocks = [], rem = new Map();
    for (const x of need) for (const p of x.t.tp) rem.set(x.t.id + '/' + p.id, {th: p.thLeft, ex: p.exLeft});
    for (const x of need) { workBlocks(blocks, x.t, x.w, rem, cfg.block); revBlocks(blocks, x.t, x.v, x.t.dn - Tn, cfg.block); }
    for (const x of need) if (x.c > 0) workBlocks(blocks, x.t, x.c, rem, cfg.block);

    // i compiti contano come studio: la giornata è piena con verifiche + compiti (o con la quota delle verifiche e i compiti fatti)
    const hq = cal.hw(Tn), hm = hwDone(st, T);
    const tFull = fullDay(q, done) || (done > 0 && q > 0 && finishedAll(c, Tn, Lm, Ln));
    const full = hq > 0 || hm > 0 ? fullDay(q + hq, done + hm) || (q > 0 && tFull && hm >= hq - 5) : tFull;
    const sk = quotaAt(c, Tn + 1, Ln);                 // domani, se da adesso in poi oggi non fa più niente
    // …e il prossimo giorno di studio (il sabato «domani» è il cuscinetto: il conto arriva lunedì)
    let skipNext = null;
    for (let dn = Tn + 1; dn < Tn + NDAYS; dn++) if (cal.good(dn)) { const m = dn === Tn + 1 ? sk : quotaAt(c, dn, Ln); if (m > 0) skipNext = {d: key(dn), q: m}; break; }

    const onDay = new Map();
    for (const t of c.byDate) if (!t.graded) { let l = onDay.get(t.dn); if (!l) onDay.set(t.dn, l = []); l.push(t.id); }
    const days = [];
    for (let k = 0; k < NDAYS; k++) {
      const dn = Tn + k, day = {d: key(dn), q: 0, off: cal.isOff(dn), study: cal.good(dn), over: 0, tests: onDay.get(dn) || [], items: []};
      // 4.0: il tempo del giorno (max), i compiti (hw), il posto per le verifiche (cap), «oggi niente» (busy), giorno di studio (on)
      if (!cal.plain) Object.assign(day, {max: cal.max(dn), hw: cal.hw(dn), cap: cal.capOf(dn), busy: cal.busy(dn), on: cal.on(dn)});
      days.push(day);
    }
    for (const x of need) {
      if (x.w > 0) days[0].items.push({tid: x.t.id, min: x.w, phase: x.e.phase || 'study'});
      if (x.v > 0) days[0].items.push({tid: x.t.id, min: x.v, phase: 'review'});
    }
    days[0].q = q;
    for (const e of F.list) {
      e.ds.forEach((off, k) => { if (off + 1 < NDAYS && e.ms[k] > 0) { days[off + 1].items.push({tid: e.t.id, min: e.ms[k], phase: e.phase}); days[off + 1].q += e.ms[k]; } });
      e.xs.forEach((off, k) => { if (off + 1 < NDAYS && e.xm[k] > 0) { days[off + 1].items.push({tid: e.t.id, min: e.xm[k], phase: 'rush'}); days[off + 1].q += e.xm[k]; } });
      for (const off of e.vs) if (off + 1 < NDAYS) { days[off + 1].items.push({tid: e.t.id, min: e.t.rv, phase: 'review'}); days[off + 1].q += e.t.rv; }
    }
    for (const d of days) d.over = Math.max(0, d.q - (cal.plain ? cap : d.cap));

    const warnings = [];
    for (const s of tests) {
      if (s.overload > 0) warnings.push({k: 'overload', tid: s.id, min: s.overload});
      if (s.status === 'rush') warnings.push({k: 'rush', tid: s.id, min: s.left});
      else if (s.tight > 0) warnings.push({k: 'rush', tid: s.id, min: s.tight});        // finisce nei giorni di ripasso
      else if (s.status === 'behind') warnings.push({k: 'late', tid: s.id, min: s.behind});
    }
    const today = {d: T, q, done, left, full, rest: q === 0 && !cushion, cushion, skipCost: sk > 0 ? sk : null, skipNext, blocks};
    if (!cal.plain || hm > 0) Object.assign(today, {max: cal.max(Tn), hw: hq, hwDone: hm, cap: cal.capOf(Tn),
      avail: isObj(cfg.av) && Number.isFinite(cfg.av[T]) ? cfg.av[T] : null, hwSet: isObj(cfg.hav) && Number.isFinite(cfg.hav[T]) ? cfg.hav[T] : null});
    return {T, today,
      days, tests, overload: tests.reduce((s, x) => s + x.overload, 0), warnings};
  }
  // non modifica st e non lancia: se qualcosa va storto restituisce un piano vuoto con il campo error
  function plan(st, T) {
    try { if (isDay(T) && isObj(st) && isObj(st.cfg)) return planCore(st, T); } catch (e) { const p = emptyPlan(T); p.error = String(e && e.message || e); return p; }
    return emptyPlan(T);
  }

  /* ---------- la quota timbrata ---------- */
  // la quota che il piano dà al giorno dn con il registro fino al giorno prima
  const dayFresh = (c, dn) => Math.min(1440, quotaAt(c, dn, morning(c, dn)));
  const lastStamp = st => { let last = null; if (isObj(st.days)) for (const k in st.days) if (isDay(k) && (last === null || k > last)) last = k; return last; };
  // dopo una riga segnata o tolta in un giorno passato («segno ieri»): i giorni timbrati dopo si rifanno, così non resta
  // scritta una quota calcolata senza quel lavoro (un giorno già chiuso non si riapre: ci pensa dayQuota)
  function restampAfter(st, T) {
    if (!isObj(st.days)) return;
    for (const k of Object.keys(st.days).filter(k => isDay(k) && k > T).sort()) stamp(st, k, true);
  }
  // Scrive st.days[T] = {q} se manca (o se force): è la quota che i premi ritroveranno quando quel giorno sarà passato.
  // Il motore la rifà da solo a ogni riga di registro e a ogni modifica delle verifiche; chi cambia cfg a mano la rifà con force.
  // Un giorno già chiuso non si riapre: la quota forzata non sale. Restituisce true se ha cambiato qualcosa.
  function stamp(st, T, force) {
    try {
      if (!isObj(st) || !isObj(st.cfg) || !isDay(T)) return false;
      if (!isObj(st.days)) st.days = {};
      const old = isObj(st.days[T]) ? st.days[T] : null, Tn = num(T);
      const quota = dayFresh;
      let c = null, changed = false, last = null;
      // i giorni senza timbro fra l'ultimo e T (app mai aperta): si fissano adesso, così un cambio di giorni o di verifiche
      // fatto più avanti non riscrive il passato (e la serie)
      for (const k in st.days) if (k < T && isDay(k) && (last === null || k > last)) last = k;
      if (last !== null) for (let dn = Math.max(num(last) + 1, Tn - BACK); dn < Tn; dn++) { c = c || build(st, Tn); st.days[key(dn)] = {q: quota(c, dn)}; changed = true; }
      if (old && !force) return changed;
      c = c || build(st, Tn);
      const q0 = old ? (old.q0 != null ? old.q0 : old.q) : null;          // la prima quota di oggi resta quella
      const q = Math.min(1440, dayQuota(old ? old.q : null, q0, quota(c, Tn), c.dayMin.get(Tn) || 0));
      if (old && old.q === q) return changed;
      st.days[T] = q0 != null && q0 !== q ? {q, q0} : {q};
      return true;
    } catch (e) { return false; }
  }
  // dopo una modifica del lavoro (l'ho capito, non ancora, cancella): si rifà la quota di T; senza T, l'ultima timbrata
  function restamp(st, T) {
    if (isDay(T)) return stamp(st, T, true);
    const last = lastStamp(st);
    return last ? stamp(st, last, true) : false;
  }

  /* ---------- modifiche ---------- */
  const findTest = (st, id) => isObj(st) ? arr(st.tests).find(t => t && t.id === id) : null;
  const findTopic = (st, tid, aid) => { const t = findTest(st, tid); return t ? arr(t.topics).find(a => a && a.id === aid) || null : null; };

  // quante verifiche nuove ci stanno ancora il giorno T: 40 aperte insieme (senza nota e non ancora passate), 400 in tutto
  function room(st, T) {
    if (!isObj(st) || !Array.isArray(st.tests) || !isDay(T)) return 0;
    let open = 0; for (const t of st.tests) if (t && t.grade == null && typeof t.date === 'string' && t.date >= T) open++;
    return Math.max(0, Math.min(MAXT - open, MAXALL - st.tests.length));
  }
  // il lavoro di una verifica con tutto il suo registro (nomLeft = quello che resta sulla stima di partenza, owe = il dovuto)
  function workOf(st, test) {
    const rows = [];
    arr(st.log).forEach((r, ix) => { if (r && r.tid === test.id && isDay(r.d)) rows.push({r, dn: num(r.d), ix}); });
    return work(test, sortRows(rows));
  }
  // aggiunge la verifica con id nuovo, created = T e promessa calcolata; null se la data non vale o non c'è più posto (room)
  function newTest(st, T, data) {
    try {
      if (!isObj(st) || !isObj(st.cfg) || !isDay(T)) return null;
      if (!Array.isArray(st.tests)) st.tests = [];
      const p = portable(data); if (!p || room(st, T) <= 0) return null;
      let k = 0; for (const t of st.tests) { const m = /^t(\d{1,9})$/.exec(t.id); if (m) k = Math.max(k, +m[1]); }
      let created = T <= p.date ? T : p.date; if (diff(created, p.date) > MAXAGE) created = addD(p.date, -MAXAGE);
      const test = {id: 't' + (k + 1), subj: p.subj, name: p.name, date: p.date, created, sheet: p.sheet, base: {q: 0, n: 0},
        topics: p.topics.map((a, i) => Object.assign({id: 'a' + (i + 1)}, a, {thFin: 0})), grade: null, gradeD: null, feel: null, note: ''};
      const w = nominal(test.topics);
      test.base = promise(makeCal(st.cfg, num(T)), st.cfg, num(test.date), num(T), w, w, test.date);
      st.tests.push(test);
      stamp(st, T, true);
      return test;
    } catch (e) { return null; }
  }
  // dopo una modifica della verifica: la rimette in ordine. La promessa si rifà da T solo se sono cambiati il lavoro
  // previsto o la data: cambiare il titolo non cancella il ritardo.
  function rebase(st, test, T) {
    try {
      if (!isObj(st) || !isObj(st.cfg) || !isObj(test) || !isDay(T)) return false;
      const was = isObj(test.base) ? test.base : null;
      if (!portable(test)) return false;
      if (Array.isArray(test.topics)) {
        // gli argomenti tolti lasciano le loro righe senza argomento (i minuti del giorno restano), e un argomento nuovo
        // riceve un id mai usato in questa verifica: non eredita il lavoro di quello appena tolto
        const ok = a => isObj(a) && typeof a.id === 'string' && RID.test(a.id);
        const keep = new Set(test.topics.filter(ok).map(a => a.id));
        let k = 0;
        const seen = id => { const m = /^a(\d{1,9})$/.exec(id); if (m) k = Math.max(k, +m[1]); };
        keep.forEach(seen);
        for (const r of arr(st.log)) if (r && r.tid === test.id && r.aid != null) { if (typeof r.aid === 'string') seen(r.aid); if (!keep.has(r.aid)) r.aid = null; }
        for (const a of test.topics) if (isObj(a) && !ok(a)) { do { a.id = 'a' + (++k); } while (keep.has(a.id)); keep.add(a.id); }
      }
      const fixed = testOf(Object.assign({}, test, {base: was || {q: 0, n: 0}}), st.cfg);
      if (!fixed) return false;
      const id = test.id; Object.assign(test, fixed, {id});
      const w = nominal(test.topics);
      if (!was || was.w + (Number.isFinite(was.x) ? was.x : 0) !== w || was.d !== test.date)
        test.base = promise(makeCal(st.cfg, num(T)), st.cfg, num(test.date), num(T), workOf(st, test).nomLeft, w, test.date);
      stamp(st, T, true);
      return true;
    } catch (e) { return false; }
  }
  // toglie la verifica e le sue righe di registro (T, facoltativo: il giorno di cui rifare la quota)
  // Le quote già timbrate dei giorni in cui era in gioco scendono di quanto pesava lei: le giornate fatte per le altre
  // verifiche restano piene, torna indietro solo quello che era stato guadagnato con le sue righe.
  function removeTest(st, id, T) {
    if (!isObj(st) || !Array.isArray(st.tests)) return false;
    const k = st.tests.findIndex(t => t && t.id === id); if (k < 0) return false;
    const gone = st.tests[k], Tk = isDay(T) ? T : lastStamp(st);
    let c0 = null;
    try { if (Tk && isObj(st.cfg) && isObj(st.days) && isObj(gone) && isDay(gone.date) && isDay(gone.created) && Array.isArray(st.log)) c0 = build(st, num(Tk)); } catch (e) { c0 = null; }
    st.tests.splice(k, 1);
    st.log = arr(st.log).filter(r => !r || r.tid !== id);
    if (c0) try {
      const Tn = c0.Tn, c1 = build(st, Tn);
      for (let dn = Math.max(num(gone.created), Tn - HIST), end = Math.min(Tn, num(gone.date)) - 1; dn <= end; dn++) {
        const s = st.days[key(dn)]; if (!isObj(s) || !(s.q > 0)) continue;
        const less = dayFresh(c0, dn) - dayFresh(c1, dn);
        if (less > 0) { s.q = Math.max(0, s.q - less); delete s.q0; }
      }
    } catch (e) {}
    restamp(st, T);
    return true;
  }
  // aggiunge una riga al registro (pulita); null se non è valida
  function log(st, r) {
    try {
      if (!isObj(st) || !Array.isArray(st.tests)) return null;
      if (!Array.isArray(st.log)) st.log = [];
      const row = rowOf(r, new Map(st.tests.map(t => [t.id, t]))); if (!row) return null;
      st.log.push(row);
      if (st.log.length > MAXLOG) st.log.splice(0, st.log.length - MAXLOG);
      stamp(st, row.d, true);                        // la quota di quel giorno resta scritta: i premi di domani la ritrovano
      restampAfter(st, row.d);
      return row;
    } catch (e) { return null; }
  }
  // toglie l'ultima riga del giorno T
  function undo(st, T) {
    if (!isObj(st) || !Array.isArray(st.log)) return null;
    for (let k = st.log.length - 1; k >= 0; k--) if (st.log[k] && st.log[k].d === T) { const r = st.log.splice(k, 1)[0]; stamp(st, T, true); restampAfter(st, T); return r; }
    return null;
  }
  // «l'ho capito»: la teoria dell'argomento è chiusa (T, facoltativo: il giorno di cui rifare la quota)
  function setFin(st, tid, aid, on, T) {
    const a = findTopic(st, tid, aid); if (!a || a.kind === 'ex') return false;
    a.thFin = on ? 1 : 0; restamp(st, T); return true;
  }
  // «non ancora»: altri minuti di teoria, e la teoria si riapre. Il lavoro è cambiato, quindi cresce anche la promessa
  // (quei minuti divisi sui giorni che le restano): dire «non l'ho ancora capito» non lo mette in ritardo.
  function extend(st, tid, aid, min, T) {
    const a = findTopic(st, tid, aid); if (!a || a.kind === 'ex') return false;
    const test = findTest(st, tid);
    let before = null; try { before = workOf(st, test).owe; } catch (e) {}
    a.thMin = clamp(a.thMin + int(min, 0, 600, 15), 5, 600); a.thFin = 0;
    try {
      const b = test.base, Tk = isDay(T) ? T : lastStamp(st);
      if (isObj(b) && isObj(st.cfg)) {
        const after = before === null ? 0 : workOf(st, test).owe;
        if (before !== null && after > before && Tk && isDay(test.date) && b.n > 0) {
          // i giorni che restano alla promessa: da domani (la domanda «l'hai capito?» arriva dopo il blocco di oggi), oggi solo se è l'ultimo
          const Tn = num(Tk), rdy = Math.min(num(test.date) - st.cfg.buffer - 1, Tn + HOR), cal = makeCal(st.cfg, Tn);
          const k = Math.min(b.n, (rdy > Tn ? cal.cnt(Tn + 1, rdy) : 0) || (rdy >= Tn ? cal.cnt(Tn, rdy) : 0));
          // quanto deve coprire la promessa in quei giorni: se era in pari, tutto il dovuto; se era indietro, quel ritardo resta
          const cover = b.q * k, need = before <= cover ? after : cover + (after - before);
          if (k > 0 && need > cover) b.q = Math.min(1440, ceil5(need / k));
          // con il livello (4.0) lo stesso conto si fa sul tempo vero dei giorni che restano
          if (b.lv != null) {
            const from = rdy > Tn && cal.cnt(Tn + 1, rdy) > 0 ? Tn + 1 : Tn;
            let cv = 0; for (let d = from; d <= rdy; d++) if (cal.good(d)) cv += Math.min(cal.capOf(d), b.lv);
            const nd = before <= cv ? after : cv + (after - before);
            if (nd > cv) { const f = levelFor(cal, from, rdy, nd); b.lv = Math.max(b.lv, f.lv); if (f.o > 0) b.o = f.o; else delete b.o; }
          }
        }
        if (Number.isFinite(b.w)) b.x = clamp(nominal(test.topics) - b.w, 0, MAXW);
      }
    } catch (e) {}
    restamp(st, T); return true;
  }

  /* ---------- 4.0: il tempo dei giorni e i compiti ---------- */
  // un valore per giorno in cfg.av / cfg.hav (null lo toglie); restano le 120 risposte più recenti
  function putDay(cfg, k, day, v) {
    if (v == null) { if (isObj(cfg[k])) { delete cfg[k][day]; if (!Object.keys(cfg[k]).length) delete cfg[k]; } return; }
    const n = numOf(v); if (!Number.isFinite(n)) return;
    if (!isObj(cfg[k])) cfg[k] = {};
    cfg[k][day] = clamp(round5(n), 0, MAXDAY);
    const ks = Object.keys(cfg[k]).sort();
    for (const x of ks.slice(0, Math.max(0, ks.length - MAXAV))) delete cfg[k][x];
  }
  // le promesse delle verifiche aperte ripartono da T con il tempo vero dei giorni (dopo un cambio della settimana tipo)
  function repromise(st, T) {
    const cal = makeCal(st.cfg, num(T));
    for (const t of arr(st.tests)) {
      if (!isObj(t) || t.grade != null || !isDay(t.date) || t.date <= T || !isObj(t.base)) continue;
      const was = t.base, w = Number.isFinite(was.w) ? was.w : nominal(arr(t.topics));
      t.base = promise(cal, st.cfg, num(t.date), num(T), workOf(st, t).nomLeft, w, t.date);
      t.base.x = Number.isFinite(was.x) ? was.x : 0;
    }
  }
  // La settimana tipo: wk = minuti per giorno (lun..dom, compiti compresi; 0 = cuscinetto: il piano la lascia vuota e lì si
  // recupera). hwk (facoltativo) = i compiti di solito: valgono da oggi (since), i giorni passati restano com'erano.
  function setWeek(st, T, wk, hwk) {
    try {
      if (!isObj(st) || !isObj(st.cfg) || !isDay(T)) return false;
      const w = weekOf(wk); if (!w) return false;
      st.cfg.wk = w; st.cfg.days = w.map(v => v > 0 ? 1 : 0); st.cfg.cap = clamp(Math.max(...w), 30, 240);
      if (hwk !== undefined) {
        const h = Array.isArray(hwk) && hwk.length === 7 ? hwk.map(x => { const n = numOf(x); return Number.isFinite(n) ? clamp(round5(n), 0, MAXDAY) : 0; }) : null;
        const same = h && Array.isArray(st.cfg.hwk) && h.every((x, i) => x === st.cfg.hwk[i]);
        if (h && h.some(x => x > 0)) { if (!same) { st.cfg.hwk = h; st.cfg.since = T; } }
        else if (st.cfg.hwk) { delete st.cfg.hwk; delete st.cfg.since; }
      }
      repromise(st, T);
      stamp(st, T, true);
      return true;
    } catch (e) { return false; }
  }
  // Un giorno preciso: o.av = il tempo che ha (0 = niente, null = come di solito), o.hw = i compiti di quel giorno.
  // Si rifà la quota di oggi (e, per un giorno passato, quella di quel giorno e dei giorni dopo).
  function setDay(st, T, day, o) {
    try {
      if (!isObj(st) || !isObj(st.cfg) || !isDay(T) || !isDay(day) || !isObj(o)) return false;
      if ('av' in o) putDay(st.cfg, 'av', day, o.av);
      if ('hw' in o) putDay(st.cfg, 'hav', day, o.hw);
      if (day < T) { stamp(st, day, true); restampAfter(st, day); }
      stamp(st, T, true);
      return true;
    } catch (e) { return false; }
  }
  // i minuti di compiti fatti in un giorno (totale; 0 li toglie)
  function setHomework(st, day, min) {
    try {
      if (!isObj(st) || !isDay(day)) return false;
      const m = int(min, 0, 600, 0);
      if (!isObj(st.hwd)) st.hwd = {};
      if (m > 0) st.hwd[day] = m; else delete st.hwd[day];
      if (!Object.keys(st.hwd).length) delete st.hwd;
      return true;
    } catch (e) { return false; }
  }
  // il tempo di un giorno come lo vede il piano: max (compiti compresi), compiti previsti, posto per le verifiche, fatti
  function dayInfo(st, day) {
    try {
      if (!isObj(st) || !isObj(st.cfg) || !isDay(day)) return null;
      const cal = makeCal(st.cfg, num(day)), n = num(day), cfg = st.cfg;
      return {max: cal.max(n), hw: cal.hw(n), cap: cal.capOf(n), on: cal.on(n), busy: cal.busy(n), off: cal.isOff(n), good: cal.good(n),
        av: isObj(cfg.av) && Number.isFinite(cfg.av[day]) ? cfg.av[day] : null, hav: isObj(cfg.hav) && Number.isFinite(cfg.hav[day]) ? cfg.hav[day] : null,
        hwDone: hwDone(st, day), usual: Array.isArray(cfg.wk) ? cfg.wk[dow(day)] : (cfg.days[dow(day)] ? cfg.cap : 0),
        usualHw: Array.isArray(cfg.hwk) ? cfg.hwk[dow(day)] : 0};
    } catch (e) { return null; }
  }

  /* ---------- premi: tutto ricalcolato dal registro ---------- */
  function emptyRewards() {
    return {xp: 0, gems: 0, streak: 0, best: 0, brace: false, fullDays: 0, minutes: 0, exercises: 0, sessions: 0, bosses: 0, early: 0,
      comebacks: 0, grades: 0, fives: 0, topics: 0, homework: 0, byDay: new Map(), fullOn: new Set()};
  }
  function rewardsCore(st, T) {
    const Tn = num(T), c = build(st, Tn), R = emptyRewards(), n = c.tests.length;
    R.minutes = c.minutes; R.exercises = c.exercises; R.sessions = c.sessions; R.fives = c.fives;
    const stamps = new Map();
    let start = c.first;
    for (const k in st.days) if (isDay(k)) { const dn = num(k); if (dn <= Tn) { stamps.set(dn, st.days[k].q); if (st.days[k].q > 0 && dn < start) start = dn; } }
    for (const t of c.tests) if (t.cr < start) start = t.cr;
    if (isObj(st.hwd)) for (const k in st.hwd) if (isDay(k)) { const dn = num(k); if (dn < start && dn <= Tn) start = dn; }   // giorni di soli compiti
    if (Array.isArray(st.cfg.hwk) && isDay(st.cfg.since) && num(st.cfg.since) < start) start = num(st.cfg.since);     // compiti previsti da allora
    start = Math.max(start, Tn - HIST);
    // lavoro rimasto per verifica: Lb all'inizio del giorno, La alla fine
    const ptr = new Array(n).fill(0), Lb = new Array(n), La = new Array(n);
    c.tests.forEach((t, i) => { La[i] = t.totalEff; while (ptr[i] < t.hd.length && t.hd[ptr[i]] < start) La[i] = t.totalEff - t.hc[ptr[i]++]; });
    let gap = 0;
    for (let dn = start; dn <= Tn; dn++) {
      for (let i = 0; i < n; i++) { const t = c.tests[i]; Lb[i] = La[i]; if (ptr[i] < t.hd.length && t.hd[ptr[i]] === dn) La[i] = t.totalEff - t.hc[ptr[i]++]; }
      const min = c.dayMin.get(dn) || 0;
      // quota di quel giorno: quella timbrata, altrimenti quella che il piano avrebbe dato con il registro fino al giorno prima
      let q = stamps.get(dn);
      if (dn === Tn) { const old = stampOf(st, T); q = dayQuota(q === undefined ? null : q, old ? old.q0 : null, quotaAt(c, dn, morning(c, dn)), min); }   // oggi: come nel piano
      else if (c.cal.isOff(dn)) q = 0;
      else if (q === undefined) q = quotaAt(c, dn, Lb);
      // i compiti contano come studio (4.0): quelli previsti si sommano alla quota, quelli fatti ai minuti
      const hq = c.cal.hw(dn), hm = hwDone(st, key(dn));
      const tFull = fullDay(q, min) || (min > 0 && q > 0 && finishedAll(c, dn, Lb, La));
      const full = hq > 0 || hm > 0 ? fullDay(q + hq, min + hm) || (q > 0 && tFull && hm >= hq - 5) : tFull;
      R.xp += Math.min(40, Math.floor((min + hm) / 3));
      R.minutes += hm; if (hm > 0) R.homework += hm;
      q += hq;
      if (full) {
        R.fullDays++; R.xp += 5; R.gems += 5; R.streak++; gap = 0;
        if (R.streak > R.best) R.best = R.streak;
        if (R.streak % 5 === 0) R.gems += 15;
        R.fullOn.add(key(dn));
      } else if (q > 0 && dn < Tn && R.streak > 0) { if (++gap >= 2) { R.streak = 0; gap = 0; } }   // due giorni con quota saltati di fila
      if (min + hm > 0 || q > 0) R.byDay.set(key(dn), hq > 0 || hm > 0 ? {min: min + hm, q, full, hw: hm, hq} : {min, q, full});
    }
    R.brace = gap === 1 && R.streak > 0;
    for (const t of c.tests) {
      // si premia il lavoro: argomento chiuso e boss contano se almeno metà del lavoro previsto è stata fatta davvero
      // (un minuto e poi «l'ho capito» su tutto lascia la verifica «pronta», ma senza gemme)
      for (const p of t.tp) if (p.left === 0 && p.hp > 0 && 2 * p.hp >= p.thMin + p.exN * p.perEx) { R.topics++; R.gems += 3; }
      if (t.graded) { R.grades++; R.gems += 10; }
      // boss sconfitto: HP 0 con lavoro vero, prima della verifica; in anticipo se entro readyBy
      const last = t.hd.length ? t.hd[t.hd.length - 1] : null;
      if (t.left === 0 && last !== null && last < t.dn && 2 * t.totalEff >= t.total) { R.bosses++; R.gems += 25; if (last <= t.rdy) { R.early++; R.gems += 25; } }
      // rimonte: il ritardo torna a zero dopo essere stato almeno una quota. Un metro solo, quello della mattina (fino alla
      // mattina della verifica); per oggi vale quello che risulterà domattina, così il conto non sale e poi torna indietro.
      // I minuti aggiunti con «non ancora» (base.x) non fanno un ritardo: prima di dirlo quel lavoro non c'era.
      const end = Math.min(Tn, t.dn), th = Math.max(5, t.base.q), x = t.base.x > 0 ? t.base.x : 0;
      let was = false, k = 0, L = t.nomEff;
      const check = (l, dn) => { if (behindOf(c, t, Math.max(0, l - x), dn) >= th) was = true; else if (was && behindOf(c, t, l, dn) === 0) { was = false; R.comebacks++; } };
      for (let dn = Math.max(t.cr, Tn - HIST); dn <= end; dn++) {
        while (k < t.hd.length && t.hd[k] < dn) L = Math.max(0, t.nomEff - t.hn[k++]);
        check(L, dn);
      }
      if (Tn < t.dn && Tn >= t.cr) check(t.owe, Tn + 1);
    }
    return R;
  }
  function rewards(st, T) {
    try { if (isDay(T) && isObj(st) && isObj(st.cfg)) return rewardsCore(st, T); } catch (e) { const r = emptyRewards(); r.error = String(e && e.message || e); return r; }
    return emptyRewards();
  }

  /* ---------- codice STUDIO1: base64 di JSON UTF-8 ---------- */
  function b64enc(s) {
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') return Buffer.from(s, 'utf8').toString('base64');
    const by = new TextEncoder().encode(s); let bin = '';
    for (let i = 0; i < by.length; i += 0x2000) bin += String.fromCharCode.apply(null, by.subarray(i, i + 0x2000));
    return btoa(bin);
  }
  function b64dec(b) {
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') return Buffer.from(b, 'base64').toString('utf8');
    const bin = atob(b), by = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(by);
  }
  // il primo oggetto JSON del testo: se dopo il codice è rimasta attaccata qualche parola, non disturba
  function firstJson(t) {
    let depth = 0, inStr = false, esc = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; }
      else if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) return t.slice(0, i + 1);
    }
    return t;
  }
  function encode(o) {
    const tests = [];
    for (const t of arr(o && o.tests)) {
      const p = portable(t); if (p) tests.push(p);
    }
    return PREFIX + b64enc(JSON.stringify({v: 1, tests}));
  }
  // lancia Error se il codice non è valido; tollera spazi, a capo e il base64 «da URL»
  function decode(code) {
    if (typeof code !== 'string' || code.length > 400000) throw new Error('Codice non valido.');
    const s = code.replace(/\s+/g, ''), re = /studio1:/ig;
    // il messaggio che accompagna il codice può nominare «STUDIO1:» prima del codice vero (o il codice può essere incollato
    // due volte): si prova da ogni prefisso e vale il primo che si legge
    let m, err = null;
    for (let tries = 0; tries < 50 && (m = re.exec(s)); tries++) {
      try { return decodeFrom(s.slice(m.index + PREFIX.length)); } catch (e) { err = e; }
    }
    throw err || new Error('Non è un codice STUDIO1.');
  }
  function decodeFrom(text) {
    // dal prefisso fino ai «=» finali; quello che non è base64 si butta
    let b = text.replace(/=[^]*$/, '').replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
    if (b.length % 4 === 1) b = b.slice(0, -1);
    if (!b) throw new Error('Codice incompleto: copialo tutto.');
    let o;
    try { o = JSON.parse(firstJson(b64dec(b + '==='.slice(0, (4 - b.length % 4) % 4)))); } catch (e) { throw new Error('Codice rovinato o incompleto: copialo di nuovo, tutto.'); }
    if (!isObj(o) || !Array.isArray(o.tests)) throw new Error('Codice non valido.');
    const tests = [];
    for (const t of o.tests) { if (tests.length >= MAXT) break; const p = portable(t); if (p) tests.push(p); }
    if (!tests.length) throw new Error('Nel codice non ci sono verifiche.');
    return {tests};
  }
  // aggiunge le verifiche di un codice; salta i doppioni (stessa materia, nome e data). Restituisce quante ne ha aggiunte.
  function importTests(st, tests, T) {
    if (!isObj(st) || !Array.isArray(st.tests)) return 0;
    const sig = t => t.subj + '|' + String(t.name || '').trim().toLowerCase() + '|' + t.date;
    const have = new Set(st.tests.map(sig));
    let added = 0;
    for (const raw of arr(tests)) {
      const p = portable(raw); if (!p || have.has(sig(p))) continue;
      if (newTest(st, T, p)) { have.add(sig(p)); added++; }
    }
    return added;
  }

  /* ---------- 4.0: il coach capisce frasi semplici (niente AI, niente rete) ----------
     parse('domani ho solo 20 minuti', T) → {min: 20, day: T+1, …}. Restituisce solo quello che ha trovato: decide la UI. */
  const NUMW = {un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, quindici: 15,
    venti: 20, venticinque: 25, trenta: 30, trentacinque: 35, quaranta: 40, quarantacinque: 45, cinquanta: 50, sessanta: 60, novanta: 90, cento: 100};
  const WDAYS = [['lunedi', 'lun'], ['martedi', 'mar'], ['mercoledi', 'mer'], ['giovedi', 'gio'], ['venerdi', 'ven'], ['sabato', 'sab'], ['domenica', 'dom']];
  const SUBJ = [['mate', /\b(mate|matematica|mat|aritmetica|geometria|algebra|calcolo)\b/], ['ita', /\b(italiano|ita|tema|grammatica)\b/],
    ['ted', /\b(tedesco|ted|deutsch)\b/], ['fra', /\b(francese|franc)\b/], ['ing', /\b(inglese|ingl|english)\b/],
    ['sci', /\b(scienze|scienza|biologia|chimica|fisica|sci)\b/], ['sto', /\b(storia|sto)\b/], ['geo', /\b(geografia|geo)\b/], ['lat', /\b(latino|lat)\b/],
    ['vis', /\b(visiva|disegno|arte)\b/], ['mus', /\b(musica|flauto)\b/], ['efis', /\b(ginnastica|educazione fisica|ed fisica|sport)\b/]];
  const HAS = (s, re) => re.test(s);
  function norm(text) {
    return String(text || '').slice(0, 400).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[‘’´`]/g, "'").replace(/\s+/g, ' ').trim();
  }
  function minutesIn(s) {
    if (/\b(tre quarti d ?'?ora)\b/.test(s)) return 45;
    if (/\b(un )?quarto d ?'?ora\b/.test(s)) return 15;
    if (/\b(un'? ?ora e mezz[ao]|1 ora e mezz[ao])\b/.test(s)) return 90;
    let m = /\b(\d{1,2}) ?(?:ore|ora|h) ?(?:e )?mezz[ao]\b/.exec(s); if (m) return +m[1] * 60 + 30;
    m = /\b(\d{1,2})(?:[:.,h]| ?(?:ore|ora|h) ?(?:e )?)(\d{1,2}) ?(?:min|minuti|m\b|')?/.exec(s);
    if (m && /(?:ore|ora|h|:)/.test(m[0]) && +m[2] < 60) return +m[1] * 60 + (m[2].length === 1 && /[.,]/.test(m[0]) ? +m[2] * 6 : +m[2]);
    m = /\b(\d{1,2}(?:[.,]5)?) ?(?:ore|ora|h)\b/.exec(s); if (m) return Math.round(parseFloat(m[1].replace(',', '.')) * 60);
    if (/\bmezz ?'?ora\b|\bmezza ora\b/.test(s)) return 30;
    if (/\bun'? ?ora\b/.test(s)) return 60;
    m = /\b(\d{1,3}) ?(?:min|minuti|minuto|m\b|')/.exec(s); if (m) return +m[1];
    return null;
  }
  function dayIn(s, T) {
    if (/\bdopodomani\b/.test(s)) return addD(T, 2);
    if (/\bdomani\b/.test(s)) return addD(T, 1);
    if (/\b(oggi|stasera|stamattina|stamani|adesso)\b/.test(s)) return T;
    // «ora» vuol dire adesso, ma non in «un'ora», «mezz'ora», «quarto d'ora», «2 ora»
    if (/\bora\b/.test(s.replace(/(un'? ?|mezz ?'?|mezza |d ?'?|\d+ ?)ora\b/g, ' '))) return T;
    for (let i = 0; i < 7; i++) {
      const [full, short] = WDAYS[i];
      if (new RegExp('\\b(' + full + '|' + short + ')\\b').test(s)) {
        let n = (i - dow(T) + 7) % 7;                        // lo stesso giorno della settimana di oggi è oggi…
        if (n === 0 && /\bprossim[oa]\b/.test(s)) n = 7;      // …«lunedì prossimo» detto di lunedì è fra una settimana
        return addD(T, n);
      }
    }
    // «il 26», «26/11», «26.11»
    let m = /\b(\d{1,2})[./](\d{1,2})\b/.exec(s);
    if (m) { const y = +T.slice(0, 4), k = (y0 => String(y0) + '-' + pad(+m[2]) + '-' + pad(+m[1])); let c = k(y); if (isDay(c) && c < T) c = k(y + 1); if (isDay(c)) return c; }
    m = /\b(?:il|per il|lo) (\d{1,2})\b(?! ?(?:min|minuti|ore|ora|h|'))/.exec(s);
    if (m) { const dd = +m[1]; let c = T.slice(0, 8) + pad(dd); if (isDay(c) && c < T) { const nx = addD(T.slice(0, 8) + '01', 32); c = nx.slice(0, 8) + pad(dd); } if (isDay(c)) return c; }
    return null;
  }
  function parse(text, T) {
    const s0 = norm(text), out = {text: s0, min: null, day: null, subj: null, size: null, num: null, hw: false, test: false, none: false, free: false, intents: []};
    if (!s0) return out;
    const s = s0.replace(/\b[a-z]+\b/g, w => NUMW[w] != null && !/^(un|una|uno)$/.test(w) ? String(NUMW[w]) : w);
    out.min = minutesIn(s);
    if (isDay(T)) out.day = dayIn(s, T);
    for (const [k, re] of SUBJ) if (re.test(s)) { out.subj = k; break; }
    if (/\b(piccol[ao]|poc[ao]|breve|cort[ao]|facile|leggera)\b/.test(s)) out.size = 'S';
    else if (/\b(grossa|grosso|grande|lunga|tanta|tanto|enorme|difficile|pesante|tutto il)\b/.test(s)) out.size = 'L';
    else if (/\b(media|medio|normale)\b/.test(s)) out.size = 'M';
    const bare = /^\D*(\d{1,3})\D*$/.exec(s); if (bare) out.num = +bare[1];
    out.hw = HAS(s, /\bcompit/);
    out.test = HAS(s, /\b(verific|test\b|interrogazion|prova\b|esame)/);
    out.none = HAS(s, /\b(niente|nulla|zero|non ho tempo|non posso|nessun tempo|impossibile oggi|neanche un minuto)\b/);
    out.free = HAS(s, /\b(liber[oa]|vacanz|gara|gita|partita|torneo|allenamento|impegn|compleanno|festa|malat|febbre|non ci sono)\b/);
    const I = out.intents, add = (k, re) => { if (re.test(s)) I.push(k); };
    add('crisis', /\b(suicid|ammazzarmi|uccidermi|farmi del male|non voglio piu vivere|farla finita|voglio morire|tagliarmi)\b/);
    add('over', /\b(troppo|troppa|non ce la (faccio|faro)|impossibile|stress|ansia|paura|panico|agitat|tanta roba|non riesco|non ci sto dentro|sommers|disperat)\b/);
    add('nowill', /\b(voglia|palle|uffa|noia|che noia|stanc|pigr|sbatti|non mi va|mi scoccia|annoiat)\b/);
    add('next', /\b(cosa faccio|cosa devo fare|che faccio|da dove|da cosa|cosa studio|che studio|prossim[oa] cosa|inizio|comincio|parto|iniziamo|cominciamo|e adesso|e ora)\b/);
    add('left', /\b(quanto (mi )?manca|quanto devo|quanto studio|quanto tempo devo|quanti minuti|quanto ho|quanto resta)\b/);
    add('week', /\b(settimana|calendario|programma|piano)\b/);
    add('done', /\b(fatto|fatta|finito|finita|ho studiato|ho finito|completat)\b/);
    add('greet', /^(ciao|ehi|hey|ehila|buongiorno|buonasera|salve|we|yo)\b/);
    add('thanks', /\b(grazie|grz|thanks|gentile)\b/);
    add('help', /\b(aiuto|aiutami|come funzion|cosa sai fare|cosa puoi fare|help|non capisco)\b/);
    add('yes', /^(si|ok|okay|va bene|certo|dai|perfetto|vai|andiamo|yes)\b/);
    add('no', /^(no|nah|non ora|dopo|lascia stare|lascia perdere)\b/);
    add('usual', /\b(come (al )?solito|il solito|normale)\b/);
    return out;
  }

  const api = {defaults, clean, isDay, addD, dow, diff, estimate, room, newTest, rebase, removeTest, totals, log, undo, setFin, extend, stamp,
    plan, rewards, encode, decode, importTests, setWeek, setDay, setHomework, dayInfo, parse};
  root.STUDIO_ENGINE = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
