import { CONTACT_EMAIL } from './links.js';

/**
 * Testi delle pagine legali (privacy, cookie, termini). Ogni pagina ha un titolo, una data di
 * aggiornamento e delle sezioni: un paragrafo introduttivo facoltativo e un elenco facoltativo.
 * Le pagine le mostra LegalPage; aggiornare la data quando si cambia un testo.
 */
export const LEGAL_UPDATED = '26 ottobre 2026';

export const LEGAL_PAGES = {
  privacy: {
    title: 'Privacy',
    icon: 'ph-shield-check',
    intro: 'Come VinylDex tratta i tuoi dati personali, ai sensi del Regolamento UE 2016/679 (GDPR).',
    sections: [
      {
        title: 'Titolare del trattamento',
        text: `VinylDex è un progetto didattico non commerciale realizzato da Lorenzo Melis (JusTMeth25). Per qualsiasi domanda sui tuoi dati scrivi a ${CONTACT_EMAIL}.`
      },
      {
        title: 'Quali dati raccogliamo',
        items: [
          'Account: username, email e password (salvata solo come hash bcrypt, mai in chiaro).',
          'Accesso con Google o Apple, se lo usi: l’identificativo dell’account e l’email che il servizio ci comunica.',
          'Verifica in due passaggi, se la attivi: il segreto cifrato sul server e i dispositivi che scegli di ricordare.',
          'Dati di gioco: collezione, gold di gioco, scambi, battaglie, missioni, stanze e arredi dell’hotel, amicizie.',
          'Indirizzo IP: usato per frenare i tentativi di accesso ripetuti e salvato con le richieste di cambio password.',
          'Messaggi rivolti ai personaggi dell’hotel (NPC): passano al servizio di intelligenza artificiale che genera la risposta.'
        ]
      },
      {
        title: 'Perché li usiamo',
        items: [
          'Per farti creare l’account, accedere e giocare (esecuzione del servizio che richiedi, art. 6.1.b GDPR).',
          'Per la sicurezza: freno ai tentativi di accesso, verifica in due passaggi, link per cambiare la password (legittimo interesse, art. 6.1.f).',
          'Per mandarti solo le email di servizio: cambio password e avvisi sull’account. Niente newsletter né pubblicità.'
        ]
      },
      {
        title: 'Con chi li condividiamo',
        text: 'Non vendiamo né cediamo i tuoi dati. Li trattano per nostro conto solo i fornitori che fanno funzionare il servizio:',
        items: [
          'Oracle Cloud: il server su cui gira il sito e il database.',
          'Brevo: l’invio delle email di servizio.',
          'OpenRouter: le risposte dei personaggi dell’hotel. Riceve il tuo username, i messaggi che rivolgi al personaggio e i nomi dei giocatori nella stanza.',
          'Google e Apple: solo se scegli di accedere con loro.',
          'Apple Music e Spotify: copertine e anteprime dei brani della radio; i link si aprono sui loro siti.',
          'PayPal: solo se clicchi su “Sostieni VinylDex”, e lì vale la privacy di PayPal.'
        ]
      },
      {
        title: 'Per quanto tempo',
        items: [
          'I dati dell’account restano finché l’account esiste. Con “Elimina account” in fondo al Profilo li cancelli subito tu, tutti insieme; se preferisci scriverci, li eliminiamo entro 30 giorni.',
          'I link per cambiare la password valgono 30 minuti; i dispositivi ricordati scadono da soli.',
          'Il freno ai tentativi di accesso tiene gli IP solo in memoria, per pochi minuti.',
          'La chat dell’hotel non viene salvata nel database.'
        ]
      },
      {
        title: 'I tuoi diritti',
        text: `Puoi cancellare l’account in qualsiasi momento da Profilo → Elimina account. Puoi anche chiedere di vedere, correggere, esportare o cancellare i tuoi dati, oppure opporti al loro uso, scrivendo a ${CONTACT_EMAIL}. Rispondiamo entro 30 giorni. Puoi anche presentare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).`
      },
      {
        title: 'Minori',
        text: 'VinylDex è pensato per chi ha almeno 14 anni, l’età minima per acconsentire da soli ai servizi online in Italia. Se hai meno di 14 anni serve il consenso di un genitore.'
      }
    ]
  },
  cookie: {
    title: 'Cookie',
    icon: 'ph-cookie',
    intro: 'VinylDex usa solo cookie e memoria del browser strettamente necessari: niente statistiche, profilazione o pubblicità. Per questo non serve un banner di consenso.',
    sections: [
      {
        title: 'Cookie tecnici',
        items: [
          'vinyldex_session: tiene aperta la sessione dopo l’accesso. È HttpOnly e Secure, quindi gli script della pagina non lo leggono; dura al massimo 7 giorni e si cancella quando esci.'
        ]
      },
      {
        title: 'Memoria del browser (localStorage)',
        text: 'Il sito salva sul tuo dispositivo alcune preferenze, che non vengono mandate a nessuno:',
        items: [
          'impostazioni di accessibilità (modalità sicura, daltonismo, contrasto) e l’avviso sulla fotosensibilità già visto;',
          'tutorial e novità già visti, volume e suoni;',
          'il segno che hai una sessione aperta e, se lo scegli, il dispositivo ricordato per la verifica in due passaggi.'
        ]
      },
      {
        title: 'Servizi esterni',
        text: 'Copertine e anteprime dei brani arrivano da Apple Music. Google e Apple possono usare i propri cookie solo se scegli di accedere con loro; Spotify, Apple Music e PayPal solo quando apri i loro link.'
      },
      {
        title: 'Come cancellarli',
        text: 'Puoi cancellare cookie e dati del sito dalle impostazioni del browser. In quel caso esci dall’account e le preferenze tornano quelle predefinite.'
      }
    ]
  },
  termini: {
    title: 'Termini di servizio',
    icon: 'ph-scroll',
    intro: 'Usando VinylDex accetti queste regole. Sono semplici, ma valgono per tutti.',
    sections: [
      {
        title: 'Il servizio',
        text: 'VinylDex è un progetto didattico non ufficiale e gratuito, realizzato come capstone del corso Full Stack di EPICODE. Viene offerto “così com’è”: può cambiare, avere interruzioni o chiudere, e i dati di gioco possono essere azzerati.'
      },
      {
        title: 'Nessun denaro reale',
        text: 'I gold e tutto quello che si ottiene nel gioco (carte, pacchetti, arredi, premi del casinò e dei tornei) non hanno valore economico, non si comprano con denaro vero e non si possono prelevare, vendere o convertire. Le donazioni con PayPal sono libere e non danno vantaggi nel gioco.'
      },
      {
        title: 'Il tuo account',
        items: [
          'Devi avere almeno 14 anni, o il consenso di un genitore.',
          'Un account a testa. Tieni al sicuro la password; ti consigliamo la verifica in due passaggi.',
          'Sei responsabile di quello che fai con il tuo account.'
        ]
      },
      {
        title: 'Comportamento',
        text: 'Nella chat, nei nomi, nelle stanze e negli scambi è vietato:',
        items: [
          'insultare, molestare o minacciare altri giocatori;',
          'pubblicare contenuti illegali, offensivi, sessuali o di odio;',
          'spam, truffe negli scambi, uso di bug, bot o script per avere vantaggi;',
          'provare ad attaccare il sito o ad accedere agli account degli altri.'
        ]
      },
      {
        title: 'Sospensione',
        text: 'Chi non rispetta queste regole può ricevere un avviso, perdere oggetti ottenuti in modo scorretto oppure vedere l’account sospeso o chiuso.'
      },
      {
        title: 'Contenuti di terzi',
        text: 'Le carte importate e i relativi marchi appartengono ai rispettivi proprietari (The Pokémon Company, Wizards of the Coast, Konami, Bandai, Bushiroad, Disney, Riot Games, Electronic Arts, NBA…). VinylDex non è affiliato né approvato da loro. Se sei titolare di un diritto e vuoi la rimozione di un contenuto, scrivi all’indirizzo qui sotto.'
      },
      {
        title: 'Copyright',
        text: 'Il codice, la grafica originale e i testi di VinylDex sono © 2026 JusTMeth25, tutti i diritti riservati. Il codice sorgente è pubblico su GitHub solo per consultazione: non può essere copiato, modificato o riusato senza permesso.'
      },
      {
        title: 'Responsabilità',
        text: 'Nei limiti di legge, l’autore non risponde di perdite di dati di gioco, interruzioni del servizio o danni indiretti. Restano validi i diritti che la legge italiana ti riconosce come utente.'
      },
      {
        title: 'Modifiche e legge applicabile',
        text: 'Questi termini possono cambiare: la data in cima indica l’ultima versione. Vale la legge italiana.'
      },
      {
        title: 'Contatti',
        text: `Per domande, segnalazioni o richieste: ${CONTACT_EMAIL}.`
      }
    ]
  }
};
