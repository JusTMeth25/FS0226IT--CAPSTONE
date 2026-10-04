/**
 * Guide del casino: per ogni gioco l'obiettivo, come si gioca qui (i pulsanti dell'hotel), le
 * regole e le paghe. Le paghe sono le stesse del server (CasinoGames.java).
 */
export const CASINO_GUIDES = {
  cashier: {
    title: 'La cassa',
    goal: 'Qui cambi i gold in fiches e le fiches in gold, sempre 1 a 1: le fiches servono per giocare senza toccare i gold.',
    steps: [
      'Scegli l\'importo (o scrivilo) e premi COMPRA FICHES o CAMBIA IN GOLD.',
      'Ogni giorno ritira il REGALO DELLA CASA: 200 fiches gratis.',
      'In ogni gioco, in alto, scegli se puntare Fiches o Gold e il valore della fiche (1, 5, 25, 100, 500, 1000).'
    ],
    rules: [
      'Puntata: da 1 a 1.000 per volta; alla roulette e al baccarat al massimo 2.000 per giro, sommando tutte le puntate.',
      'Le carte, i rulli, i numeri e i dadi li estrae il server: nessuno può truccare il risultato.',
      'Le vincite di almeno 100, pari ad almeno 10 volte la puntata, vengono annunciate a tutta la sala.'
    ],
    tip: 'Gioca solo quello che sei disposto a perdere: a lungo andare il banco vince sempre un pochino.'
  },
  slot: {
    title: 'Slot machine',
    goal: 'Allinea tre simboli uguali sulla linea centrale (quella rossa).',
    steps: [
      'Scegli la fiche in alto: è la tua puntata per ogni giro.',
      'Premi GIRA: i tre rulli si fermano uno alla volta, da sinistra.',
      'Si vince solo con i simboli della riga centrale: la vincita è la puntata per il moltiplicatore.'
    ],
    rules: [
      'Tre uguali: dal limone (x12) al vinile (x500), vedi la tabella accanto ai rulli.',
      'BAR e 7 mescolati sulla linea: x20.',
      'Due ciliegie: x2. Una ciliegia sul primo rullo: x1 (riprendi la puntata).'
    ],
    pays: [['3 Vinili', 'x500'], ['3 Sette', 'x150'], ['3 BAR', 'x80'], ['3 Campane', 'x40'], ['3 Uve', 'x25'], ['3 Arance', 'x18'],
      ['3 Ciliegie', 'x15'], ['3 Limoni', 'x12'], ['BAR e 7 misti', 'x20'], ['2 Ciliegie', 'x2'], ['Ciliegia sul 1° rullo', 'x1']],
    tip: 'La slot restituisce in media circa il 94% di quello che si punta: è il gioco più veloce, ma anche quello dove il banco guadagna di più.'
  },
  poker: {
    title: 'Video poker (Jacks or Better)',
    goal: 'Fare la mano di poker più alta possibile con cinque carte, cambiandone quante vuoi una volta sola.',
    steps: [
      'Scegli la fiche e premi DISTRIBUISCI: arrivano cinque carte.',
      'Tocca le carte da tenere (si alzano con la scritta TENUTA); tocca di nuovo per lasciarle.',
      'Premi CAMBIA: le carte non tenute vengono sostituite e si paga la mano finale.'
    ],
    rules: [
      'Si vince dalla coppia di J (o di Q, K, A) in su: una coppia di 10 o meno non vince.',
      'La paga è "per uno": con la coppia di J riprendi la puntata, con la doppia coppia la raddoppi, e così via.',
      'Il mazzo è uno solo da 52 carte, rimescolato a ogni mano.'
    ],
    pays: [['Scala reale (10-J-Q-K-A dello stesso seme)', 'x250'], ['Scala colore', 'x50'], ['Poker (quattro uguali)', 'x25'], ['Full (tris + coppia)', 'x9'],
      ['Colore (cinque dello stesso seme)', 'x6'], ['Scala (cinque in fila)', 'x4'], ['Tris', 'x3'], ['Doppia coppia', 'x2'], ['Coppia di J o più', 'x1']],
    tip: 'Tieni sempre una coppia di J o più, e quattro carte della stessa scala reale. Con niente in mano, tieni le figure.'
  },
  roulette: {
    title: 'Roulette europea',
    goal: 'Indovinare dove si ferma la pallina: un numero da 0 a 36, il colore, pari o dispari, alto o basso.',
    steps: [
      'Scegli la fiche in alto e tocca le caselle del tappeto per puntare: puoi puntare su più caselle, e più volte sulla stessa.',
      'Premi GIRA: la ruota gira e la pallina si ferma su un numero.',
      'Le puntate vincenti si illuminano. RIPETI rimette le stesse puntate del giro prima, CANCELLA le toglie.'
    ],
    rules: [
      'Con lo zero (verde) perdono tutte le puntate tranne quella sullo 0.',
      'Roulette europea: un solo zero, il banco tiene circa il 2,7% delle puntate.'
    ],
    pays: [['Numero secco (pieno)', '35 a 1'], ['Dozzina (1-12, 13-24, 25-36)', '2 a 1'], ['Colonna (2:1)', '2 a 1'],
      ['Rosso o nero', '1 a 1'], ['Pari o dispari', '1 a 1'], ['1-18 o 19-36', '1 a 1']],
    tip: 'Le puntate semplici (rosso, pari, 1-18) vincono quasi metà delle volte; il numero secco paga tanto ma esce una volta su 37.'
  },
  blackjack: {
    title: 'Blackjack',
    goal: 'Battere il banco arrivando più vicino a 21 di lui, senza superarlo.',
    steps: [
      'Tocca il cerchio della puntata per mettere le fiches, poi premi DISTRIBUISCI.',
      'Ricevi due carte scoperte; il banco una scoperta e una coperta.',
      'CARTA: ne chiedi un\'altra. STAI: ti fermi. RADDOPPIA (solo con le prime due carte): raddoppi la puntata e ricevi una sola carta.',
      'Quando ti fermi il banco scopre la sua carta e pesca.'
    ],
    rules: [
      'Le figure valgono 10, l\'asso 1 o 11 (come conviene), le altre carte il loro numero.',
      'Se superi 21 hai "sballato" e perdi subito.',
      'Il banco pesca fino a 16 e sta su 17 o più.',
      'Blackjack (asso + 10 o figura con le prime due carte) paga 3 a 2. Pareggio: riprendi la puntata.',
      'Sei mazzi rimescolati a ogni mano. Qui non si divide (split) e non c\'è l\'assicurazione.'
    ],
    pays: [['Blackjack', '3 a 2'], ['Vittoria', '1 a 1'], ['Pareggio', 'puntata restituita']],
    tip: 'Regola base: con 17 o più stai sempre; con 12-16 stai se il banco mostra da 2 a 6, altrimenti chiedi carta; raddoppia con 11.'
  },
  baccarat: {
    title: 'Baccarat',
    goal: 'Indovinare quale mano arriva più vicina a 9: quella del Punto o quella del Banco (o se pareggiano).',
    steps: [
      'Tocca i cerchi di PUNTO, BANCO o PAREGGIO per puntare (anche su più di uno).',
      'Premi DISTRIBUISCI: le carte vengono scoperte una alla volta, prima il Punto poi il Banco.',
      'Non devi decidere niente: le carte in più le dà il croupier secondo le regole fisse.'
    ],
    rules: [
      'Assi valgono 1, le carte da 2 a 9 il loro numero, 10 e figure 0. Conta solo l\'ultima cifra: 7 + 8 = 15, vale 5.',
      'Con 8 o 9 nelle prime due carte (il "naturale") si chiude subito.',
      'Il Punto pesca una terza carta con 0-5 e sta con 6-7; il Banco pesca secondo la tabella classica, che dipende dalla terza carta del Punto.',
      'Se esce il pareggio le puntate su Punto e Banco vengono restituite.'
    ],
    pays: [['Punto', '1 a 1'], ['Banco', '1 a 1 meno il 5%'], ['Pareggio', '8 a 1']],
    tip: 'Il Banco vince un po\' più spesso del Punto (per questo si paga il 5%): è la puntata più conveniente. Il pareggio paga tanto ma esce raramente.'
  },
  craps: {
    title: 'Dadi (craps)',
    goal: 'Puntare su come finirà la serie di lanci di due dadi: PASS LINE (con chi lancia) o DON\'T PASS (contro).',
    steps: [
      'Scegli PASS LINE o DON\'T PASS, metti le fiches nel cerchio e premi LANCIA.',
      'Primo lancio: con PASS LINE vinci con 7 o 11, perdi con 2, 3 o 12.',
      'Con 4, 5, 6, 8, 9 o 10 quel numero diventa il "punto" (il dischetto ON si sposta lì) e si rilancia.',
      'Si continua finché esce di nuovo il punto (PASS LINE vince) o esce il 7 (PASS LINE perde).'
    ],
    rules: [
      'DON\'T PASS è il contrario: vince quando PASS LINE perde e viceversa.',
      'Con DON\'T PASS il 12 al primo lancio è un pareggio: riprendi la puntata.',
      'I lanci vanno avanti da soli: li vedi uno a uno sul tavolo.'
    ],
    pays: [['Pass line', '1 a 1'], ['Don\'t pass', '1 a 1 (12 al primo lancio: pari)']],
    tip: 'Il 7 è il numero che esce più spesso (6 combinazioni su 36): per questo al primo lancio aiuta chi punta sulla pass line, dopo invece chi punta contro.'
  },
  holdem: {
    title: "Poker Texas Hold'em",
    goal: 'Vincere le fiches degli altri giocatori al tavolo (veri e NPC): con la mano migliore allo showdown, o facendo lasciare tutti gli altri.',
    steps: [
      'Scegli quante fiches portare al tavolo (da 100 a 2.000) e premi SIEDITI: vengono tolte dal tuo saldo e tornano quando ti alzi.',
      'Ognuno riceve due carte coperte; poi escono cinque carte comuni sul tavolo: tre (flop), una (turn), una (river).',
      'A ogni giro, quando tocca a te (hai 20 secondi): LASCIA, CHECK (se nessuno ha puntato), CHIAMA la puntata, oppure PUNTA o RILANCIA con il cursore (½ piatto, piatto o tutto).',
      'Allo showdown vince chi fa la combinazione migliore di cinque carte fra le sue due e le cinque del tavolo.',
      'ALZATI quando vuoi: se sei in una mano lasci quella mano, e le fiches che hai davanti tornano a fine mano.'
    ],
    rules: [
      'Bui 5/10: a ogni mano i due giocatori a sinistra del mazziere (D) mettono 5 e 10 prima di vedere le carte.',
      'No limit: puoi puntare fino a tutte le fiches che hai davanti (all-in). Il rilancio minimo è pari all\'ultimo rilancio.',
      'Chi va all-in vince solo il piatto a cui ha partecipato: il resto va in un piatto laterale fra gli altri.',
      'A parità di mano il piatto si divide.',
      'Se il tempo scade si passa (check) o si lascia da soli; due volte di fila e ci si alza.',
      'Il tavolo gioca quando c\'è almeno un giocatore vero: gli NPC (Asso Nino, Donna Picche, il Professore...) si siedono nei posti liberi e lasciano spazio a chi arriva.'
    ],
    pays: [['Scala reale (10-J-Q-K-A dello stesso seme)', '1ª'], ['Scala colore', '2ª'], ['Poker (quattro uguali)', '3ª'], ['Full (tris + coppia)', '4ª'],
      ['Colore (cinque dello stesso seme)', '5ª'], ['Scala (cinque in fila)', '6ª'], ['Tris', '7ª'], ['Doppia coppia', '8ª'], ['Coppia', '9ª'], ['Carta alta', '10ª']],
    tip: 'Le mani di partenza migliori sono le coppie alte (AA, KK, QQ) e asso-re. Con carte basse e scollegate conviene lasciare subito: le fiches si vincono scegliendo bene quando giocare.'
  },
  bingo: {
    title: 'Bingo a 90 numeri',
    goal: 'Completare per primo una riga (linea), due righe (doppia linea) o tutta la cartella (BINGO!) mentre il banditore estrae i numeri da 1 a 90.',
    steps: [
      'Durante la vendita scegli quante cartelle comprare (da 1 a 6, 10 fiches l\'una) e premi COMPRA. La prima cartella fa partire la vendita: dura 45 secondi.',
      'Poi comincia l\'estrazione: una pallina ogni 3 secondi circa, con il numero, la sua smorfia napoletana ("Il 90, la paura!") e la voce del banditore.',
      'Con "Segna da solo" i numeri usciti si segnano sulle cartelle da soli; senza, li segni tu toccandoli (quelli usciti e non segnati hanno il bordo verde).',
      'Le vincite le controlla il banditore: appena completi una riga, due righe o la cartella il premio arriva subito fra le tue fiches.'
    ],
    rules: [
      'Ogni cartella ha 3 righe e 9 colonne con 15 numeri, 5 per riga: la prima colonna va da 1 a 9, la seconda da 10 a 19 e così via, l\'ultima da 80 a 90.',
      'I premi si vincono in ordine: prima la linea, poi la doppia linea, infine il bingo, che chiude la partita.',
      'Chi completa alla stessa pallina divide il premio.',
      'Il montepremi è il 90% delle cartelle in gioco: 15% alla linea, 25% alla doppia linea, 60% al bingo.',
      'Jackpot: chi fa bingo entro 45 numeri vince anche il jackpot, che cresce a ogni partita con il 10% delle cartelle.',
      'Con te giocano i clienti abituali del casinò (Nonna Pina, Zio Gennaro, la Signora Carmela...): anche loro comprano cartelle e possono vincere.',
      'Se esci dal casinò durante la vendita riprendi le fiches; a estrazione cominciata le tue cartelle giocano lo stesso.'
    ],
    pays: [['Linea (una riga)', '15% del montepremi'], ['Doppia linea (due righe)', '25%'], ['Bingo (tutta la cartella)', '60%'], ['Bingo entro 45 numeri', '+ jackpot']],
    tip: 'Più cartelle hai, più possibilità hai di vincere, ma ogni cartella costa uguale: il premio atteso per cartella è sempre lo stesso. Il bello è la tensione del "manca 1!".'
  }
};
