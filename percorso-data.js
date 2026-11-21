/* Level Up 3.1 · Percorso 30 — i contenuti. Un solo nome globale: PERCORSO_DATA.
   Testi riscritti per Giorgio (parole nostre, non copie) a partire dalle mail del PRE-365 (edizioni 2023 e 2026) e del corso
   «365 - Un anno epico» 2023 di Andrea Giuliodori (EfficaceMente). Gli estratti mail, giorno per giorno, stanno in
   Dropbox/RESOURCES/EfficaceMente/GIULIO - estratti mail/. Lo skill «giulio» di Claude sa rigenerare questo file per un nuovo giro.

   Forma di un giorno:
   {n, w, e, t, idea, steps:[…], ask:[campo…], act, eve:[campo…], habit?:'id' | habitFrom?:{k,e,t,why,slot}, recall?:[…], review?:'week'|'final', src}
   campo = {k, q, kind:'text'|'line'|'scale', short?, ph?, hint?, rows?}   (k: minuscole, cifre e _, al massimo 16)
   recall = {n, k, l} (una risposta di un giorno prima) oppure {n, keys:[…], l} (più voti dello stesso giorno in una riga) */
var PERCORSO_DATA = (function () {
  'use strict';
  const RUOTA = [
    {k: 'corpo', short: 'Corpo', q: 'Corpo · salute, energia, forma', kind: 'scale'},
    {k: 'mente', short: 'Mente', q: 'Mente · focus, imparare, calma', kind: 'scale'},
    {k: 'cuore', short: 'Cuore', q: 'Cuore · famiglia, coppia, amici', kind: 'scale'},
    {k: 'anima', short: 'Anima', q: 'Anima · senso, passioni, tempo per te', kind: 'scale'},
    {k: 'abito', short: 'Lavoro', q: 'Abito · lavoro e carriera', kind: 'scale'},
    {k: 'soldi', short: 'Soldi', q: 'Portafoglio · soldi e tranquillità', kind: 'scale'},
  ];
  const RUOTA_KEYS = RUOTA.map(f => f.k);

  const CYCLE = {
    id: 'c1',
    t: 'Percorso 30 · Giulio',
    intro: "Trenta giorni, dieci minuti al giorno. La prima settimana fai la fotografia di dove sei; la seconda tracci la rotta: un obiettivo, il #mantra, l'output di ogni giorno; la terza alleni la costanza per quando la voglia manca; la quarta curi l'energia. Gli ultimi due giorni chiudi il cerchio.\n\nNon serve fare tutto alla perfezione. Serve leggere ogni giorno, fare l'esercizio quando puoi e chiudere la sera con la review: è lì che il percorso avanza.",
    src: "Rielaborato dalle mail del PRE-365 (2023 e 2026) e del corso «365 - Un anno epico» 2023 di Andrea Giuliodori, EfficaceMente.",
    pins: [
      {n: 10, k: 'mantra', l: 'Il mio #mantra', e: '🎯'},
      {n: 11, k: 'output', l: 'Il mio output di ogni giorno', e: '✅'},
      {n: 12, k: 'minimo', l: 'Il minimo dei giorni peggiori', e: '🛟'},
    ],
  };

  const WEEKS = [
    {n: 1, t: 'La fotografia'},
    {n: 2, t: 'La rotta'},
    {n: 3, t: 'La costanza'},
    {n: 4, t: "L'energia"},
    {n: 5, t: 'Il cerchio'},
  ];

  // abitudini che il percorso propone (finiscono nel tracker di Level Up con un tocco, e compaiono anche nel catalogo)
  const HABITS = [
    {id: 'pc_luce', e: '🌅', n: 'Luce all\'aperto 5 minuti', role: 'extra', type: 'bin', slot: 'am', why: "Cinque minuti fuori entro un'ora dal risveglio, anche col cielo coperto: la luce del mattino regola sonno ed energia."},
    {id: 'pc_gentile', e: '🤝', n: 'Un gesto gentile', role: 'extra', type: 'bin', slot: 'any', why: 'Un grazie, un messaggio, un favore non richiesto. Costa un minuto e cambia il clima intorno a te.'},
    {id: 'pc_primo', e: '⏱️', n: 'Due minuti sulla cosa che rimando', role: 'extra', type: 'bin', slot: 'am', why: "Ogni giorno solo l'inizio della cosa più antipatica. Quasi sempre il resto viene da sé."},
    {id: 'pc_next', e: '📝', n: 'Prossima azione scritta a fine lavoro', role: 'extra', type: 'bin', slot: 'eve', why: 'Prima di chiudere, una riga: da dove riparto domani. Così la mattina non si riparte da zero.'},
    {id: 'pc_respiro', e: '🫁', n: 'Respiro 6-6 per 3 minuti', role: 'extra', type: 'bin', slot: 'any', why: 'Inspira in 6 secondi, espira in 6. Rallenta il cuore e la testa, e si fa ovunque.'},
    {id: 'pc_caffe', e: '☕', n: 'Ultimo caffè entro le 14', role: 'extra', type: 'bin', slot: 'any', why: "La caffeina resta in circolo per ore: il caffè delle 17 lo senti all'una di notte."},
    {id: 'pc_telefono', e: '📵', n: 'Telefono fuori dalla camera', role: 'extra', type: 'bin', slot: 'eve', why: 'La notte il telefono dorme in un\'altra stanza: meno scroll a letto, sonno migliore, mattina tua.'},
    {id: 'pc_3belle', e: '✨', n: 'Tre cose belle, la sera', role: 'extra', type: 'bin', slot: 'eve', why: 'Tre righe prima di dormire: allenano lo sguardo su ciò che funziona e misurano quanta strada hai fatto.'},
  ];

  const DAYS = [
    /* ---------- settimana 1 · la fotografia ---------- */
    {n: 1, w: 1, e: '🛞', t: 'La ruota: il punto zero',
      idea: "Una ruota con un raggio corto fa sobbalzare tutto il viaggio. Prima di decidere dove andare, guarda dove sei: sei aree della vita, un voto a ciascuna, d'istinto.\n\nÈ la fotografia di partenza. Il giorno 30 la rifai e la confronti con questa.",
      steps: ["Dai un voto da 1 a 10 a ognuna delle sei aree, senza pensarci troppo.", "Scrivi mezza riga per i voti più bassi: perché quel voto?", "Scegli il raggio più corto: quello che oggi frena di più tutto il resto."],
      ask: [...RUOTA, {k: 'perche', q: 'Perché quei voti bassi?', kind: 'text', rows: 3}, {k: 'corto', q: 'Il mio raggio più corto', kind: 'line', ph: 'es. Corpo: dormo poco e mi muovo meno di prima'}],
      act: 'Una cosa piccola per il raggio più corto, oggi',
      eve: [{k: 'freno', q: 'Quale raggio oggi ti ha frenato di più, e perché?', kind: 'line'}],
      src: 'PRE-365 2026 G-31 «Sobbalzi» · PRE-365 2023 G-30 «Raggi» · 365 2023 G365 «Ruota»'},

    {n: 2, w: 1, e: '🏃', t: 'Corpo e mente: come ti vuoi sentire',
      idea: "Prima degli obiettivi viene l'immagine. Non «cosa devo fare», ma «come voglio stare» fra un anno.\n\nScrivi di getto, senza fermare la penna e senza correggere: è materia grezza, non un piano. Il piano arriva la settimana prossima.",
      steps: ["Tre minuti sul Corpo che vuoi fra un anno: energia al risveglio, forma, sonno, sport.", "Tre minuti sulla Mente: cosa vuoi imparare, quanto focus vuoi avere, come vuoi riposarti.", "Rileggi e sottolinea una frase per ciascuno: quella che ti accende di più."],
      ask: [{k: 'corpo', q: 'Il mio corpo fra un anno', kind: 'text', rows: 4}, {k: 'mente', q: 'La mia mente fra un anno', kind: 'text', rows: 4}],
      act: 'Un gesto per il corpo oggi (es. 10 minuti a piedi dopo pranzo)',
      eve: [{k: 'energia', q: "Che energia avevi oggi? Cosa te l'ha tolta o data?", kind: 'line'}],
      habit: 'pc_luce',
      src: 'PRE-365 2026 G-30 «Corpo» e G-29 «Mente» · 365 2023 G65 «Biohacking», G122 «Sole»'},

    {n: 3, w: 1, e: '❤️', t: 'Cuore e anima: chi e cosa ti nutre',
      idea: "Senza relazioni curate e senza qualcosa che ti dia senso, anche i traguardi raggiunti sanno di poco.\n\n«Anima» non vuol dire per forza religione: è quello che fai per te, non per un risultato. La natura, la musica, il silenzio, una passione lasciata in un cassetto.",
      steps: ["Tre minuti sul Cuore: famiglia, coppia, amici. Con chi vuoi passare più tempo vero?", "Tre minuti sull'Anima: cosa ti ricarica e fai troppo poco?", "Scegli una cosa, fra le due liste, da fare entro stasera."],
      ask: [{k: 'cuore', q: 'Le relazioni che voglio', kind: 'text', rows: 4}, {k: 'anima', q: 'Quello che mi ricarica', kind: 'text', rows: 3}],
      act: 'Entro stasera: una cosa per l\'anima, o attenzione vera a una persona',
      eve: [{k: 'attenzione', q: 'A chi hai dedicato attenzione vera oggi?', kind: 'line'}],
      habit: 'pc_gentile',
      src: 'PRE-365 2026 G-28 «Cuore» e G-27 «Anima» · 365 2023 G20 «RAK»'},

    {n: 4, w: 1, e: '💼', t: 'Lavoro e soldi: le priorità vere',
      idea: "Lavoro e denaro si tengono per mano: anche qui scrivi come vuoi che sia, non ancora come ci arrivi.\n\nE una verità scomoda: le priorità vere non sono quelle che diciamo. Si leggono nell'agenda e nell'estratto conto.",
      steps: ["Tre minuti sull'Abito: il lavoro che vuoi fra un anno. Risultati, clienti, competenze, come ti senti la domenica sera.", "Tre minuti sul Portafoglio: risparmi, entrate, investimenti, tranquillità.", "Due minuti con agenda ed estratto conto dell'ultimo mese: trova una spesa o un impegno non più coerente con chi vuoi essere."],
      ask: [{k: 'abito', q: 'Il mio lavoro fra un anno', kind: 'text', rows: 3}, {k: 'soldi', q: 'I miei soldi fra un anno', kind: 'text', rows: 3}, {k: 'incoerente', q: 'Una spesa o un impegno non più coerente', kind: 'line'}],
      act: 'Un passo concreto su lavoro o soldi oggi (es. tagliare quella spesa)',
      eve: [{k: 'coerente', q: 'Come hai speso oggi tempo, attenzione e soldi, rispetto a ciò che dici importante?', kind: 'line'}],
      src: 'PRE-365 2026 G-26 «Abito e Portafoglio» e G-20 «Priorità» · 365 2023 G264 «Risparmio»'},

    {n: 5, w: 1, e: '🌗', t: 'Sogno e incubo',
      idea: "Oggi unisci i raggi in un'unica immagine: la persona che vuoi diventare. Poi guardi il contrario: come sarebbe la tua vita fra un anno se continuassi con le abitudini peggiori.\n\nIl sogno tira, l'incubo spinge. Servono tutti e due: il fastidio di oggi è carburante.",
      steps: ["Un minuto: rileggi quello che hai scritto nei giorni 2, 3 e 4 (📜 I miei giorni).", "Quattro minuti di Sogno: fra un anno, che persona sei? Cosa è cambiato in te e intorno a te? Scrivi al presente.", "Quattro minuti di Incubo: stesso giorno fra un anno, ma hai ripetuto gli errori di sempre. Cosa vedi? Cosa rimpiangi?"],
      ask: [{k: 'sogno', q: 'Il mio sogno (al presente)', kind: 'text', rows: 5}, {k: 'incubo', q: 'Il mio incubo', kind: 'text', rows: 4}],
      recall: [{n: 1, k: 'corto', l: 'Il raggio corto (giorno 1)'}],
      act: 'Oggi una scelta da Sogno al posto di una da Incubo',
      eve: [{k: 'scelte', q: 'Quale piccola scelta di oggi ti avvicinava al sogno, e quale all\'incubo?', kind: 'line'}],
      src: 'PRE-365 2026 G-25 «Sogno» e G-24 «Incubo» · PRE-365 2023 G-22 e G-21'},

    {n: 6, w: 1, e: '🧭', t: 'I valori e la frase che ti frena',
      idea: "I valori sono la cornice: un obiettivo che li contraddice fa attrito ogni giorno.\n\nE c'è quasi sempre una frase che ci ripetiamo e che ci tiene fermi: «non ho tempo», «non sono costante», «ormai è tardi». È trasparente come la vernice, per questo va scovata.",
      steps: ["Pensa a tre persone che ammiri, anche personaggi di un libro o di un film: che qualità hanno?", "Scegli le tre qualità che vuoi fare tue: sono i tuoi valori.", "Scrivi la frase limitante che ti ripeti più spesso.", "Riscrivila aggiungendo «ancora»: «non sono ancora costante». Una parola, e la porta resta aperta."],
      ask: [{k: 'valori', q: 'I miei tre valori', kind: 'line'}, {k: 'frase', q: 'La frase che mi frena', kind: 'line'}, {k: 'ancora', q: 'La stessa frase, con «ancora»', kind: 'line'}],
      act: 'Oggi agisci almeno una volta secondo uno dei tuoi valori',
      eve: [{k: 'frase', q: 'Quando è comparsa oggi la tua frase limitante? Cosa hai fatto?', kind: 'line'}],
      src: 'PRE-365 2026 G-22 «Valori» e G-21 «Convinzioni» · 365 2023 G348 «Parolina», G82 «Etichetta»'},

    {n: 7, w: 1, e: '🔎', t: 'Review della settimana 1',
      idea: "La fotografia è fatta. Oggi niente di nuovo: rileggi e decidi.\n\nNel metodo 365 la review della settimana si chiama SAM, stato avanzamento: dieci minuti fissi, ogni settimana. È il motore del percorso, più di qualsiasi esercizio.",
      steps: ["Rileggi i giorni 1-6 (📜 I miei giorni).", "Scegli la frase che ti ha colpito di più.", "Scegli l'area su cui lavori nei prossimi 23 giorni: di solito è il raggio corto, a volte quella che sblocca le altre.", "Stasera, nella review, guarda le tue abitudini della settimana e decidi cosa tenere."],
      ask: [{k: 'frase', q: 'La frase della settimana', kind: 'line'}, {k: 'area', q: "L'area dei miei 30 giorni", kind: 'line'}],
      recall: [{n: 1, keys: RUOTA_KEYS, l: 'I voti del giorno 1'}, {n: 6, k: 'valori', l: 'I tuoi valori'}],
      act: 'Di\' a una persona su cosa lavorerai nelle prossime settimane',
      eve: [{k: 'tengo', q: 'Una cosa che tieni della settimana, una che lasci', kind: 'line'}],
      review: 'week',
      src: '365 2023 G8 «SAM» · newsletter «Revisione settimanale minimal» (2019)'},

    /* ---------- settimana 2 · la rotta ---------- */
    {n: 8, w: 2, e: '1️⃣', t: 'Uno: l\'obiettivo dei 30 giorni',
      idea: "Chi insegue tutto non prende niente. Scegli UN obiettivo per questo percorso, nell'area che hai scelto ieri.\n\nNon deve essere perfetto: deve essere uno. Gli altri non spariscono, aspettano. Nei giorni storti saprai cosa proteggere.",
      steps: ["Elenca da 3 a 5 cose che vorresti ottenere in quell'area.", "Per ognuna chiediti: in 30 giorni è fattibile, ma mi costa uno sforzo vero?", "Scegline una. Se è troppo grande, scrivi la tappa che puoi raggiungere entro il giorno 30."],
      ask: [{k: 'lista', q: 'Le cose che vorrei ottenere', kind: 'text', rows: 4}, {k: 'obiettivo', q: "L'obiettivo dei miei 30 giorni", kind: 'line', ph: 'es. 40 chiamate a clienti nuovi entro il giorno 30'}],
      recall: [{n: 7, k: 'area', l: "L'area che hai scelto"}],
      act: "Una prima mossa minuscola verso l'obiettivo, oggi",
      eve: [{k: 'protetto', q: "Oggi l'hai protetto o sacrificato a qualcos'altro?", kind: 'line'}],
      src: 'PRE-365 2026 G-14 «Uno» e G-15 «Prospettiva» · PRE-365 2023 G-14 «Uno»'},

    {n: 9, w: 2, e: '⛏️', t: 'I cinque perché',
      idea: "Non serve la motivazione: serve una ragione. Quella vera sta sotto tre o quattro strati di risposte educate.\n\nSi scava con una domanda sola, ripetuta cinque volte: perché?",
      steps: ["Scrivi perché vuoi raggiungere l'obiettivo.", "Alla risposta chiedi di nuovo: perché?", "Continua fino al quinto perché, senza fermarti alla risposta di facciata.", "Leggi l'ultimo ad alta voce: è quello che ti alzerà dal letto il giorno 18."],
      ask: [{k: 'perche', q: 'I miei cinque perché', kind: 'text', rows: 5}, {k: 'quinto', q: 'Il quinto perché, in una riga', kind: 'line'}],
      recall: [{n: 8, k: 'obiettivo', l: "L'obiettivo"}],
      act: 'Rileggi il quinto perché prima della cosa più difficile di oggi',
      eve: [{k: 'mosso', q: 'Il quinto perché oggi ti ha mosso? Se no, è ancora quello giusto?', kind: 'line'}],
      src: 'PRE-365 2026 G-12 «Motivazione» · PRE-365 2023 G-12 «Ragioni»'},

    {n: 10, w: 2, e: '🎯', t: 'Il #mantra',
      idea: "L'obiettivo ha bisogno di due voci. Una per la testa: chiaro, misurabile, con una data. Una per il cuore: una parola o un hashtag che ti emoziona e dice chi stai diventando.\n\nIl #mantra lo rileggi ogni mattina: è la bussola dei prossimi venti giorni. Da oggi te lo mostro in cima al percorso.",
      steps: ["Riscrivi l'obiettivo in modo che il giorno 30 si possa rispondere sì o no: cosa, quanto, entro quando.", "Trova il #mantra: un'emozione più una nuova identità (es. #LeggerezzaRitrovata, #ConsulenteCheChiama).", "Scrivilo dove lo vedi ogni mattina: sfondo del telefono, un post-it sullo specchio."],
      ask: [{k: 'smart', q: 'Obiettivo: cosa, quanto, entro quando', kind: 'line'}, {k: 'mantra', q: 'Il mio #mantra', kind: 'line', ph: '#…'}],
      recall: [{n: 8, k: 'obiettivo', l: "L'obiettivo"}, {n: 9, k: 'quinto', l: 'Il quinto perché'}],
      act: 'Metti il #mantra dove lo vedi ogni mattina',
      eve: [{k: 'guidato', q: "Oggi il #mantra ti ha guidato, o l'hai dimenticato?", kind: 'line'}],
      src: 'PRE-365 2026 G-10 «Mantra» · PRE-365 2023 G-10 «#Mantra»'},

    {n: 11, w: 2, e: '✅', t: "L'output: l'unica azione che controlli",
      idea: "Il #mantra è il risultato, e il risultato non lo controlli del tutto. L'output sì: è la singola azione di ogni giorno, al cento per cento nelle tue mani, che ripetuta muove il mantra più di ogni altra.\n\nDeve essere binaria: la sera si dice fatta o non fatta, senza discussioni. Messa nel tracker, diventa il tuo segnapunti.",
      steps: ["Elenca tre azioni che, fatte ogni giorno, ti porterebbero al mantra.", "Scegli quella che dipende solo da te.", "Rendila specifica e binaria: cosa, quanto, quando (es. «2 chiamate prima delle 10», «20 minuti di corsa»).", "Se ti spaventa, dimezzala: la costanza batte l'intensità."],
      ask: [{k: 'lista', q: 'Tre azioni possibili', kind: 'text', rows: 3}, {k: 'output', q: 'Il mio output di ogni giorno', kind: 'line', ph: 'es. 2 chiamate prima delle 10'}],
      recall: [{n: 10, k: 'mantra', l: 'Il #mantra'}],
      habitFrom: {k: 'output', e: '✅', t: "Metti l'output nel tracker", why: 'È il segnapunti del metodo: ogni sera lo segni e Level Up conta la serie. Come atomica accende la fiamma.', slot: 'any'},
      act: "Fai l'output per la prima volta, oggi",
      eve: [{k: 'ostacolo', q: "Se non l'hai fatto: cosa te l'ha impedito?", kind: 'line'}],
      src: 'PRE-365 2026 G-5 «Output» e G-4 «Segnapunti» · 365 2023 G94 «Processo», G270 «Traducilo», G271 «Dimezzalo»'},

    {n: 12, w: 2, e: '🛟', t: 'Il minimo dei giorni peggiori',
      idea: "Arriveranno giorni storti: febbre, trasferte, notti corte. Se non hai deciso prima cosa fare, decide la stanchezza.\n\nLa versione minima dell'output è quella che fai anche nel giorno peggiore. È piccola, ma la serie non si rompe, e domani riparti da lì e non da zero.",
      steps: ["Scrivi la versione minima del tuo output: un quinto di quella normale, due minuti al massimo.", "Scrivi quando scatta (es. «se torno a casa dopo le 21»).", "Decidi la regola d'oro: mai saltare due giorni di fila."],
      ask: [{k: 'minimo', q: "L'output minimo dei giorni peggiori", kind: 'line'}, {k: 'quando', q: 'Scatta quando…', kind: 'line'}],
      recall: [{n: 11, k: 'output', l: "L'output"}],
      act: 'Scrivi il minimo accanto al #mantra, dove lo vedi ogni mattina',
      eve: [{k: 'serviva', q: "Oggi ti sarebbe servito il minimo? L'avresti fatto?", kind: 'line'}],
      src: '365 2023 G246 «Backup», G43 «Emergenza», G363 «Peggio»'},

    {n: 13, w: 2, e: '🪨', t: 'Gli scogli: se succede X, faccio Y',
      idea: "Gli ostacoli si vedono da lontano: le solite tentazioni, le persone che ti tirano indietro, le ore in cui crolli.\n\nDecidere oggi come reagire costa poco e salva il percorso domani. La formula è una sola: se succede X, faccio Y.",
      steps: ["Elenca tre scogli probabili sulla rotta del #mantra.", "Per ognuno scrivi la regola «Se… allora…».", "Togli adesso una tentazione dall'ambiente (l'app dalla prima schermata, i biscotti dalla scrivania): è il piano B più forte che esista."],
      ask: [{k: 'scogli', q: 'Le mie tre regole «se… allora…»', kind: 'text', rows: 4}, {k: 'tolta', q: 'La tentazione che ho tolto', kind: 'line'}],
      act: 'Applica oggi una delle tue regole «se… allora…»',
      eve: [{k: 'scoglio', q: 'Si è presentato uno scoglio? Hai usato la regola?', kind: 'line'}],
      src: 'PRE-365 2026 G-9 «Scogli» · 365 2023 G184 «Disciplina», G187 «Decisioni»'},

    {n: 14, w: 2, e: '🗺️', t: 'Review della settimana 2: la rotta è tracciata',
      idea: "Hai il #mantra, l'output, il minimo e le regole. Da qui in avanti conta solo farlo, e misurarlo.\n\nLa review di oggi è un SAM vero: quante volte hai fatto l'output, cosa ha funzionato, cosa correggi. Una correzione sola: le rivoluzioni non durano.",
      steps: ["Stasera guarda nel riquadro delle abitudini quante volte hai fatto l'output.", "Scrivi la mossa migliore e l'errore peggiore della settimana.", "Decidi una sola correzione per la settimana 3.", "Blocca in agenda uno slot fisso per l'output, come un appuntamento con un cliente."],
      ask: [{k: 'migliore', q: 'La mossa migliore della settimana', kind: 'line'}, {k: 'errore', q: "L'errore peggiore", kind: 'line'}, {k: 'correzione', q: 'La correzione per la settimana 3', kind: 'line'}, {k: 'slot', q: 'Il mio slot fisso in agenda', kind: 'line', ph: 'es. lunedì-venerdì 8:30-9:00'}],
      act: "Lo slot per l'output è in agenda",
      eve: [{k: 'tengo', q: 'Una cosa che tieni della settimana, una che lasci', kind: 'line'}],
      review: 'week',
      src: '365 2023 G8 «SAM», G88 «Analizza», G95 «Appuntamento»'},

    /* ---------- settimana 3 · la costanza ---------- */
    {n: 15, w: 3, e: '🦶', t: 'Il piede nella porta',
      idea: "La motivazione arriva dopo l'inizio, non prima. Il trucco è rendere l'inizio così piccolo che dire di no sembri ridicolo: aprire il file, mettere le scarpe, comporre il primo numero.\n\nChi inizia, quasi sempre continua: il cervello odia le cose lasciate a metà.",
      steps: ["Pensa alla cosa che stai rimandando di più.", "Scrivi la sua azione minima, fisica, da due minuti.", "Falla adesso, quei due minuti e basta.", "Annota come ti senti dopo."],
      ask: [{k: 'rimando', q: 'La cosa che rimando', kind: 'line'}, {k: 'minima', q: 'La sua azione minima (2 minuti)', kind: 'line'}, {k: 'dopo', q: "Come mi sento dopo averla iniziata", kind: 'line'}],
      act: 'Altri due minuti sulla cosa che rimandi, entro stasera',
      eve: [{k: 'continuato', q: 'Una volta iniziato, hai continuato?', kind: 'line'}],
      habit: 'pc_primo',
      src: '365 2023 G325 «Piede», G172 «Qualcosa», G342 «Micro» · newsletter EfficaceMente 08.2026 (Steinbeck)'},

    {n: 16, w: 3, e: '📝', t: 'Tre domande e la prossima azione',
      idea: "Quando rimandi, di solito non è pigrizia: è un'emozione che eviti. Tre domande la smontano in un minuto.\n\nE ogni lavoro dovrebbe finire con una riga: la prossima azione concreta. Domani mattina riparti da lì, non da zero.",
      steps: ["Scegli una cosa che stai rimandando e rispondi per iscritto: dove sono adesso? Cosa voglio fare davvero? Come mi sentirò stasera se lo rimando ancora?", "Scrivi la prossima azione concreta per ognuna delle tre cose importanti di oggi.", "Da oggi, prima di chiudere un lavoro, scrivi da dove riparti."],
      ask: [{k: 'tre', q: 'Le mie tre risposte', kind: 'text', rows: 4}, {k: 'next', q: 'La prossima azione delle tre cose di oggi', kind: 'text', rows: 3}],
      act: 'Chiudi ogni lavoro di oggi scrivendo la prossima azione',
      eve: [{k: 'next', q: 'Hai lasciato scritta la prossima azione? Da dove riparti domani?', kind: 'line'}],
      habit: 'pc_next',
      src: '365 2023 G170 «Procrastinazione», G173 «Next»'},

    {n: 17, w: 3, e: '⏳', t: "L'impulso aspetta 15 minuti",
      idea: "Gli impulsi hanno la vita breve: il telefono, lo spuntino, la mail che ti porta fuori strada. Se li fai aspettare, perdono forza.\n\nNon devi vietarti niente: rimandi soltanto di quindici minuti. Spesso, dopo, non ti interessa più.",
      steps: ["Scrivi l'impulso più frequente che ti porta fuori rotta.", "La regola: quando arriva, guardo l'ora e aspetto 15 minuti.", "Prepara cosa fai nell'attesa (un bicchiere d'acqua, dieci respiri, la prossima azione).", "Bonus: nelle code e ai semafori niente telefono. Lascia arrivare la noia: è lì che la testa si riposa."],
      ask: [{k: 'impulso', q: 'Il mio impulso più frequente', kind: 'line'}, {k: 'attesa', q: 'Cosa faccio nei 15 minuti', kind: 'line'}],
      act: "Fai aspettare l'impulso almeno tre volte, oggi",
      eve: [{k: 'volte', q: "Quante volte l'hai fatto aspettare? Com'è andata?", kind: 'line'}],
      src: '365 2023 G216 «Impulsività», G313 «Gratificazione»'},

    {n: 18, w: 3, e: '🔋', t: 'Non riesco, o non ne ho voglia?',
      idea: "«Non riesco» chiude la porta. «Non ne ho voglia» la lascia socchiusa: è una sensazione, e le sensazioni passano.\n\nCambiare la parola cambia la scelta. E siamo al punto in cui la spinta dei primi giorni cala: è normale, era previsto. Adesso lavora il sistema.",
      steps: ["Rileggi il tuo quinto perché, qui sopra.", "Scrivi tre frasi «non riesco a…» che ti dici spesso.", "Riscrivile così: «non ho voglia di…, ma lo faccio perché…».", "Scegline una da fare oggi."],
      ask: [{k: 'riscritte', q: 'Le mie tre frasi riscritte', kind: 'text', rows: 4}],
      recall: [{n: 9, k: 'quinto', l: 'Il quinto perché'}, {n: 10, k: 'mantra', l: 'Il #mantra'}],
      act: 'La cosa che non avevi voglia di fare: fatta',
      eve: [{k: 'appetito', q: 'La voglia è arrivata dopo aver iniziato?', kind: 'line'}],
      src: '365 2023 G324 «Persuasione», G339 «Appetito» · newsletter «La trappola del primo stadio» (2026)'},

    {n: 19, w: 3, e: '🏷️', t: "Tre prove contro l'etichetta",
      idea: "«Con l'ordine sono un disastro», «lo sport non fa per me», «le chiamate a freddo non sono il mio forte»: le etichette si comportano da profezie. Ci credi, e le fai avverare.\n\nPer staccarle servono prove contrarie, anche piccole. Ce ne sono sempre: basta cercarle.",
      steps: ["Scrivi l'etichetta che ti dai più spesso (forse è parente della frase del giorno 6).", "Trova tre episodi, anche minimi, in cui hai fatto il contrario.", "Scrivi la nuova etichetta, al presente: «sto diventando una persona che…»."],
      ask: [{k: 'etichetta', q: 'La mia etichetta', kind: 'line'}, {k: 'prove', q: 'Tre prove contrarie', kind: 'text', rows: 3}, {k: 'nuova', q: 'La nuova etichetta', kind: 'line', ph: 'Sto diventando una persona che…'}],
      recall: [{n: 6, k: 'ancora', l: 'La frase del giorno 6'}],
      act: 'Una quarta prova, oggi',
      eve: [{k: 'prova', q: 'Qual è stata la prova di oggi?', kind: 'line'}],
      src: '365 2023 G82 «Etichetta», G348 «Parolina», G136 «Diventare»'},

    {n: 20, w: 3, e: '🫁', t: 'Spegnere il rumore',
      idea: "Lo stress in sé non è il nemico: il nemico è il pensiero che gira in tondo. Tre leve lo interrompono: muoverti, respirare lento, sorprenderti.\n\nLa più semplice la porti ovunque: inspira in sei secondi, espira in sei, per tre minuti.",
      steps: ["Fai adesso tre minuti di respiro 6-6, con il timer.", "Scrivi cosa ti preoccupa di più in questo periodo.", "Dividilo in due: cosa dipende da me, cosa no.", "Per ciò che dipende da te, un'azione. Il resto lo lasci andare, per iscritto."],
      ask: [{k: 'dipende', q: "Dipende da me (e l'azione)", kind: 'text', rows: 3}, {k: 'nondipende', q: 'Non dipende da me: lo lascio andare', kind: 'text', rows: 2}],
      act: 'Tre minuti di respiro 6-6 prima del momento più teso di oggi',
      eve: [{k: 'teso', q: 'Nel momento teso hai respirato? Cosa è cambiato?', kind: 'line'}],
      habit: 'pc_respiro',
      src: '365 2023 G143 «Rottura», G100 «Stoicismo», G39 «Sfere», G31 (respirazione)'},

    {n: 21, w: 3, e: '🧰', t: 'Review della settimana 3: la cassetta degli attrezzi',
      idea: "Questa settimana hai provato sei attrezzi per i momenti in cui la voglia manca. Non servono tutti: servono i due che funzionano per te.\n\nE guarda l'output con onestà. Sotto quattro giorni su sette non è un fallimento: è il segnale che va rimpicciolito.",
      steps: ["Rileggi i giorni 15-20.", "Scegli i due attrezzi che tieni (piede nella porta, tre domande, quindici minuti, «non ne ho voglia», prove, respiro).", "Stasera guarda quante volte hai fatto l'output: se sotto 4 su 7, dimezzalo.", "Una sola correzione per la settimana 4."],
      ask: [{k: 'attrezzi', q: 'I miei due attrezzi', kind: 'line'}, {k: 'correzione', q: 'La correzione per la settimana 4', kind: 'line'}],
      act: 'Usa uno dei tuoi due attrezzi, oggi, apposta',
      eve: [{k: 'tengo', q: 'Una cosa che tieni della settimana, una che lasci', kind: 'line'}],
      review: 'week',
      src: '365 2023 G271 «Dimezzalo», G267 «Revisiona» · newsletter «Frequenza, intensità, volume» (2023)'},

    /* ---------- settimana 4 · l'energia ---------- */
    {n: 22, w: 4, e: '🔄', t: 'Il recupero',
      idea: "I migliori atleti non si allenano di più: recuperano meglio. Alla base della piramide del recupero ci sono quattro cose banali e decisive: sonno, rilassamento, cibo, acqua.\n\nSe una manca, nessuna tecnica la compensa.",
      steps: ["Dai un voto da 1 a 10 a sonno, pause, cibo e acqua della settimana passata.", "Prendi il più basso e scrivi una regola piccola (es. «a letto entro le 23», «ultimo caffè alle 14»).", "Mettila in agenda, o nel tracker."],
      ask: [{k: 'sonno', short: 'Sonno', q: 'Sonno', kind: 'scale'}, {k: 'pause', short: 'Pause', q: 'Pause e relax', kind: 'scale'}, {k: 'cibo', short: 'Cibo', q: 'Cibo', kind: 'scale'}, {k: 'acqua', short: 'Acqua', q: 'Acqua', kind: 'scale'}, {k: 'regola', q: 'La mia regola di recupero', kind: 'line'}],
      act: 'Rispetta la regola di recupero, oggi',
      eve: [{k: 'energia', q: 'Com\'era la tua energia stasera, rispetto agli altri giorni?', kind: 'line'}],
      habit: 'pc_caffe',
      src: '365 2023 G220 «Piramide», G123 «Caffeina», G122 «Sole», G32 (recupero)'},

    {n: 23, w: 4, e: '📵', t: 'Il telefono fuori dalla stanza',
      idea: "Il telefono si prende i ritagli di tempo, poi le serate, poi il sonno. Il tempo schermo lo dice con un numero solo.\n\nL'obiettivo di oggi: sotto i sessanta minuti di uso libero, e la notte il telefono dorme in un'altra stanza.",
      steps: ["Apri Impostazioni → Tempo di utilizzo: scrivi la media al giorno e le tre app che lo mangiano.", "Togli dalla prima schermata l'app che ti ruba più tempo.", "Decidi dove dorme il telefono stanotte (non in camera) e come ti svegli (una sveglia vera costa pochi franchi)."],
      ask: [{k: 'media', q: 'Il mio tempo schermo medio al giorno', kind: 'line'}, {k: 'top3', q: 'Le tre app che lo mangiano', kind: 'line'}],
      act: 'Stanotte il telefono dorme fuori dalla camera',
      eve: [{k: 'schermo', q: 'Quanto tempo schermo oggi? Cosa hai fatto con il tempo liberato?', kind: 'line'}],
      habit: 'pc_telefono',
      src: '365 2023 G277 «Riduci»'},

    {n: 24, w: 4, e: '🛡️', t: 'Il blocco protetto',
      idea: "Le cose importanti raramente sono urgenti, così perdono sempre contro quelle urgenti. L'unica difesa è un blocco in agenda, protetto come l'appuntamento con il cliente più importante.\n\nNotifiche spente, porta chiusa, una cosa sola.",
      steps: ["Scegli la cosa più importante della settimana per il tuo #mantra.", "Prenota in agenda un blocco di 60-90 minuti nei prossimi due giorni.", "Scrivi le regole del blocco: dove sta il telefono, mail chiusa, cosa rispondi se ti interrompono."],
      ask: [{k: 'cosa', q: 'La cosa più importante della settimana', kind: 'line'}, {k: 'quando', q: 'Il mio blocco (giorno e ora)', kind: 'line'}, {k: 'regole', q: 'Le regole del blocco', kind: 'text', rows: 3}],
      recall: [{n: 10, k: 'mantra', l: 'Il #mantra'}],
      act: 'Il blocco è in agenda, e domani lo difendi',
      eve: [{k: 'decisione', q: 'Una decisione di oggi che rifaresti diversa, e perché', kind: 'line'}],
      src: '365 2023 G304 «Tempo», G95 «Appuntamento», G108 «Metacognizione»'},

    {n: 25, w: 4, e: '🦁', t: 'Un «mai» da sfidare',
      idea: "Tutti abbiamo dei «io mai»: parlare in pubblico, chiedere un favore, chiamare quel cliente, ballare. Spesso ci proteggono solo da un disagio di cinque minuti.\n\nIl coraggio si allena come un muscolo: con ripetizioni piccole, non con le imprese.",
      steps: ["Scrivi tre «mai», o tre cose che eviti.", "Scegli quella che, sbloccata, aiuterebbe di più il tuo #mantra.", "Riducila alla versione più piccola possibile e falla oggi.", "Variante: fai una richiesta audace mettendo in conto un no. Il no non fa male quanto sembra."],
      ask: [{k: 'mai', q: 'I miei tre «mai»', kind: 'text', rows: 3}, {k: 'scelta', q: 'Quello che sfido oggi, in versione minima', kind: 'line'}],
      act: 'La versione minima del «mai», oggi',
      eve: [{k: 'paura', q: 'Prima, quanto era grande la paura? E dopo, quanto lo era davvero?', kind: 'line'}],
      src: '365 2023 G332 «Mai», G196 «Colleziona», G292 «Recinto»'},

    {n: 26, w: 4, e: '🔋', t: 'Il tempo che ricarica',
      idea: "Non tutto il tempo libero ricarica. C'è il tempo pieno, che ti accende; il tempo vuoto, che ti riposa; il tempo sprecato, che ti svuota anche quando sembra riposo.\n\nConoscere le tue tre liste ti fa scegliere meglio, soprattutto la sera.",
      steps: ["Elenca tre attività di tempo pieno, tre di tempo vuoto, tre di tempo sprecato.", "Guarda la settimana passata: quanto spazio ha avuto ogni lista?", "Metti in agenda un'attività di tempo pieno entro domenica."],
      ask: [{k: 'pieno', q: 'Tempo pieno (mi accende)', kind: 'line'}, {k: 'vuoto', q: 'Tempo vuoto (mi riposa)', kind: 'line'}, {k: 'sprecato', q: 'Tempo sprecato (mi svuota)', kind: 'line'}],
      act: 'Stasera una cosa di tempo pieno o vuoto, al posto di una di tempo sprecato',
      eve: [{k: 'tempo', q: 'Com\'è stato il tuo tempo libero oggi?', kind: 'line'}],
      src: '365 2023 G275 «Soddisfazione», G239 «Semplificato»'},

    {n: 27, w: 4, e: '✨', t: 'Tre cose belle e la strada fatta',
      idea: "Il cervello misura la distanza dal traguardo, e si scoraggia. Prova a misurare la distanza dal punto di partenza: è la strada che hai già fatto.\n\nPer questo la gratitudine funziona, se è concreta. Tre cose belle scritte la sera cambiano come ti addormenti.",
      steps: ["Rileggi i voti del giorno 1, qui sopra.", "Scrivi tre cose che oggi vanno meglio di ventisette giorni fa.", "Scegli una persona a cui dire grazie e diglielo entro stasera, con un messaggio o di persona."],
      ask: [{k: 'gain', q: 'Tre cose che vanno meglio di 27 giorni fa', kind: 'text', rows: 3}, {k: 'grazie', q: 'La persona a cui dico grazie', kind: 'line'}],
      recall: [{n: 1, keys: RUOTA_KEYS, l: 'I voti del giorno 1'}, {n: 1, k: 'corto', l: 'Il raggio corto'}],
      act: 'Di\' grazie a quella persona, oggi',
      eve: [{k: 'belle', q: 'Le tre cose belle di oggi', kind: 'text', rows: 3}],
      habit: 'pc_3belle',
      src: '365 2023 G255 «Eventi», G76 «Radio», G329 «Apprezzamento» · newsletter «Lo stai misurando male» (09.11.2026)'},

    {n: 28, w: 4, e: '📊', t: 'Review della settimana 4: le abitudini',
      idea: "Quattro settimane. Oggi la review guarda le abitudini: quali sono entrate in automatico, quali faticano, quali vanno alzate o tolte.\n\nUn'abitudine non si giudica dal giorno peggiore ma dalla media. E una abitudine piccola che resta vale più di una grande che salta.",
      steps: ["Stasera guarda il riquadro delle abitudini e i voti delle tue giornate.", "Per ognuna decidi: tengo, alzo, rimpicciolisco o tolgo (i pulsanti sono lì).", "Scrivi le tre abitudini che proteggi nei prossimi trenta giorni."],
      ask: [{k: 'tre', q: 'Le tre abitudini che proteggo', kind: 'line'}, {k: 'tolgo', q: 'Quella che tolgo o rimpicciolisco', kind: 'line'}],
      act: 'Sistema il tracker secondo le decisioni di oggi',
      eve: [{k: 'tengo', q: 'Una cosa che tieni della settimana, una che lasci', kind: 'line'}],
      review: 'week',
      src: '365 2023 SAM · newsletter «Frequenza, intensità, volume» (04.12.2023), «66 giorni» (Alba 42, 11.2026)'},

    /* ---------- il cerchio ---------- */
    {n: 29, w: 5, e: '✉️', t: 'Lettera al te stesso di fra un mese',
      idea: "Scrivere al te stesso del futuro è un modo di guardare la strada dall'alto. Racconti dove sei, cosa hai imparato, cosa vuoi che lui si ricordi quando la voglia mancherà.\n\nLa rileggerai al prossimo giro.",
      steps: ["Timer otto minuti.", "Scrivi in cima la data di fra un mese e racconta cosa è cambiato, cosa non ancora, cosa ti chiedi di proteggere.", "Chiudi con il #mantra del prossimo mese (anche lo stesso, se è ancora vivo)."],
      ask: [{k: 'lettera', q: 'La mia lettera', kind: 'text', rows: 8}],
      recall: [{n: 10, k: 'mantra', l: 'Il #mantra'}],
      act: 'Mandati la lettera: una mail programmata o una nota con promemoria fra 30 giorni',
      eve: [{k: 'mese', q: 'In una riga: com\'è stato questo mese?', kind: 'line'}],
      src: '365 2023 G86 «Lettera», G364 «Inevitabile», G365 «Ruota» (i sei principi di chiusura)'},

    {n: 30, w: 5, e: '⭕', t: 'Il cerchio: rifai la ruota',
      idea: "Il cerchio si chiude rifacendo la fotografia del giorno 1. Non per giudicarti: per vedere. Alcuni raggi si saranno allungati, altri no, e va bene così.\n\nPoi scegli cosa porti nel prossimo giro. Le abitudini restano nel tracker; il percorso, quando vuoi, ricomincia.",
      steps: ["Dai di nuovo un voto da 1 a 10 alle sei aree, senza guardare il giorno 1.", "Confronta con i voti del giorno 1 (qui sopra): cosa è salito, cosa è sceso, e perché?", "Scrivi le tre cose che porti con te.", "Stasera, dopo la review: «📤 Copia per Giulio», incolla in Claude e fate il punto insieme."],
      ask: [...RUOTA, {k: 'confronto', q: 'Il confronto con il giorno 1', kind: 'text', rows: 4}, {k: 'porto', q: 'Le tre cose che porto con me', kind: 'line'}],
      recall: [{n: 1, keys: RUOTA_KEYS, l: 'I voti del giorno 1'}],
      act: 'Festeggia: una cosa bella per te, oggi',
      eve: [{k: 'prossimo', q: 'Cosa vuoi nel prossimo giro?', kind: 'line'}],
      review: 'final',
      src: 'PRE-365 2026 G-31 «Sobbalzi» · 365 2023 G359 «Cerchio», G365 «Ruota»'},
  ];

  const BADGES = [
    {id: 'pc1', e: '🧭', n: 'Primo giorno del percorso', d: 'Hai chiuso il primo giorno del Percorso 30, mattina e sera.', g: 10, ok: s => s.pcDays >= 1},
    {id: 'pc7', e: '📅', n: 'Prima settimana', d: '7 giorni del percorso chiusi.', g: 30, ok: s => s.pcDays >= 7},
    {id: 'pc15', e: '⛰️', n: 'Metà strada', d: '15 giorni del percorso chiusi.', g: 40, ok: s => s.pcDays >= 15},
    {id: 'pcs7', e: '🔗', n: 'Sette sere di fila', d: '7 giorni di calendario di fila con il percorso chiuso.', g: 40, ok: s => s.pcBest >= 7},
    {id: 'pc30', e: '🏆', n: 'Percorso completato', d: 'Tutti e 30 i giorni del percorso chiusi.', g: 100, ok: s => s.pcCycles >= 1},
  ];

  return {CYCLE, WEEKS, HABITS, DAYS, BADGES};
})();
