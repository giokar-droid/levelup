/* Level Up 3.0 · Studio · contenuti (solo dati, niente DOM, niente stato).
   Script classico: tutto dentro una IIFE, un solo nome globale: STUDIO_DATA.

   Forme (contratto con studio-engine.js e studio-ui.js):
     SUBJECTS   [{k, n, e}]                       materie; k breve, n nome, e emoji
     bossFor(test) -> {e, n}                      mostro fisso per materia + id della verifica
     SECTIONS   [{k, n, e}]                       sezioni di «Come si studia»
     TIPS       [{id, sec, e, t, x, why}]         sec = k di una sezione
     NOWILL     [{e, t, x}]                       soccorsi per «Non ho voglia»
     REVIEW     {recall|sim|errors|sheet|light|teach: {e, t, x, min}}
     reviewPlan(daysTo, sheet, minutes) -> [chiavi di REVIEW]   la somma dei min non supera mai `minutes`
     TESTDAY    [stringhe]
     TAUNT      {hi, mid, low, dead: [stringhe]}  battute del boss secondo i punti vita rimasti
     LINES      {rest, start, mid, full, behind, ready, review, testday, testdayOk, cushion, streak, comeback, wait}
                ognuna un array di frasi; {name} = nome del ragazzo; testdayOk solo se il piano è fatto almeno all'80 %
     INTRO      [3 lezioni: {k, e, t, x, btn, end}]   t titolo · x testo · btn etichetta del gesto · end frase a gesto fatto
     BADGES     [{id:'st…', e, n, d, g, ok: s => bool}]

   Voce: tu, frasi corte, niente «devi». In Ticino: verifica, nota (1-6, il 4 è la sufficienza). */
(function (root) {
  'use strict';

  /* ---------- materie ---------- */
  const SUBJECTS = [
    {k: 'mate',  n: 'Matematica',        e: '📐'},
    {k: 'ita',   n: 'Italiano',          e: '📖'},
    {k: 'ted',   n: 'Tedesco',           e: '🥨'},
    {k: 'fra',   n: 'Francese',          e: '🥐'},
    {k: 'ing',   n: 'Inglese',           e: '💂'},
    {k: 'sci',   n: 'Scienze',           e: '🔬'},
    {k: 'sto',   n: 'Storia',            e: '🏛️'},
    {k: 'geo',   n: 'Geografia',         e: '🌍'},
    {k: 'lat',   n: 'Latino',            e: '🏺'},
    {k: 'vis',   n: 'Educazione visiva', e: '🎨'},
    {k: 'mus',   n: 'Musica',            e: '🎵'},
    {k: 'efis',  n: 'Educazione fisica', e: '🏃'},
    {k: 'altro', n: 'Altro',             e: '📓'},
  ];

  /* ---------- mostri: 3 per materia ---------- */
  const MONSTERS = {
    mate:  [{e: '🦖', n: 'Calcolosauro'}, {e: '🎩', n: 'Il Barone Frazione'}, {e: '🐍', n: "L'Idra delle Incognite"}],
    ita:   [{e: '🧛', n: 'Il Conte Congiuntivo'}, {e: '🧙', n: 'La Strega Sintassi'}, {e: '👾', n: 'Il Mangiavirgole'}],
    ted:   [{e: '🐲', n: 'Il Tricefalo Der Die Das'}, {e: '👑', n: 'Il Kaiser Akkusativ'}, {e: '🐢', n: 'Il Verbo in Fondo'}],
    fra:   [{e: '🥖', n: 'Baguettosauro'}, {e: '👒', n: 'Madame Passé Composé'}, {e: '🤐', n: 'Monsieur Lettera Muta'}],
    ing:   [{e: '👻', n: 'Il Fantasma della Terza S'}, {e: '🤺', n: 'Sir Verbo Irregolare'}, {e: '🐙', n: 'Il Kraken dei Phrasal'}],
    sci:   [{e: '🦠', n: 'Il Mitocondrio Furioso'}, {e: '🧪', n: 'Professor Kaboom'}, {e: '🍎', n: 'Newtonzilla'}],
    sto:   [{e: '🧟', n: 'La Mummia delle Date'}, {e: '🎖️', n: 'Il Generale Causa-Effetto'}, {e: '🏰', n: 'Il Cavalier Medioevo'}],
    geo:   [{e: '🏔️', n: 'Lo Yeti delle Cartine'}, {e: '🧭', n: 'Capitan Capitale'}, {e: '🌋', n: 'Il Vulcano Brontolone'}],
    lat:   [{e: '🌹', n: 'La Rosa Rosae Carnivora'}, {e: '🗡️', n: 'Declinator Maximus'}, {e: '🛡️', n: 'Il Gladiatore Ablativo'}],
    vis:   [{e: '🖌️', n: 'Il Pennello Maledetto'}, {e: '👁️', n: 'La Prospettiva Storta'}, {e: '✏️', n: 'Lord Scarabocchio'}],
    mus:   [{e: '🎺', n: 'Lo Stonatore'}, {e: '🎶', n: 'La Semicroma Impazzita'}, {e: '🎻', n: 'Bemolle il Molle'}],
    efis:  [{e: '🚩', n: 'Mister Fuorigioco'}, {e: '📜', n: 'Il Regolamento Infinito'}, {e: '🍋', n: 'Acido Lattico il Bruciante'}],
    altro: [{e: '👹', n: 'Il Mostro del Lunedì'}, {e: '🦑', n: 'Il Verificone'}, {e: '👽', n: 'Il Terrore della Pagina Bianca'}],
  };

  // stessa verifica = stesso mostro: conta solo la materia e l'id (t1, t2, t3… girano sui tre mostri)
  function bossFor(test) {
    const t = test && typeof test === 'object' ? test : {};
    const subj = typeof t.subj === 'string' ? t.subj : '';
    const list = Object.prototype.hasOwnProperty.call(MONSTERS, subj) ? MONSTERS[subj] : MONSTERS.altro;
    const id = String(t.id == null ? '' : t.id);
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % 9973;
    const m = list[h % list.length];
    return {e: m.e, n: m.n};
  }

  /* ---------- le battute del boss: cambiano con i punti vita rimasti (hi = più di due terzi, mid, low = un quarto o meno, dead = zero) ---------- */
  const TAUNT = {
    hi:   ['«Tanto apri il quaderno la sera prima.»', '«Ho tutti i punti vita. Tu hai la PlayStation.»', '«Vediamo quanto dura, questo piano.»'],
    mid:  ['«Ehi, piano con quei blocchi!»', '«Va bene, ammetto che fai sul serio.»', '«Non potresti saltare un giorno? Uno solo.»'],
    low:  ['«Un attimo, parliamone…»', '«Chi ti ha insegnato il formulario?!»', '«Mi gira la testa. Di solito a questo punto siete voi in panico.»'],
    dead: ['«Va bene, hai vinto. Ci vediamo in verifica.»'],
  };

  /* ---------- «Come si studia» ---------- */
  const SECTIONS = [
    {k: 'start',  n: 'Partire senza voglia', e: '🚀'},
    {k: 'theory', n: 'Studiare la teoria',   e: '🧠'},
    {k: 'ex',     n: 'Esercizi',             e: '✏️'},
    {k: 'review', n: 'Ripasso e recupero',   e: '🔁'},
    {k: 'eve',    n: 'La sera prima',        e: '🌙'},
    {k: 'test',   n: 'In verifica',          e: '📝'},
    {k: 'sheet',  n: 'Il formulario',        e: '📄'},
  ];

  const TIPS = [
    /* partire senza voglia */
    {id: 'five', sec: 'start', e: '⏱️', t: 'Solo 5 minuti',
      x: "Fai un patto con te stesso: cinque minuti e poi decido. Timer acceso, la cosa più facile che c'è. Se allo squillo vuoi smettere, smetti davvero.",
      why: 'Il difficile è partire. Una volta dentro, quasi sempre vai avanti da solo.'},
    {id: 'phone', sec: 'start', e: '📵', t: "Telefono in un'altra stanza",
      x: "Non girato, non in silenzioso: proprio in un'altra stanza. Lo riprendi in pausa, è ancora lì.",
      why: 'Se è a portata di mano, un pezzo di testa resta lì ad aspettare la notifica.'},
    {id: 'ifthen', sec: 'start', e: '🚦', t: 'Se… allora…',
      x: "Decidilo prima e scrivilo: «Se sono le 17 e ho fatto merenda, allora apro mate in camera». A quell'ora non c'è più niente da decidere.",
      why: 'Chi ha già deciso quando e dove parte molto più spesso di chi aspetta la voglia.'},
    {id: 'work', sec: 'start', e: '📦', t: 'Conta il lavoro, non le ore',
      x: "Prima guarda cosa c'è da fare: quali argomenti, quanta teoria, quanti esercizi. «Studio due ore» non dice niente. «Teoria di Pitagora e 5 esercizi» sì.",
      why: 'Se sai quanto lavoro è, sai anche quando hai finito.'},
    {id: 'six', sec: 'start', e: '🍕', t: '6 ore in 6 giorni',
      x: "Sei ore di studio fanno paura. Spalmate su 6 giorni sono un'ora al giorno, più o meno una puntata di una serie. Il lavoro è lo stesso, la fatica no.",
      why: 'A pezzi piccoli e distanti ricordi di più che in una sola tirata.'},
    {id: 'realdays', sec: 'start', e: '🏖️', t: 'Conta i giorni veri',
      x: 'Prima di fare i conti guarda il calendario: vacanze, partite, gite. Quei giorni valgono zero. Segnali come liberi e il piano li salta.',
      why: 'Un piano che conta giorni in cui non studierai è in ritardo già dal primo.'},
    {id: 'lastday', sec: 'start', e: '📈', t: "L'ultimo giorno da 6 ore",
      x: "Salti un giorno e l'ora diventa un'ora e un quarto. Salti ancora e sale di nuovo. Vai avanti così e l'ultimo giorno ti ritrovi 6 ore tutte insieme.",
      why: 'Il lavoro saltato non sparisce: trasloca sui giorni dopo. Meglio saperlo prima.'},

    /* studiare la teoria */
    {id: 'recall', sec: 'theory', e: '🧠', t: 'Chiudi e scrivi',
      x: 'Leggi un pezzo, chiudi il quaderno e scrivi su un foglio tutto quello che ricordi. Poi riapri e guarda cosa mancava: quello è da ripassare.',
      why: 'Tirare fuori le cose dalla testa le fissa molto più che rileggerle.'},
    {id: 'teach', sec: 'theory', e: '🗣️', t: 'Spiegalo a qualcuno',
      x: "Spiega l'argomento a voce alta: a un genitore, a un amico, al gatto. Dove ti incarti non l'hai ancora capito. Riapri solo quel pezzo.",
      why: "Se riesci a dirlo con parole tue, l'hai capito davvero."},
    {id: 'marker', sec: 'theory', e: '🖍️', t: "L'evidenziatore mente",
      x: 'Rileggere e colorare sembra studio, ma è quasi solo guardare. Dopo ogni pagina fatti una domanda e rispondi senza sbirciare.',
      why: 'Rileggere dà la sensazione di sapere. Una domanda ti dice se sai davvero.'},
    {id: 'blocks', sec: 'theory', e: '⏲️', t: 'Blocchi e pause',
      x: '25 minuti su una cosa sola, poi 5 di pausa vera: alzati, bevi, guarda fuori. Occhio alla pausa col telefono: non dura mai cinque minuti.',
      why: "L'attenzione cala col passare dei minuti. Una pausa breve la ricarica."},

    /* esercizi */
    {id: 'nosol', sec: 'ex', e: '🙈', t: 'Prima senza soluzione',
      x: "Prova l'esercizio da solo fino in fondo, anche se viene sbagliato. La soluzione si guarda dopo, non durante.",
      why: 'Capire una soluzione e saperla trovare sono due cose diverse. In verifica serve la seconda.'},
    {id: 'errors', sec: 'ex', e: '📕', t: 'Il quaderno degli errori',
      x: 'Ogni errore te lo segni: cosa ho sbagliato, perché, qual era la mossa giusta. Prima della verifica rifai solo quelli.',
      why: 'Gli errori ti dicono esattamente dove sono i punti ancora da prendere.'},
    {id: 'mix', sec: 'ex', e: '🎲', t: 'Mescola gli esercizi',
      x: 'Non dieci uguali di fila. Alterna i tipi: uno su Pitagora, uno sulle aree, uno sulle frazioni, poi di nuovo.',
      why: 'In verifica nessuno ti dice che tipo di esercizio è. Mescolando alleni anche a riconoscerlo.'},

    /* ripasso e recupero */
    {id: 'ready2', sec: 'review', e: '🏁', t: 'Pronto 2 giorni prima',
      x: 'Fai finta che la verifica sia due giorni prima. Gli ultimi due giorni restano per il ripasso: niente di nuovo, niente corse.',
      why: 'Se qualcosa va storto hai ancora margine. E arrivi tranquillo.'},
    {id: 'cushion', sec: 'review', e: '☂️', t: 'Il cuscinetto',
      x: 'Tieniti un giorno libero a settimana, per esempio la domenica. Tutto in regola? Riposo. Hai saltato un giorno? È lì che lo recuperi.',
      why: 'Se studi 7 giorni su 7 non hai dove recuperare. Con un giorno di scorta uno sgarro non fa danni.'},
    {id: 'spaced', sec: 'review', e: '📆', t: 'Ripassa a distanza',
      x: 'Riprendi un argomento il giorno dopo, poi dopo tre giorni, poi dopo una settimana. Bastano cinque minuti a giro.',
      why: 'La memoria perde in fretta quello che vede una volta sola. Ogni ripasso lo fa durare di più.'},
    {id: 'mock', sec: 'review', e: '🧪', t: 'Fatti la verifica da solo',
      x: 'Scrivi 5 domande che potrebbero uscire, o prendi esercizi mai visti. Timer acceso, niente appunti. Poi correggi con calma.',
      why: 'Metterti alla prova prima è il ripasso che rende di più. E il giorno vero non è una sorpresa.'},

    /* la sera prima */
    {id: 'nonew', sec: 'eve', e: '🚫', t: 'Niente di nuovo',
      x: 'La sera prima solo una passata leggera: titoli, schemi, quaderno degli errori. Gli argomenti nuovi lasciali dove sono.',
      why: "La roba nuova all'ultimo fa confusione e ti convince di non sapere niente."},
    {id: 'bag', sec: 'eve', e: '🎒', t: 'Zaino pronto',
      x: 'Penna che scrive, calcolatrice, righello, formulario: tutto nello zaino prima di dormire.',
      why: 'Una cosa in meno a cui pensare domattina. La testa serve per la verifica.'},
    {id: 'sleep', sec: 'eve', e: '😴', t: 'Dormi',
      x: "Chiudi presto e vai a letto alla solita ora. L'ultima ora rubata al sonno toglie più di quello che dà.",
      why: 'È dormendo che il cervello mette in ordine quello che hai studiato.'},

    /* in verifica */
    {id: 'readall', sec: 'test', e: '👀', t: 'Leggi tutto prima',
      x: 'Due minuti per leggere tutta la verifica prima di scrivere. Segna a matita gli esercizi che sai fare subito.',
      why: "Sai cosa ti aspetta e scegli tu l'ordine, invece di scoprirlo alla fine."},
    {id: 'easy', sec: 'test', e: '🟢', t: 'Parti dal facile',
      x: 'Comincia dagli esercizi che sai. Quelli tosti dopo, con i punti sicuri già in tasca.',
      why: 'I primi punti presi calmano. E non lasci in bianco le cose che sapevi.'},
    {id: 'skip', sec: 'test', e: '⏭️', t: 'Se ti blocchi, salta',
      x: 'Fermo da un paio di minuti sullo stesso punto? Fai una crocetta e vai avanti. Ci torni alla fine.',
      why: "Spesso l'idea arriva mentre fai altro. E intanto non bruci tempo."},
    {id: 'last5', sec: 'test', e: '🔍', t: 'Gli ultimi 5 minuti',
      x: 'Tienili per rileggere: segni, unità di misura, la domanda a cui rispondevi, il nome sul foglio.',
      why: 'Gli errori di distrazione costano punti che sapevi prendere. Rileggendo li ripeschi.'},

    /* il formulario */
    {id: 'byhand', sec: 'sheet', e: '✍️', t: 'Fallo tu, a mano',
      x: 'Se il formulario è permesso, scrivilo tu a mano: corto, ordinato, a blocchi per argomento. Quello del compagno non vale.',
      why: "Scriverlo è già un ripasso. E sai dove sta ogni cosa, perché ce l'hai messa tu."},
    {id: 'use', sec: 'sheet', e: '🧰', t: 'Usalo negli esercizi',
      x: "Fai gli esercizi col formulario accanto fin da subito, come in verifica. Se non l'hai mai usato, il giorno vero perdi tempo a cercare.",
      why: 'È un attrezzo: funziona solo se ci hai già messo le mani.'},
    {id: 'when', sec: 'sheet', e: '🏷️', t: 'Scrivi quando si usa',
      x: 'Accanto a ogni formula metti due parole su quando serve, se sul foglio si può. «Area del trapezio» batte una formula senza nome.',
      why: "Sul foglio c'è la formula, non quando usarla. Quello lo impari con gli esercizi."},
  ];

  /* ---------- «Non ho voglia»: ogni soccorso parte da un gesto sotto i 2 minuti ---------- */
  const NOWILL = [
    {e: '📖', t: 'Apri e basta',
      x: 'Apri il quaderno alla pagina giusta e leggi solo il titolo. Missione finita. Se poi ti scappa la prima riga, io non ho visto niente.'},
    {e: '🖊️', t: 'La prima riga',
      x: 'Scrivi solo la data e il titolo in cima alla pagina. Trenta secondi. Una pagina iniziata chiama la riga dopo.'},
    {e: '📵', t: 'Esilia il telefono',
      x: "Porta il telefono in un'altra stanza. Venti secondi, ed è già metà del lavoro."},
    {e: '✏️', t: 'Un esercizio solo',
      x: "Scegli l'esercizio più corto della pagina e fai solo quello. Uno. Poi vediamo."},
    {e: '🧹', t: 'Sgombra il tavolo',
      x: 'Togli tutto dal tavolo tranne quaderno e penna. Un minuto. A un tavolo vuoto è più facile sedersi.'},
    {e: '💧', t: 'Acqua e finestra',
      x: "Bevi un bicchiere d'acqua, apri la finestra dieci secondi, siediti. Il corpo parte, la testa lo segue."},
    {e: '🎧', t: 'Una canzone',
      x: 'Metti la canzone che ti carica e intanto prepara quaderno e penna. Quando finisce, sei già seduto.'},
    {e: '🗒️', t: 'Tre righe',
      x: 'Scrivi su un foglio le tre cose di oggi, dalla più piccola. Poi fai solo la prima.'},
    {e: '🗣️', t: 'Dillo a qualcuno',
      x: "Di' a qualcuno in casa: «Studio 20 minuti, poi arrivo». Detto a voce alta è più difficile rimangiarselo."},
    {e: '🪑', t: 'Siediti e conta',
      x: 'Siediti al tavolo e conta fino a 10 senza toccare niente. Poi prendi la penna. Il difficile era arrivare alla sedia.'},
  ];

  /* ---------- compiti dei giorni di ripasso ---------- */
  const REVIEW = {
    recall: {e: '🧠', t: 'Foglio bianco', min: 10,
      x: 'Chiudi tutto. Su un foglio scrivi quello che ricordi di ogni argomento. Poi apri e guarda cosa mancava.'},
    sim:    {e: '⏱️', t: 'Mini verifica', min: 15,
      x: 'Tre o quattro esercizi mai visti, timer acceso, niente soluzioni. Come se fosse già il giorno vero.'},
    errors: {e: '📕', t: 'Caccia agli errori', min: 10,
      x: 'Rifai da capo solo gli esercizi che avevi sbagliato. Niente di nuovo: lì ci sono i punti che puoi ancora prendere.'},
    sheet:  {e: '📄', t: 'Formulario a posto', min: 5,
      x: 'Scorri il formulario riga per riga: sai a cosa serve ogni formula e dove sta? Riscrivi quello che non si legge.'},
    light:  {e: '🍃', t: 'Giro leggero', min: 5,
      x: 'Una passata veloce a titoli, schemi e parole chiave. Cinque minuti e chiudi: il grosso è già dentro.'},
    teach:  {e: '🗣️', t: 'Fai il prof', min: 10,
      x: "Spiega l'argomento più tosto a voce alta, a qualcuno o al muro. Dove ti blocchi c'è il buco: riapri solo quel pezzo."},
  };

  // per ogni giorno: i compiti nell'ordine in cui si fanno, con il loro peso (100/90 = cuore del giorno, 60 = formulario, sotto 10 = riempitivi)
  const REVIEW_DAYS = {
    far:  [['recall', 100], ['teach', 90], ['sheet', 60], ['errors', 8], ['sim', 6], ['light', 4]],   // 3 giorni prima o più
    two:  [['recall', 90], ['sheet', 60], ['sim', 100], ['teach', 8], ['errors', 6], ['light', 4]],   // 2 giorni prima
    one:  [['errors', 100], ['sheet', 60], ['recall', 8], ['teach', 6], ['light', 90]],               // il giorno prima
  };

  /* Quali compiti di ripasso fare a `daysTo` giorni dalla verifica, in `minutes` minuti.
     Due giorni prima: recall + sim (+ sheet). Il giorno prima: errors + light (+ sheet).
     La somma dei min scelti non supera mai `minutes`; senza `minutes` torna il cuore del giorno.
     Il giorno della verifica (daysTo <= 0) non c'è ripasso: []. Da 5 minuti in su non è mai vuoto. */
  function reviewPlan(daysTo, sheet, minutes) {
    let d = Math.round(Number(daysTo));
    if (!Number.isFinite(d)) d = 1;
    if (d <= 0) return [];
    const day = REVIEW_DAYS[d >= 3 ? 'far' : d === 2 ? 'two' : 'one'];
    const list = day.filter(c => c[0] !== 'sheet' || sheet);
    if (minutes == null) return list.filter(c => c[1] >= 60).map(c => c[0]);
    const cap = Number(minutes);
    if (!Number.isFinite(cap) || cap <= 0) return [];
    let best = 0, bestW = 0, bestM = 0;
    for (let mask = 1; mask < (1 << list.length); mask++) {
      let w = 0, m = 0;
      for (let i = 0; i < list.length; i++) if (mask & (1 << i)) { w += list[i][1]; m += REVIEW[list[i][0]].min; }
      if (m > cap) continue;
      if (w > bestW || (w === bestW && m > bestM)) { best = mask; bestW = w; bestM = m; }
    }
    return list.filter((_, i) => best & (1 << i)).map(c => c[0]);
  }

  /* ---------- il giorno della verifica ---------- */
  const TESTDAY = [
    "Colazione vera e una bottiglietta d'acqua. Il cervello a secco va piano.",
    "Stamattina niente ripassone: un'occhiata agli schemi o al formulario, e basta.",
    "Fuori dall'aula c'è sempre chi ripete tutto nel panico. Lascialo fare: quello che serve ce l'hai già.",
    "Leggi tutta la verifica prima di scrivere, poi parti dall'esercizio che sai fare meglio.",
    'Bloccato? Crocetta, avanti, ci torni dopo. Non regalare dieci minuti a un esercizio solo.',
    'Ultimi cinque minuti: rileggi segni, unità di misura e la domanda. Poi consegna e non pensarci più.',
  ];

  /* ---------- frasi del buddy ({name} = nome del ragazzo) ---------- */
  const LINES = {
    rest: [
      'Oggi niente in programma. Riposo vero, senza sensi di colpa.',
      'Oggi nessun boss da colpire, {name}. Goditela.',
      'Oggi il piano dice zero minuti. E io col piano non discuto mai.',
      'Niente da studiare oggi. Se spunta una verifica nuova mettila qui: ai conti penso io.',
      'Tutto tranquillo. I mostri dormono, e pure io.',
      'Zero minuti oggi. Succede poco: approfittane.',
      'Giornata libera, {name}. Fai una cosa che ti piace e non pensare ai quaderni.',
    ],
    start: [
      'Oggi il pezzo è piccolo. Si parte dal primo blocco.',
      'Non serve la voglia, {name}. Basta aprire il quaderno.',
      'Un blocco alla volta. Il primo è quello che pesa, poi va da solo.',
      'Il boss non si colpisce da solo. Primo blocco?',
      "Telefono in un'altra stanza, timer acceso. Il resto viene.",
      'Prima inizi, prima sei libero. Matematica pura.',
      'Oggi tocca a questi minuti qui. Non uno di più.',
      "Parti dal blocco più facile, se vuoi. L'importante è partire.",
    ],
    mid: [
      'Iniziare era la parte dura, ed è fatta. Avanti così.',
      "Bel colpo, {name}. Ne manca ancora un po'.",
      'Il boss ha sentito. Un altro blocco e sente di più.',
      'Pausa vera, poi si chiude.',
      'Già che sei caldo, il prossimo blocco costa meno.',
      "Un pezzo è in tasca. L'altro è in discesa.",
      'Ancora un blocco e oggi è a posto.',
    ],
    full: [
      'Quota di oggi fatta. Il resto della giornata è tuo.',
      'Fatto, {name}. Oggi il piano non ti chiede altro.',
      "Giornata piena. Il boss se n'è accorto.",
      'Chiuso. Adesso fai quello che vuoi, senza il pensiero dietro.',
      "Oggi la tua parte l'hai fatta. Domani c'è un altro pezzetto, piccolo uguale.",
      'Ecco fatto. Così la verifica arriva e tu sei già lì ad aspettarla.',
      'Quota fatta. Vuoi andare avanti? Vale, ma non è richiesto.',
      'Promessa mantenuta, anche oggi.',
    ],
    behind: [
      'Sei un po\' indietro sul piano. Capita. La mossa adesso: un blocco oggi.',
      'Il piano è slittato, {name}. Ho rifatto i conti: guarda i minuti di oggi e parti da lì.',
      "C'è del lavoro arretrato. Non si recupera tutto oggi: un blocco alla volta.",
      'I minuti al giorno sono saliti: è il lavoro saltato che si è spostato in avanti. Un blocco oggi e si fermano.',
      'Qualche giorno è saltato, la verifica è sempre lì. Prossima mossa: il primo blocco di oggi, anche corto.',
      'Indietro non vuol dire perso. Vuol dire che oggi conta un po\' di più.',
      'Il conto è cambiato, la strada no: primo blocco, adesso.',
      "Se c'è un giorno cuscinetto in arrivo, usalo per recuperare. Intanto oggi fai il tuo pezzo.",
    ],
    ready: [
      'Boss a terra. Sei pronto, {name}, e in anticipo.',
      'Lavoro finito prima della verifica. Adesso solo ripasso, con calma.',
      'Pronto. Chi arriva così, la sera prima dorme.',
      'Tutto fatto. Da qui in poi è manutenzione.',
      'Programma finito. I prossimi giorni servono solo a tenerlo fresco.',
      'Punti vita del boss: zero. Tuoi: tutti.',
      'Pronto prima del tempo. Era questo il piano, e ha funzionato.',
    ],
    review: [
      'Giorni di ripasso. Niente di nuovo: si lucida quello che sai già.',
      'Oggi poco e mirato, {name}. Foglio bianco e vediamo cosa esce.',
      "Ripasso leggero. Il grosso l'hai già fatto, per questo oggi è corto.",
      'Oggi si controlla, non si impara. Errori vecchi e via.',
      'Verifica vicina. Oggi si ripassa e basta.',
      'Fai finta che la verifica sia oggi. Cosa non ti verrebbe? Parti da lì.',
      'Il ripasso buono si fa a libro chiuso. Riaprirlo viene dopo.',
    ],
    // il giorno della verifica: frasi che vanno bene comunque sia andato il piano (non dicono mai «il lavoro l'hai fatto»)
    testday: [
      'È oggi. In bocca al lupo, {name}.',
      'Verifica oggi. Leggi tutto, parti dal facile, respira.',
      "Niente ripassi dell'ultimo minuto. Colazione, penna che scrive e via.",
      'Vai e fai il tuo, {name}. Dopo mi racconti.',
    ],
    // … e quelle che parlano di lavoro fatto: solo se il piano di ogni verifica di oggi è almeno all'80 %
    testdayOk: [
      "Oggi tocca a te. Il lavoro l'hai già fatto, adesso si raccoglie.",
      'Il boss finale. Tu ci arrivi allenato.',
      'In bocca al lupo. Quello che hai studiato è lì dentro: fidati.',
    ],
    cushion: [
      'Giorno cuscinetto. In regola? Riposo. Qualcosa di saltato? Oggi si recupera, se vuoi.',
      'Giorno cuscinetto: riposo se sei in pari, recupero se hai saltato. Decidi tu.',
      'Oggi il piano non chiede niente, {name}. È il giorno di scorta.',
      'Cuscinetto. Serve a questo: assorbire i colpi senza far saltare tutto.',
      "Giorno libero di serie. Se c'è da recuperare è il momento giusto, altrimenti divano.",
      'Zero minuti in programma. Se hai un arretrato, questo è il posto dove metterlo.',
      'Il giorno di scorta. Meglio averlo e non usarlo che il contrario.',
      'Cuscinetto. In pari? Goditelo. Indietro? Un blocco oggi rimette a posto i conti.',
    ],
    streak: [
      'Serie di studio accesa. Non spezzarla proprio oggi.',
      'Un altro giorno pieno in fila, {name}. La serie cresce.',
      'Giorni pieni uno dietro l\'altro. Ormai la parte difficile è fermarti.',
      'La serie tiene. Ogni 5 giorni pieni arrivano gemme.',
      'Stai andando di fila. È così che le verifiche smettono di fare paura.',
      'Serie viva. Oggi basta la quota, niente eroismi.',
      'La costanza ce l\'hai. La serie lo dimostra.',
    ],
    comeback: [
      'Eri indietro e hai recuperato. Di nuovo in pari, {name}.',
      'Arretrato azzerato. Questa è una rimonta vera.',
      'Di nuovo in linea col piano. Recuperare è più difficile che partire bene, e tu l\'hai fatto.',
      'Rimonta completata. I minuti al giorno tornano quelli di prima.',
      'Sei tornato in pari. Adesso basta tenere il ritmo normale.',
      'Da indietro a in regola. Il boss ci sperava, gli è andata male.',
      'Recuperato tutto. Chi sa rimontare non ha più paura di un giorno storto.',
    ],
    wait: [
      'Verifica fatta. Quando arriva la nota segnala qui: serve a stimare meglio la prossima.',
      "Com'è andata, {name}? Quando hai la nota, mettila.",
      "In attesa della nota. Intanto il lavoro l'hai fatto, e quello non te lo toglie nessuno.",
      'Nota in arrivo. Qualunque sia, qui vale uguale: si premia il lavoro.',
      'Aspettiamo la nota. Mi serve per capire se il piano era giusto, non per giudicarti.',
      'Verifica alle spalle. Manca solo un numero, e ci serve per tarare il prossimo piano.',
      'Quando torna la verifica corretta, segna la nota. Bella o brutta, ci insegna qualcosa.',
    ],
  };

  /* ---------- le 3 lezioni iniziali ---------- */
  const INTRO = [
    {k: 'spread', e: '🍕', t: '6 ore in 6 giorni',
      x: "6 ore di studio in 6 giorni fanno 1 ora al giorno. Ogni giorno che salti finisce sugli altri. Prova a saltare e guarda dove arrivi.",
      btn: '😬 Salto un giorno',
      end: "Eccolo: l'ultimo giorno da 6 ore. Stesso lavoro, tutto in una sera."},
    {k: 'ready', e: '🏁', t: 'Pronto 2 giorni prima',
      x: 'Il piano ti fa finire due giorni prima della verifica. Quei due giorni sono solo ripasso: niente di nuovo, niente corse. Così arrivi anche tranquillo.',
      btn: '👉 Scorri i giorni',
      end: 'Studio, poi ripasso, poi verifica. In questo ordine non si arriva mai col fiatone.'},
    {k: 'cushion', e: '☂️', t: 'Il cuscinetto',
      x: 'Se studi 7 giorni su 7 non hai dove recuperare. Tieni un giorno libero: se va tutto bene è riposo, se hai saltato è il giorno del recupero.',
      btn: '👆 Tocca i giorni in cui studi',
      end: 'Di serie il cuscinetto è la domenica. Lo cambi quando vuoi da «Giorni e tetto».'},
  ];

  /* ---------- trofei di studio (id con prefisso «st») ---------- */
  const BADGES = [
    {id: 'stb1',   e: '📚', n: 'Quaderno aperto',           d: 'Il tuo primo blocco di studio.',                                          g: 10, ok: s => s.stSessions >= 1},
    {id: 'stbo1',  e: '🗡️', n: 'Ammazzaverifiche',          d: 'Primo boss di studio a terra: lavoro finito prima della verifica.',       g: 25, ok: s => s.stBosses >= 1},
    {id: 'stbo5',  e: '🏆', n: 'Collezionista di mostri',   d: '5 boss di studio sconfitti.',                                             g: 60, ok: s => s.stBosses >= 5},
    {id: 'ste1',   e: '🏁', n: 'Due giorni in tasca',       d: 'Pronto in anticipo: lavoro finito entro la data del piano.',              g: 30, ok: s => s.stEarly >= 1},
    {id: 'ste3',   e: '😎', n: "Mai all'ultimo",            d: 'Pronto in anticipo per 3 verifiche.',                                     g: 50, ok: s => s.stEarly >= 3},
    {id: 'sts5',   e: '🔗', n: 'Cinquina',                  d: '5 giornate piene di studio di fila.',                                     g: 25, ok: s => s.stBest >= 5},
    {id: 'sts10',  e: '🚂', n: 'Inarrestabile',             d: '10 giornate piene di studio di fila.',                                    g: 50, ok: s => s.stBest >= 10},
    {id: 'stfd10', e: '🤝', n: 'Di parola',                 d: '10 giornate con la quota di studio fatta.',                               g: 30, ok: s => s.stFullDays >= 10},
    {id: 'stx50',  e: '✏️', n: 'Mano calda',                d: '50 esercizi fatti.',                                                      g: 25, ok: s => s.stExercises >= 50},
    {id: 'stx200', e: '🏭', n: 'Fabbrica di esercizi',      d: '200 esercizi fatti. A questo punto li sogni.',                            g: 60, ok: s => s.stExercises >= 200},
    {id: 'stm600', e: '✈️', n: 'Dieci ore di volo',         d: '10 ore di studio registrate. I piloti contano così.',                     g: 40, ok: s => s.stMinutes >= 600},
    {id: 'stcb',   e: '🧗', n: 'Rimonta',                   d: 'Eri indietro sul piano e sei tornato in pari.',                           g: 30, ok: s => s.stComebacks >= 1},
    {id: 'stg1',   e: '📝', n: 'Nero su bianco',            d: 'La tua prima nota registrata. Qualunque sia: serve a stimare la prossima.', g: 10, ok: s => s.stGrades >= 1},
    {id: 'stf5',   e: '⏱️', n: 'Cinque minuti e poi vediamo', d: '5 volte partito senza voglia con «Solo 5 minuti».',                     g: 30, ok: s => s.stFives >= 5},
  ];

  const DATA = {SUBJECTS, bossFor, TAUNT, SECTIONS, TIPS, NOWILL, REVIEW, reviewPlan, TESTDAY, LINES, INTRO, BADGES};
  root.STUDIO_DATA = DATA;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = DATA;
})(typeof self !== 'undefined' ? self : globalThis);
