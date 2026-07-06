/**
 * VinylLegends - Database carte (artisti musicali IP originali)
 * 8 classi x 5 carte + alcune carte speciali affiancate al roster principale.
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
    img: '',
    stats: { fans: 80, style: 90, influence: 72, energy: 70 },
    description: 'Vestito di neon, trasforma ogni palco in un caleidoscopio di colori e musica travolgente.'
  },
  {
    id: 'showman-004',
    name: 'Velvet Crown',
    artistClass: 'The Showman',
    variant: 'Velvet Crown',
    rarity: 'uncommon',
    img: '',
    stats: { fans: 72, style: 78, influence: 68, energy: 65 },
    description: 'Eleganza pura. La sua presenza scenica è velluto, la sua corona è fatta di rispetto.'
  },
  {
    id: 'showman-005',
    name: 'Crimson Stage',
    artistClass: 'The Showman',
    variant: 'Crimson Stage',
    rarity: 'common',
    img: '',
    stats: { fans: 65, style: 70, influence: 60, energy: 62 },
    description: 'Il palcoscenico è la sua casa. Ogni esibizione è un\'esplosione di passione cremisi.'
  },
  {
    id: 'showman-extra-001',
    name: 'Michael Jackson',
    artistClass: 'The Showman',
    variant: 'King of Pop',
    rarity: 'legendary',
    img: '/assets/img/Michael_Jackson.webp',
    fullImage: true,
    stats: { fans: 100, style: 100, influence: 100, energy: 95 },
    description: 'Il Re del Pop. La sua musica ha attraversato ogni confine, unendo il mondo con un\'unica, inconfondibile voce. Leggenda assoluta della musica.'
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
    img: 'assets/img/RiotAvenue.webp',
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
    img: '',
    stats: { fans: 85, style: 72, influence: 90, energy: 88 },
    description: 'Il caos è la sua arma. Ogni beat è un\'esplosione di energia incontrollabile.'
  },
  {
    id: 'rebel-003',
    name: 'Crimson Riot',
    artistClass: 'The Rebel',
    variant: 'Crimson Riot',
    rarity: 'rare',
    img: '',
    stats: { fans: 78, style: 68, influence: 85, energy: 82 },
    description: 'Rosso di rabbia, nero di cuore. La sua musica è un grido di libertà.'
  },
  {
    id: 'rebel-004',
    name: 'Street Voltage',
    artistClass: 'The Rebel',
    variant: 'Street Voltage',
    rarity: 'uncommon',
    img: '',
    stats: { fans: 70, style: 62, influence: 76, energy: 75 },
    description: 'Nato per strada, cresciuto a elettricità. Ogni riff è pura tensione.'
  },
  {
    id: 'rebel-005',
    name: 'Broken Chains',
    artistClass: 'The Rebel',
    variant: 'Broken Chains',
    rarity: 'common',
    img: '',
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
    id: 'virtuoso-000',
    name: 'Carlos Santana',
    artistClass: 'The Virtuoso',
    variant: 'VynilLegends',
    rarity: 'legendary',
    img: '/assets/img/Carlos_Santana_VynilLegends.webp',
    fullImage: true,
    stats: { fans: 98, style: 96, influence: 95, energy: 92 },
    description: 'Leggenda vivente della chitarra. Ogni nota attraversa decenni di storia, fondendo rock, blues e latin soul in un\'unica voce eterna.'
  },
  {
    id: 'virtuoso-001',
    name: 'Virtuoso\'s Soul',
    artistClass: 'The Virtuoso',
    variant: 'Virtuoso\'s Soul',
    rarity: 'legendary',
    img: '',
    stats: { fans: 88, style: 98, influence: 85, energy: 82 },
    description: 'L\'anima della musica stessa. Ogni nota è perfetta, ogni pausa è divina.'
  },
  {
    id: 'virtuoso-002',
    name: 'String Theory',
    artistClass: 'The Virtuoso',
    variant: 'String Theory',
    rarity: 'epic',
    img: '',
    stats: { fans: 82, style: 94, influence: 78, energy: 76 },
    description: 'Le corde della sua chitarra vibrano in armonia con l\'universo stesso.'
  },
  {
    id: 'virtuoso-003',
    name: 'Harmonic Blade',
    artistClass: 'The Virtuoso',
    variant: 'Harmonic Blade',
    rarity: 'rare',
    img: '',
    stats: { fans: 75, style: 88, influence: 72, energy: 70 },
    description: 'Lama armonica, taglia il silenzio con precisione chirurgica e bellezza melodica.'
  },
  {
    id: 'virtuoso-004',
    name: 'Crystal Note',
    artistClass: 'The Virtuoso',
    variant: 'Crystal Note',
    rarity: 'uncommon',
    img: '',
    stats: { fans: 68, style: 80, influence: 65, energy: 64 },
    description: 'Note di cristallo che brillano nell\'aria. Purezza sonora allo stato massimo.'
  },
  {
    id: 'virtuoso-005',
    name: 'Silver Scale',
    artistClass: 'The Virtuoso',
    variant: 'Silver Scale',
    rarity: 'common',
    img: '',
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
    img: '',
    stats: { fans: 90, style: 96, influence: 92, energy: 88 },
    description: 'Il futuro ha una frequenza, e lui l\'ha catturata. Musica che anticipa i tempi.'
  },
  {
    id: 'innovator-002',
    name: 'Digital Wave',
    artistClass: 'The Innovator',
    variant: 'Digital Wave',
    rarity: 'epic',
    img: '',
    stats: { fans: 84, style: 90, influence: 86, energy: 82 },
    description: 'Onde digitali che trasportano l\'ascoltatore in una nuova dimensione sonora.'
  },
  {
    id: 'innovator-003',
    name: 'Neon Circuit',
    artistClass: 'The Innovator',
    variant: 'Neon Circuit',
    rarity: 'rare',
    img: '',
    stats: { fans: 76, style: 84, influence: 78, energy: 76 },
    description: 'Circuiti di neon pulsano al ritmo di un futuro già presente.'
  },
  {
    id: 'innovator-004',
    name: 'Binary Beat',
    artistClass: 'The Innovator',
    variant: 'Binary Beat',
    rarity: 'uncommon',
    img: '',
    stats: { fans: 68, style: 76, influence: 70, energy: 70 },
    description: '0 e 1 che ballano. La musica digitale trova l\'anima nei bit.'
  },
  {
    id: 'innovator-005',
    name: 'Pixel Bass',
    artistClass: 'The Innovator',
    variant: 'Pixel Bass',
    rarity: 'common',
    img: '',
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
    img: '',
    stats: { fans: 94, style: 88, influence: 96, energy: 72 },
    description: 'Tempesta lirica. Le sue parole sono fulmini, i suoi versi sono tuoni.'
  },
  {
    id: 'poet-002',
    name: 'Verse of Fire',
    artistClass: 'The Poet',
    variant: 'Verse of Fire',
    rarity: 'epic',
    img: '',
    stats: { fans: 86, style: 82, influence: 90, energy: 68 },
    description: 'Versi infuocati che bruciano l\'anima. Poesia che incendia i cuori.'
  },
  {
    id: 'poet-003',
    name: 'Silent Rhyme',
    artistClass: 'The Poet',
    variant: 'Silent Rhyme',
    rarity: 'rare',
    img: '',
    stats: { fans: 78, style: 76, influence: 82, energy: 62 },
    description: 'Rime silenziose che parlano più forte delle urla. La potenza del silenzio.'
  },
  {
    id: 'poet-004',
    name: 'Paper Wings',
    artistClass: 'The Poet',
    variant: 'Paper Wings',
    rarity: 'uncommon',
    img: '',
    stats: { fans: 70, style: 70, influence: 74, energy: 58 },
    description: 'Ali di carta che volano lontano. Ogni verso è un viaggio.'
  },
  {
    id: 'poet-005',
    name: 'Ink & Soul',
    artistClass: 'The Poet',
    variant: 'Ink & Soul',
    rarity: 'common',
    img: '',
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
    img: '',
    stats: { fans: 96, style: 80, influence: 86, energy: 100 },
    description: 'Il tuono ha trovato una chitarra. Ogni accordo scuote le fondamenta della terra.'
  },
  {
    id: 'riff-002',
    name: 'Electric Throne',
    artistClass: 'The King of Riffs',
    variant: 'Electric Throne',
    rarity: 'epic',
    img: '',
    stats: { fans: 88, style: 74, influence: 80, energy: 94 },
    description: 'Siede sul trono elettrico, signore incontrastato dei riff più potenti.'
  },
  {
    id: 'riff-003',
    name: 'Iron Strings',
    artistClass: 'The King of Riffs',
    variant: 'Iron Strings',
    rarity: 'rare',
    img: '',
    stats: { fans: 80, style: 68, influence: 74, energy: 86 },
    description: 'Corde d\'acciaio per un suono che piega il metallo. Riff che forgiano leggende.'
  },
  {
    id: 'riff-004',
    name: 'Steel Resonance',
    artistClass: 'The King of Riffs',
    variant: 'Steel Resonance',
    rarity: 'uncommon',
    img: '',
    stats: { fans: 72, style: 62, influence: 66, energy: 78 },
    description: 'Risonanza d\'acciaio. Il suono che rimane anche dopo l\'ultima nota.'
  },
  {
    id: 'riff-005',
    name: 'Power Chords',
    artistClass: 'The King of Riffs',
    variant: 'Power Chords',
    rarity: 'common',
    img: '',
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
    img: '',
    stats: { fans: 86, style: 90, influence: 82, energy: 70 },
    description: 'Ninnananna astrale che culla l\'universo. La musica dei sogni più profondi.'
  },
  {
    id: 'dreamer-002',
    name: 'Nebula Voice',
    artistClass: 'The Dreamer',
    variant: 'Nebula Voice',
    rarity: 'epic',
    img: '',
    stats: { fans: 80, style: 84, influence: 76, energy: 66 },
    description: 'Voce di nebulosa, eterea e misteriosa. Canta i segreti delle stelle.'
  },
  {
    id: 'dreamer-003',
    name: 'Star Gazer',
    artistClass: 'The Dreamer',
    variant: 'Star Gazer',
    rarity: 'rare',
    img: '',
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
