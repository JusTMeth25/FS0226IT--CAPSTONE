/**
 * Novita' di VinylDex, dalla piu' recente. Le mostra la pagina Novita' (/news); la voce del
 * menu ha un pallino finche' non si e' vista l'ultima (NEWS_VERSION).
 */
export const NEWS = [
  {
    date: '2026-09-28',
    title: 'Go-kart rifatto, club, tornei e carte olografiche',
    icon: 'ph-flag-checkered',
    items: [
      ['ph-flag-checkered', 'Go-kart tutto nuovo', 'Si guida davvero: sterzo, gas e freno, pista vista dall\'alto, semaforo e gare con gli altri piloti. Nella stanza il kart corre fluido con te sopra.'],
      ['ph-sparkle', 'Carte olografiche', 'Nei pacchetti ogni tanto una carta esce olografica, con il riflesso arcobaleno.'],
      ['ph-flask', 'Fusione', 'Tre doppioni della stessa rarità diventano una carta della rarità successiva.'],
      ['ph-calendar-star', 'Carta del giorno', 'In Home: vinci una battaglia con quella carta in squadra e prendi il premio.'],
      ['ph-chart-line-up', 'Andamento dei prezzi', 'Nel dettaglio carta il grafico del valore e delle vendite nel Mercato.'],
      ['ph-book-open', 'Raccoglitore', 'La collezione come un album vero, da sfogliare, con le tasche vuote per le carte che mancano.'],
      ['ph-flag-banner', 'Club', 'Fonda un club con sigla e stemma: ha una sede tutta sua e una classifica negli eventi.'],
      ['ph-confetti', 'Feste', 'Lancia una festa nella tua stanza: finisce in cima al navigatore e chi viene prende XP.'],
      ['ph-storefront', 'Banchetto', 'Metti un banchetto nella tua stanza e vendi le tue carte a chi passa.'],
      ['ph-camera', 'Foto', 'Scatta una foto della stanza e mettila nel profilo.'],
      ['ph-envelope-simple', 'Posta', 'Spedisci gold e carte agli amici, anche se non sono collegati.'],
      ['ph-tree-structure', 'Tornei', 'Tornei a eliminazione a bowling e biliardo, con il tabellone che avanza da solo.'],
      ['ph-ping-pong', 'Ping pong e freccette', 'Due giochi nuovi in sala giochi.'],
      ['ph-medal', 'Stagione sportiva', 'Ogni mese punti da tutti gli sport, e premi ai primi tre.']
    ]
  },
  {
    date: '2026-09-27',
    title: 'Hotel: carte, amici, sport e rifiniture',
    icon: 'ph-sparkle',
    items: [
      ['ph-gavel', 'Asta nell\'hotel', 'Il banditore mette all\'asta una carta rara: rilancia in gold prima che scada il tempo.'],
      ['ph-certificate', 'Perito delle carte', 'Fai gradare una carta da 1 a 10: piu\' alto il voto, piu\' vale al negozio e negli scambi.'],
      ['ph-stack', 'Set da completare', 'Collezioni a tema (pagina Set) con premio in gold e un distintivo che si vede anche nell\'hotel.'],
      ['ph-frame-corners', 'Mostra delle collezioni', 'Esponi le tue 5 carte migliori e vota le altre: i primi tre della settimana vincono gold.'],
      ['ph-calendar-star', 'Eventi a orario', 'Torneo di calcio la sera, gara di bowling nel weekend, con classifica e premi.'],
      ['ph-users-three', 'Amici e messaggi', 'Aggiungi amici, scrivi in privato e raggiungili nella loro stanza.'],
      ['ph-paw-print', 'Animali da compagnia', 'Un cane, un gatto o un coniglio che ti segue nell\'hotel: ricordati di dargli da mangiare.'],
      ['ph-target', 'Missioni dell\'hotel', 'Ogni giorno: gol allo stadio, punti a bowling, canestri, partite ai minigiochi.'],
      ['ph-soccer-ball', 'Calcio 2 contro 2', 'Allo stadio scegli Blu o Rossi e fischia l\'inizio: tre minuti, poi supplementari con golden goal.'],
      ['ph-microphone-stage', 'Karaoke', 'Sul palco del Neon Bar: canta "Giradischi di mezzanotte" a tempo con le note.'],
      ['ph-fish', 'Pesca', 'Dai paletti sulla spiaggia: lancia, ferra e recupera senza spezzare la lenza. I pesci rari danno carte (tre al giorno).'],
      ['ph-flag-checkered', 'Go-kart', 'Nuova stanza con la pista: tre giri, frena prima delle curve o fai testacoda. Piu\' sei veloce, piu\' punti.'],
      ['ph-graduation-cap', 'Tutorial e suoni', 'Una guida per chi entra la prima volta, e i suoni di tutti i minigiochi.']
    ]
  },
  {
    date: '2026-09-26',
    title: 'Sport, stagioni e minigiochi animati',
    icon: 'ph-basketball',
    items: [
      ['ph-basketball', 'Palazzetto', 'Campo da basket vero: tiri liberi con la palla in volo.'],
      ['ph-bowling-ball', 'Bowling', 'Dodici piste, birilli che cadono e strike da festeggiare.'],
      ['ph-golf', 'Minigolf', 'Sei buche all\'aperto con mulino, ponticello e giro della morte.'],
      ['ph-soccer-ball', 'Stadio', 'Calcio con il pallone che si calcia davvero, Blu contro Rossi.'],
      ['ph-cloud-sun', 'Stagioni e meteo', 'Pioggia, neve, sole e decorazioni che cambiano con la stagione vera.'],
      ['ph-circle', 'Biliardo 8 ball', 'Mira e tira sul tavolo, con le bilie che si muovono anche nella stanza.']
    ]
  },
  {
    date: '2026-09-25',
    title: 'EA SPORTS FC 27 e pacchetti per gioco',
    icon: 'ph-soccer-ball',
    items: [
      ['ph-soccer-ball', 'Carte FC 27', 'Giocatori, giocatrici e icone con le statistiche ufficiali EA e i prezzi in crediti.'],
      ['ph-gift', 'Pacchetti per gioco', 'Pacchetti di soli Pokemon, Yu-Gi-Oh!, Magic e degli altri giochi.'],
      ['ph-storefront', 'Edicola-fumetteria', 'Negozio di fumetti con il museo delle carte VinylDex.']
    ]
  }
];

export const NEWS_VERSION = NEWS[0].date;

export const NEWS_SEEN_KEY = 'vinyldex_news_seen';

/** Vero se c'e' una novita' che l'utente non ha ancora visto. */
export function hasUnseenNews() {
  try {
    return localStorage.getItem(NEWS_SEEN_KEY) !== NEWS_VERSION;
  } catch {
    return false;
  }
}
