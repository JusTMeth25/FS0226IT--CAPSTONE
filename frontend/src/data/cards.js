/**
 * VinylDex - Database carte (artisti musicali IP originali)
 * 8 classi x 5 carte + alcune carte speciali affiancate al roster principale,
 * piu' le Court Legends: 21 carte di basket con 12 classi loro.
 */
export const CARDS = [
  // ============================================
  // THE SHOWMAN
  // ============================================
  {
    id: 'showman-001',
    name: 'Royal Echo',
    artistClass: 'The Showman',
    variant: 'Royal Echo',
    rarity: 'legendary',
    img: '/assets/img/RoyalEcho.webp',
    fullImage: true,
    stats: { fans: 95, style: 92, influence: 88, energy: 78 },
    description: 'Il re dei palchi. La sua voce echeggia attraverso stadi infiniti, incantando folle con ogni nota.'
  },
  {
    id: 'showman-002',
    name: 'Golden Voice',
    artistClass: 'The Showman',
    variant: 'Golden Voice',
    rarity: 'epic',
    img: '/assets/img/GoldenVoice.webp',
    fullImage: true,
    stats: { fans: 88, style: 85, influence: 80, energy: 74 },
    description: 'Una voce talmente pura da far brillare l\'oro. Ogni performance è una sinfonia di luce e suono.'
  },
  {
    id: 'showman-003',
    name: 'Neon Performer',
    artistClass: 'The Showman',
    variant: 'Neon Performer',
    rarity: 'rare',
    img: '/assets/img/NeonPerformer.webp',
    fullImage: true,
    stats: { fans: 80, style: 90, influence: 72, energy: 70 },
    description: 'Vestito di neon, trasforma ogni palco in un caleidoscopio di colori e musica travolgente.'
  },
  {
    id: 'showman-004',
    name: 'Velvet Crown',
    artistClass: 'The Showman',
    variant: 'Velvet Crown',
    rarity: 'uncommon',
    img: '/assets/img/VelvetCrown.webp',
    fullImage: true,
    stats: { fans: 72, style: 78, influence: 68, energy: 65 },
    description: 'Eleganza pura. La sua presenza scenica è velluto, la sua corona è fatta di rispetto.'
  },
  {
    id: 'showman-005',
    name: 'Crimson Stage',
    artistClass: 'The Showman',
    variant: 'Crimson Stage',
    rarity: 'common',
    img: '/assets/img/CrimsonStage.webp',
    fullImage: true,
    stats: { fans: 65, style: 70, influence: 60, energy: 62 },
    description: 'Il palcoscenico è la sua casa. Ogni esibizione è un\'esplosione di passione cremisi.'
  },

  // ============================================
  // THE REBEL
  // ============================================
  {
    id: 'rebel-001',
    name: 'Riot Avenue',
    artistClass: 'The Rebel',
    variant: 'Riot Avenue',
    rarity: 'legendary',
    img: '/assets/img/RiotAvenue.webp',
    fullImage: true,
    stats: { fans: 92, style: 78, influence: 95, energy: 90 },
    description: 'La rivoluzione suona come un riff distorto. Riot Avenue guida la rivolta musicale.'
  },
  {
    id: 'rebel-002',
    name: 'Chaos Pulse',
    artistClass: 'The Rebel',
    variant: 'Chaos Pulse',
    rarity: 'epic',
    img: '/assets/img/ChaosPulse.webp',
    fullImage: true,
    stats: { fans: 85, style: 72, influence: 90, energy: 88 },
    description: 'Il caos è la sua arma. Ogni beat è un\'esplosione di energia incontrollabile.'
  },
  {
    id: 'rebel-003',
    name: 'Crimson Riot',
    artistClass: 'The Rebel',
    variant: 'Crimson Riot',
    rarity: 'rare',
    img: '/assets/img/CrimsonRiot.webp',
    fullImage: true,
    stats: { fans: 78, style: 68, influence: 85, energy: 82 },
    description: 'Rosso di rabbia, nero di cuore. La sua musica è un grido di libertà.'
  },
  {
    id: 'rebel-004',
    name: 'Street Voltage',
    artistClass: 'The Rebel',
    variant: 'Street Voltage',
    rarity: 'uncommon',
    img: '/assets/img/StreetVoltage.webp',
    fullImage: true,
    stats: { fans: 70, style: 62, influence: 76, energy: 75 },
    description: 'Nato per strada, cresciuto a elettricità. Ogni riff è pura tensione.'
  },
  {
    id: 'rebel-005',
    name: 'Broken Chains',
    artistClass: 'The Rebel',
    variant: 'Broken Chains',
    rarity: 'common',
    img: '/assets/img/BrokenChains.webp',
    fullImage: true,
    stats: { fans: 62, style: 58, influence: 70, energy: 68 },
    description: 'Catene spezzate, spirito libero. La ribellione è il suo unico credo.'
  },
  {
    id: 'rebel-extra-001',
    name: 'Whisker Riot',
    artistClass: 'The Rebel',
    variant: 'The Nine Lives Legend',
    group: 'Stray Cats',
    rarity: 'legendary',
    img: '/assets/img/whisker.webp',
    fullImage: true,
    stats: { fans: 98, style: 95, influence: 97, energy: 94 },
    description: 'Nove vite, una sola missione: far tremare il palco.'
  },

  // ============================================
  // THE VIRTUOSO
  // ============================================
  {
    id: 'virtuoso-001',
    name: 'Virtuoso\'s Soul',
    artistClass: 'The Virtuoso',
    variant: 'Virtuoso\'s Soul',
    rarity: 'legendary',
    img: '/assets/img/VirtuosoSoul.webp',
    fullImage: true,
    stats: { fans: 88, style: 98, influence: 85, energy: 82 },
    description: 'L\'anima della musica stessa. Ogni nota è perfetta, ogni pausa è divina.'
  },
  {
    id: 'virtuoso-002',
    name: 'String Theory',
    artistClass: 'The Virtuoso',
    variant: 'String Theory',
    rarity: 'epic',
    img: '/assets/img/StringTheory.webp',
    fullImage: true,
    stats: { fans: 82, style: 94, influence: 78, energy: 76 },
    description: 'Le corde della sua chitarra vibrano in armonia con l\'universo stesso.'
  },
  {
    id: 'virtuoso-003',
    name: 'Harmonic Blade',
    artistClass: 'The Virtuoso',
    variant: 'Harmonic Blade',
    rarity: 'rare',
    img: '/assets/img/HarmonicBlade.webp',
    fullImage: true,
    stats: { fans: 75, style: 88, influence: 72, energy: 70 },
    description: 'Lama armonica, taglia il silenzio con precisione chirurgica e bellezza melodica.'
  },
  {
    id: 'virtuoso-004',
    name: 'Crystal Note',
    artistClass: 'The Virtuoso',
    variant: 'Crystal Note',
    rarity: 'uncommon',
    img: '/assets/img/CrystalNote.webp',
    fullImage: true,
    stats: { fans: 68, style: 80, influence: 65, energy: 64 },
    description: 'Note di cristallo che brillano nell\'aria. Purezza sonora allo stato massimo.'
  },
  {
    id: 'virtuoso-005',
    name: 'Silver Scale',
    artistClass: 'The Virtuoso',
    variant: 'Silver Scale',
    rarity: 'common',
    img: '/assets/img/SilverScale.webp',
    fullImage: true,
    stats: { fans: 60, style: 74, influence: 58, energy: 60 },
    description: 'Scale d\'argento, esercizio quotidiano. La perfezione si costruisce nota dopo nota.'
  },

  // ============================================
  // THE INNOVATOR
  // ============================================
  {
    id: 'innovator-001',
    name: 'Future Frequency',
    artistClass: 'The Innovator',
    variant: 'Future Frequency',
    rarity: 'legendary',
    img: '/assets/img/FutureFrequency.webp',
    fullImage: true,
    stats: { fans: 90, style: 96, influence: 92, energy: 88 },
    description: 'Il futuro ha una frequenza, e lui l\'ha catturata. Musica che anticipa i tempi.'
  },
  {
    id: 'innovator-002',
    name: 'Digital Wave',
    artistClass: 'The Innovator',
    variant: 'Digital Wave',
    rarity: 'epic',
    img: '/assets/img/DigitalWave.webp',
    fullImage: true,
    stats: { fans: 84, style: 90, influence: 86, energy: 82 },
    description: 'Onde digitali che trasportano l\'ascoltatore in una nuova dimensione sonora.'
  },
  {
    id: 'innovator-003',
    name: 'Neon Circuit',
    artistClass: 'The Innovator',
    variant: 'Neon Circuit',
    rarity: 'rare',
    img: '/assets/img/NeonCircuit.webp',
    fullImage: true,
    stats: { fans: 76, style: 84, influence: 78, energy: 76 },
    description: 'Circuiti di neon pulsano al ritmo di un futuro già presente.'
  },
  {
    id: 'innovator-004',
    name: 'Binary Beat',
    artistClass: 'The Innovator',
    variant: 'Binary Beat',
    rarity: 'uncommon',
    img: '/assets/img/BinaryBeat.webp',
    fullImage: true,
    stats: { fans: 68, style: 76, influence: 70, energy: 70 },
    description: '0 e 1 che ballano. La musica digitale trova l\'anima nei bit.'
  },
  {
    id: 'innovator-005',
    name: 'Pixel Bass',
    artistClass: 'The Innovator',
    variant: 'Pixel Bass',
    rarity: 'common',
    img: '/assets/img/PixelBass.webp',
    fullImage: true,
    stats: { fans: 62, style: 70, influence: 64, energy: 66 },
    description: 'Bassi pixelati che fanno vibrare i monitor. Retro futuro in ogni nota.'
  },

  // ============================================
  // THE POET
  // ============================================
  {
    id: 'poet-001',
    name: 'Lyric Storm',
    artistClass: 'The Poet',
    variant: 'Lyric Storm',
    rarity: 'legendary',
    img: '/assets/img/LyricStorm.webp',
    fullImage: true,
    stats: { fans: 94, style: 88, influence: 96, energy: 72 },
    description: 'Tempesta lirica. Le sue parole sono fulmini, i suoi versi sono tuoni.'
  },
  {
    id: 'poet-002',
    name: 'Verse of Fire',
    artistClass: 'The Poet',
    variant: 'Verse of Fire',
    rarity: 'epic',
    img: '/assets/img/VerseOfFire.webp',
    fullImage: true,
    stats: { fans: 86, style: 82, influence: 90, energy: 68 },
    description: 'Versi infuocati che bruciano l\'anima. Poesia che incendia i cuori.'
  },
  {
    id: 'poet-003',
    name: 'Silent Rhyme',
    artistClass: 'The Poet',
    variant: 'Silent Rhyme',
    rarity: 'rare',
    img: '/assets/img/SilentRhyme.webp',
    fullImage: true,
    stats: { fans: 78, style: 76, influence: 82, energy: 62 },
    description: 'Rime silenziose che parlano più forte delle urla. La potenza del silenzio.'
  },
  {
    id: 'poet-004',
    name: 'Paper Wings',
    artistClass: 'The Poet',
    variant: 'Paper Wings',
    rarity: 'uncommon',
    img: '/assets/img/PaperWings.webp',
    fullImage: true,
    stats: { fans: 70, style: 70, influence: 74, energy: 58 },
    description: 'Ali di carta che volano lontano. Ogni verso è un viaggio.'
  },
  {
    id: 'poet-005',
    name: 'Ink & Soul',
    artistClass: 'The Poet',
    variant: 'Ink & Soul',
    rarity: 'common',
    img: '/assets/img/InkAndSoul.webp',
    fullImage: true,
    stats: { fans: 64, style: 64, influence: 66, energy: 56 },
    description: 'Inchiostro e anima si fondono in versi che raccontano storie di vita.'
  },

  // ============================================
  // THE KING OF RIFFS
  // ============================================
  {
    id: 'riff-001',
    name: 'Thunder Chord',
    artistClass: 'The King of Riffs',
    variant: 'Thunder Chord',
    rarity: 'legendary',
    img: '/assets/img/ThunderChord.webp',
    fullImage: true,
    stats: { fans: 96, style: 80, influence: 86, energy: 100 },
    description: 'Il tuono ha trovato una chitarra. Ogni accordo scuote le fondamenta della terra.'
  },
  {
    id: 'riff-002',
    name: 'Electric Throne',
    artistClass: 'The King of Riffs',
    variant: 'Electric Throne',
    rarity: 'epic',
    img: '/assets/img/ElectricThrone.webp',
    fullImage: true,
    stats: { fans: 88, style: 74, influence: 80, energy: 94 },
    description: 'Siede sul trono elettrico, signore incontrastato dei riff più potenti.'
  },
  {
    id: 'riff-003',
    name: 'Iron Strings',
    artistClass: 'The King of Riffs',
    variant: 'Iron Strings',
    rarity: 'rare',
    img: '/assets/img/IronStrings.webp',
    fullImage: true,
    stats: { fans: 80, style: 68, influence: 74, energy: 86 },
    description: 'Corde d\'acciaio per un suono che piega il metallo. Riff che forgiano leggende.'
  },
  {
    id: 'riff-004',
    name: 'Steel Resonance',
    artistClass: 'The King of Riffs',
    variant: 'Steel Resonance',
    rarity: 'uncommon',
    img: '/assets/img/SteelResonance.webp',
    fullImage: true,
    stats: { fans: 72, style: 62, influence: 66, energy: 78 },
    description: 'Risonanza d\'acciaio. Il suono che rimane anche dopo l\'ultima nota.'
  },
  {
    id: 'riff-005',
    name: 'Power Chords',
    artistClass: 'The King of Riffs',
    variant: 'Power Chords',
    rarity: 'common',
    img: '/assets/img/PowerChords.webp',
    fullImage: true,
    stats: { fans: 66, style: 56, influence: 60, energy: 72 },
    description: 'Power chords che fanno vibrare l\'aria. L\'essenza del rock in tre note.'
  },

  // ============================================
  // THE DREAMER
  // ============================================
  {
    id: 'dreamer-001',
    name: 'Astral Lullaby',
    artistClass: 'The Dreamer',
    variant: 'Astral Lullaby',
    rarity: 'legendary',
    img: '/assets/img/AstralLullaby.webp',
    fullImage: true,
    stats: { fans: 86, style: 90, influence: 82, energy: 70 },
    description: 'Ninnananna astrale che culla l\'universo. La musica dei sogni più profondi.'
  },
  {
    id: 'dreamer-002',
    name: 'Nebula Voice',
    artistClass: 'The Dreamer',
    variant: 'Nebula Voice',
    rarity: 'epic',
    img: '/assets/img/NebulaVoice.webp',
    fullImage: true,
    stats: { fans: 80, style: 84, influence: 76, energy: 66 },
    description: 'Voce di nebulosa, eterea e misteriosa. Canta i segreti delle stelle.'
  },
  {
    id: 'dreamer-003',
    name: 'Star Gazer',
    artistClass: 'The Dreamer',
    variant: 'Star Gazer',
    rarity: 'rare',
    img: '/assets/img/StarGazer.webp',
    fullImage: true,
    stats: { fans: 72, style: 78, influence: 70, energy: 60 },
    description: 'Osserva le stelle e trasforma il loro brillio in melodie celestiali.'
  },
  {
    id: 'dreamer-004',
    name: 'Lunar Echo',
    artistClass: 'The Dreamer',
    variant: 'Lunar Echo',
    rarity: 'uncommon',
    img: '/assets/img/LunarEcho.webp',
    fullImage: true,
    stats: { fans: 66, style: 70, influence: 64, energy: 56 },
    description: 'Eco lunare che danza nella notte. Sussurri d\'argento sotto la luna.'
  },
  {
    id: 'dreamer-005',
    name: 'Daydreamer',
    artistClass: 'The Dreamer',
    variant: 'Daydreamer',
    rarity: 'common',
    img: '/assets/img/DayDreamer.webp',
    fullImage: true,
    stats: { fans: 58, style: 64, influence: 58, energy: 52 },
    description: 'Sognatore ad occhi aperti. La realtà è solo un suggerimento.'
  },

  // ============================================
  // THE SYNTH MASTER
  // ============================================
  {
    id: 'synth-001',
    name: 'Digital God',
    artistClass: 'The Synth Master',
    variant: 'Digital God',
    rarity: 'legendary',
    img: '/assets/img/DigitalGod.webp',
    fullImage: true,
    stats: { fans: 92, style: 98, influence: 94, energy: 96 },
    description: 'Dio digitale del suono. Ogni frequenza è sotto il suo controllo divino.'
  },
  {
    id: 'synth-002',
    name: 'Cyberwave',
    artistClass: 'The Synth Master',
    variant: 'Cyberwave',
    rarity: 'epic',
    img: '/assets/img/CyberWave.webp',
    fullImage: true,
    stats: { fans: 86, style: 92, influence: 88, energy: 90 },
    description: 'Onda cibernetica che travolge tutto. Il futuro è adesso, e suona elettronico.'
  },
  {
    id: 'synth-003',
    name: 'Pulse Matrix',
    artistClass: 'The Synth Master',
    variant: 'Pulse Matrix',
    rarity: 'rare',
    img: '/assets/img/PulseMatrix.webp',
    fullImage: true,
    stats: { fans: 78, style: 84, influence: 80, energy: 82 },
    description: 'Matrice pulsante di suoni sintetici. La realtà è simulata, la musica è vera.'
  },
  {
    id: 'synth-004',
    name: 'Voltage Beat',
    artistClass: 'The Synth Master',
    variant: 'Voltage Beat',
    rarity: 'uncommon',
    img: '/assets/img/VoltageBeat.webp',
    fullImage: true,
    stats: { fans: 70, style: 76, influence: 72, energy: 74 },
    description: 'Battiti ad alto voltaggio. L\'elettricità scorre in ogni singolo beat.'
  },
  {
    id: 'synth-005',
    name: 'Neon Synth',
    artistClass: 'The Synth Master',
    variant: 'Neon Synth',
    rarity: 'common',
    img: '/assets/img/NeonSynth.webp',
    fullImage: true,
    stats: { fans: 62, style: 68, influence: 64, energy: 66 },
    description: 'Sintetizzatore al neon. Luci aliene e suoni che vengono dal futuro.'
  },
  // ============================================
  // COURT LEGENDS (basket)
  // ============================================
  {
    id: 'court-legendary-001',
    name: 'Sky Breaker',
    artistClass: 'The MVP',
    variant: 'Sky Breaker',
    group: 'Court Legends',
    rarity: 'legendary',
    img: '/assets/img/SkyBreaker.webp',
    fullImage: true,
    stats: { fans: 94, style: 91, influence: 88, energy: 96 },
    description: 'Regina del parquet. Ogni salto sfida il cielo, ogni schiacciata accende l\'arena.'
  },
  {
    id: 'court-legendary-002',
    name: 'Iron Dunk',
    artistClass: 'The Titan',
    variant: 'Iron Dunk',
    group: 'Court Legends',
    rarity: 'legendary',
    img: '/assets/img/IronDunk.webp',
    fullImage: true,
    stats: { fans: 93, style: 87, influence: 89, energy: 97 },
    description: 'Dominatore del ferro. Ogni schiacciata scuote l\'arena e lascia il pubblico senza fiato.'
  },
  {
    id: 'court-legendary-003',
    name: 'Phantom Handles',
    artistClass: 'The Playmaker',
    variant: 'Phantom Handles',
    group: 'Court Legends',
    rarity: 'legendary',
    img: '/assets/img/PhantomHandles.webp',
    fullImage: true,
    stats: { fans: 91, style: 99, influence: 90, energy: 91 },
    description: 'Il pallone scompare tra le sue mani. Ogni palleggio inganna gli occhi e riscrive il gioco.'
  },
  {
    id: 'court-legendary-004',
    name: 'Zero Gravity',
    artistClass: 'The High Flyer',
    variant: 'Zero Gravity',
    group: 'Court Legends',
    rarity: 'legendary',
    img: '/assets/img/ZeroGravity.webp',
    fullImage: true,
    stats: { fans: 97, style: 95, influence: 86, energy: 94 },
    description: 'La gravità è soltanto una regola da infrangere. In aria, il campo appartiene a lui.'
  },
  {
    id: 'court-legendary-005',
    name: 'Final Shot',
    artistClass: 'The Closer',
    variant: 'Final Shot',
    group: 'Court Legends',
    rarity: 'legendary',
    img: '/assets/img/FinalShot.webp',
    fullImage: true,
    stats: { fans: 96, style: 89, influence: 95, energy: 90 },
    description: 'Quando il tempo sta per scadere, tutti sanno chi prenderà l\'ultimo tiro.'
  },
  {
    id: 'court-epic-001',
    name: 'Neon Crossover',
    artistClass: 'The Playmaker',
    variant: 'Neon Crossover',
    group: 'Court Legends',
    rarity: 'epic',
    img: '/assets/img/NeonCrossover.webp',
    fullImage: true,
    stats: { fans: 86, style: 94, influence: 82, energy: 88 },
    description: 'Un cambio di direzione e il difensore resta indietro. Eleganza e velocità in un solo movimento.'
  },
  {
    id: 'court-epic-002',
    name: 'Rim Crusher',
    artistClass: 'The Titan',
    variant: 'Rim Crusher',
    group: 'Court Legends',
    rarity: 'epic',
    img: '/assets/img/RimCrusher.webp',
    fullImage: true,
    stats: { fans: 88, style: 80, influence: 82, energy: 95 },
    description: 'Attacca il ferro senza esitazione. Ogni schiacciata sembra voler distruggere il canestro.'
  },
  {
    id: 'court-epic-003',
    name: 'Arc Assassin',
    artistClass: 'The Sniper',
    variant: 'Arc Assassin',
    group: 'Court Legends',
    rarity: 'epic',
    img: '/assets/img/ArcAssassin.webp',
    fullImage: true,
    stats: { fans: 84, style: 88, influence: 90, energy: 82 },
    description: 'Oltre la linea dei tre punti non esiste distanza. Solo bersagli.'
  },
  {
    id: 'court-epic-004',
    name: 'Court Emperor',
    artistClass: 'The MVP',
    variant: 'Court Emperor',
    group: 'Court Legends',
    rarity: 'epic',
    img: '/assets/img/CourtEmperor.webp',
    fullImage: true,
    stats: { fans: 90, style: 86, influence: 91, energy: 84 },
    description: 'Comanda il parquet con presenza assoluta. Il ritmo della partita segue i suoi ordini.'
  },
  {
    id: 'court-rare-001',
    name: 'Blue Lightning',
    artistClass: 'The Speedster',
    variant: 'Blue Lightning',
    group: 'Court Legends',
    rarity: 'rare',
    img: '/assets/img/BlueLightning.webp',
    fullImage: true,
    stats: { fans: 78, style: 84, influence: 74, energy: 90 },
    description: 'Un lampo attraversa il campo prima che la difesa possa reagire.'
  },
  {
    id: 'court-rare-002',
    name: 'Glass Breaker',
    artistClass: 'The Rebounder',
    variant: 'Glass Breaker',
    group: 'Court Legends',
    rarity: 'rare',
    img: '/assets/img/GlassBreaker.webp',
    fullImage: true,
    stats: { fans: 76, style: 70, influence: 80, energy: 88 },
    description: 'Ogni rimbalzo è suo. Sotto canestro trasforma centimetri e forza in dominio.'
  },
  {
    id: 'court-rare-003',
    name: 'Shadow Guard',
    artistClass: 'The Lockdown',
    variant: 'Shadow Guard',
    group: 'Court Legends',
    rarity: 'rare',
    img: '/assets/img/ShadowGuard.webp',
    fullImage: true,
    stats: { fans: 72, style: 78, influence: 86, energy: 82 },
    description: 'Segue ogni movimento come un\'ombra. Superarlo significa trovare una strada che non esiste.'
  },
  {
    id: 'court-rare-004',
    name: 'Fast Break',
    artistClass: 'The Speedster',
    variant: 'Fast Break',
    group: 'Court Legends',
    rarity: 'rare',
    img: '/assets/img/FastBreak.webp',
    fullImage: true,
    stats: { fans: 80, style: 82, influence: 72, energy: 86 },
    description: 'Da una palla recuperata al canestro passano soltanto pochi secondi.'
  },
  {
    id: 'court-uncommon-001',
    name: 'Street Vision',
    artistClass: 'The Playmaker',
    variant: 'Street Vision',
    group: 'Court Legends',
    rarity: 'uncommon',
    img: '/assets/img/StreetVision.webp',
    fullImage: true,
    stats: { fans: 72, style: 80, influence: 74, energy: 72 },
    description: 'Cresciuto sui playground, vede passaggi che gli altri scoprono soltanto quando è troppo tardi.'
  },
  {
    id: 'court-uncommon-002',
    name: 'Paint Warrior',
    artistClass: 'The Titan',
    variant: 'Paint Warrior',
    group: 'Court Legends',
    rarity: 'uncommon',
    img: '/assets/img/PaintWarrior.webp',
    fullImage: true,
    stats: { fans: 70, style: 64, influence: 72, energy: 82 },
    description: 'Nel pitturato non arretra di un centimetro. Ogni possesso diventa una battaglia.'
  },
  {
    id: 'court-uncommon-003',
    name: 'Corner Flame',
    artistClass: 'The Sniper',
    variant: 'Corner Flame',
    group: 'Court Legends',
    rarity: 'uncommon',
    img: '/assets/img/CornerFlame.webp',
    fullImage: true,
    stats: { fans: 68, style: 76, influence: 70, energy: 74 },
    description: 'Aspetta nell\'angolo e colpisce appena arriva il pallone. Rapido, preciso, letale.'
  },
  {
    id: 'court-uncommon-004',
    name: 'Vertical Rush',
    artistClass: 'The High Flyer',
    variant: 'Vertical Rush',
    group: 'Court Legends',
    rarity: 'uncommon',
    img: '/assets/img/VerticalRush.webp',
    fullImage: true,
    stats: { fans: 74, style: 78, influence: 66, energy: 80 },
    description: 'Un passo, uno stacco, poi soltanto aria. Vive sopra il ferro.'
  },
  {
    id: 'court-common-001',
    name: 'Baseline Kid',
    artistClass: 'The Rookie',
    variant: 'Baseline Kid',
    group: 'Court Legends',
    rarity: 'common',
    img: '/assets/img/BaselineKid.webp',
    fullImage: true,
    stats: { fans: 62, style: 66, influence: 58, energy: 70 },
    description: 'Corre lungo la linea di fondo aspettando il momento giusto per sorprendere la difesa.'
  },
  {
    id: 'court-common-002',
    name: 'City Hooper',
    artistClass: 'The Street Baller',
    variant: 'City Hooper',
    group: 'Court Legends',
    rarity: 'common',
    img: '/assets/img/CityHooper.webp',
    fullImage: true,
    stats: { fans: 66, style: 72, influence: 60, energy: 68 },
    description: 'Asfalto, rete consumata e luci della città. È qui che ha imparato a giocare.'
  },
  {
    id: 'court-common-003',
    name: 'Quick Release',
    artistClass: 'The Sniper',
    variant: 'Quick Release',
    group: 'Court Legends',
    rarity: 'common',
    img: '/assets/img/QuickRelease.webp',
    fullImage: true,
    stats: { fans: 60, style: 68, influence: 64, energy: 66 },
    description: 'Riceve, tira, segna. Nessun movimento sprecato.'
  },
  {
    id: 'court-common-004',
    name: 'Hard Screen',
    artistClass: 'The Enforcer',
    variant: 'Hard Screen',
    group: 'Court Legends',
    rarity: 'common',
    img: '/assets/img/HardScreen.webp',
    fullImage: true,
    stats: { fans: 58, style: 56, influence: 68, energy: 74 },
    description: 'Fa il lavoro che non finisce negli highlights. Un blocco alla volta apre la strada alla squadra.'
  }
];

export function findCardById(id) {
  return CARDS.find((c) => c.id === id) || null;
}

export function getArtistClasses() {
  return CARDS.reduce((acc, c) => {
    if (!acc.includes(c.artistClass)) acc.push(c.artistClass);
    return acc;
  }, []);
}
