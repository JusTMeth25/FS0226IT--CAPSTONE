/**
 * Seed realistico per VinylDex.
 * Popola: classi artista, carte originali (43), pacchetti + drop-rate + garanzie,
 * missioni, un evento demo, l'album base e un utente admin di test.
 * Idempotente: usa upsert, eseguibile più volte senza duplicare dati.
 *
 * Run: node backend/seed.js
 */
const bcrypt = require('bcryptjs');
const prisma = require('./src/prismaClient');

const ARTIST_CLASSES = [
  { slug: 'the-showman', name: 'The Showman' },
  { slug: 'the-rebel', name: 'The Rebel' },
  { slug: 'the-virtuoso', name: 'The Virtuoso' },
  { slug: 'the-innovator', name: 'The Innovator' },
  { slug: 'the-poet', name: 'The Poet' },
  { slug: 'the-king-of-riffs', name: 'The King of Riffs' },
  { slug: 'the-dreamer', name: 'The Dreamer' },
  { slug: 'the-synth-master', name: 'The Synth Master' }
];

const CARDS = [
  { code: 'showman-001', name: 'Royal Echo', classSlug: 'the-showman', variant: 'Royal Echo', rarity: 'legendary', imgUrl: '/assets/img/RoyalEcho.webp', fullImage: true, fans: 95, style: 92, influence: 88, energy: 78, description: 'Il re dei palchi. La sua voce echeggia attraverso stadi infiniti, incantando folle con ogni nota.' },
  { code: 'showman-002', name: 'Golden Voice', classSlug: 'the-showman', variant: 'Golden Voice', rarity: 'epic', imgUrl: '/assets/img/GoldenVoice.webp', fullImage: true, fans: 88, style: 85, influence: 80, energy: 74, description: 'Una voce talmente pura da far brillare l\'oro. Ogni performance è una sinfonia di luce e suono.' },
  { code: 'showman-003', name: 'Neon Performer', classSlug: 'the-showman', variant: 'Neon Performer', rarity: 'rare', imgUrl: '', fans: 80, style: 90, influence: 72, energy: 70, description: 'Vestito di neon, trasforma ogni palco in un caleidoscopio di colori e musica travolgente.' },
  { code: 'showman-004', name: 'Velvet Crown', classSlug: 'the-showman', variant: 'Velvet Crown', rarity: 'uncommon', imgUrl: '', fans: 72, style: 78, influence: 68, energy: 65, description: 'Eleganza pura. La sua presenza scenica è velluto, la sua corona è fatta di rispetto.' },
  { code: 'showman-005', name: 'Crimson Stage', classSlug: 'the-showman', variant: 'Crimson Stage', rarity: 'common', imgUrl: '', fans: 65, style: 70, influence: 60, energy: 62, description: 'Il palcoscenico è la sua casa. Ogni esibizione è un\'esplosione di passione cremisi.' },
  { code: 'showman-extra-001', name: 'Michael Jackson', classSlug: 'the-showman', variant: 'King of Pop', rarity: 'legendary', imgUrl: '/assets/img/Michael_Jackson.webp', fullImage: true, fans: 100, style: 100, influence: 100, energy: 95, description: 'Il Re del Pop. La sua musica ha attraversato ogni confine, unendo il mondo con un\'unica, inconfondibile voce.' },

  { code: 'rebel-001', name: 'Riot Avenue', classSlug: 'the-rebel', variant: 'Riot Avenue', rarity: 'legendary', imgUrl: '/assets/img/RiotAvenue.webp', fullImage: true, fans: 92, style: 78, influence: 95, energy: 90, description: 'La rivoluzione suona come un riff distorto. Riot Avenue guida la rivolta musicale.' },
  { code: 'rebel-002', name: 'Chaos Pulse', classSlug: 'the-rebel', variant: 'Chaos Pulse', rarity: 'epic', imgUrl: '', fans: 85, style: 72, influence: 90, energy: 88, description: 'Il caos è la sua arma. Ogni beat è un\'esplosione di energia incontrollabile.' },
  { code: 'rebel-003', name: 'Crimson Riot', classSlug: 'the-rebel', variant: 'Crimson Riot', rarity: 'rare', imgUrl: '', fans: 78, style: 68, influence: 85, energy: 82, description: 'Rosso di rabbia, nero di cuore. La sua musica è un grido di libertà.' },
  { code: 'rebel-004', name: 'Street Voltage', classSlug: 'the-rebel', variant: 'Street Voltage', rarity: 'uncommon', imgUrl: '', fans: 70, style: 62, influence: 76, energy: 75, description: 'Nato per strada, cresciuto a elettricità. Ogni riff è pura tensione.' },
  { code: 'rebel-005', name: 'Broken Chains', classSlug: 'the-rebel', variant: 'Broken Chains', rarity: 'common', imgUrl: '', fans: 62, style: 58, influence: 70, energy: 68, description: 'Catene spezzate, spirito libero. La ribellione è il suo unico credo.' },
  { code: 'rebel-extra-001', name: 'Whisker Riot', classSlug: 'the-rebel', variant: 'The Nine Lives Legend', group: 'Stray Cats', rarity: 'legendary', imgUrl: '/assets/img/whisker.webp', fullImage: true, fans: 98, style: 95, influence: 97, energy: 94, description: 'Nove vite, una sola missione: far tremare il palco.' },

  { code: 'virtuoso-000', name: 'Carlos Santana', classSlug: 'the-virtuoso', variant: 'VynilLegends', rarity: 'legendary', imgUrl: '/assets/img/Carlos_Santana_VynilLegends.webp', fullImage: true, fans: 98, style: 96, influence: 95, energy: 92, description: 'Leggenda vivente della chitarra. Ogni nota attraversa decenni di storia.' },
  { code: 'virtuoso-001', name: "Virtuoso's Soul", classSlug: 'the-virtuoso', variant: "Virtuoso's Soul", rarity: 'legendary', imgUrl: '', fans: 88, style: 98, influence: 85, energy: 82, description: "L'anima della musica stessa. Ogni nota è perfetta, ogni pausa è divina." },
  { code: 'virtuoso-002', name: 'String Theory', classSlug: 'the-virtuoso', variant: 'String Theory', rarity: 'epic', imgUrl: '', fans: 82, style: 94, influence: 78, energy: 76, description: "Le corde della sua chitarra vibrano in armonia con l'universo stesso." },
  { code: 'virtuoso-003', name: 'Harmonic Blade', classSlug: 'the-virtuoso', variant: 'Harmonic Blade', rarity: 'rare', imgUrl: '', fans: 75, style: 88, influence: 72, energy: 70, description: 'Lama armonica, taglia il silenzio con precisione chirurgica e bellezza melodica.' },
  { code: 'virtuoso-004', name: 'Crystal Note', classSlug: 'the-virtuoso', variant: 'Crystal Note', rarity: 'uncommon', imgUrl: '', fans: 68, style: 80, influence: 65, energy: 64, description: "Note di cristallo che brillano nell'aria. Purezza sonora allo stato massimo." },
  { code: 'virtuoso-005', name: 'Silver Scale', classSlug: 'the-virtuoso', variant: 'Silver Scale', rarity: 'common', imgUrl: '', fans: 60, style: 74, influence: 58, energy: 60, description: "Scale d'argento, esercizio quotidiano. La perfezione si costruisce nota dopo nota." },

  { code: 'innovator-001', name: 'Future Frequency', classSlug: 'the-innovator', variant: 'Future Frequency', rarity: 'legendary', imgUrl: '', fans: 90, style: 96, influence: 92, energy: 88, description: "Il futuro ha una frequenza, e lui l'ha catturata. Musica che anticipa i tempi." },
  { code: 'innovator-002', name: 'Digital Wave', classSlug: 'the-innovator', variant: 'Digital Wave', rarity: 'epic', imgUrl: '', fans: 84, style: 90, influence: 86, energy: 82, description: "Onde digitali che trasportano l'ascoltatore in una nuova dimensione sonora." },
  { code: 'innovator-003', name: 'Neon Circuit', classSlug: 'the-innovator', variant: 'Neon Circuit', rarity: 'rare', imgUrl: '', fans: 76, style: 84, influence: 78, energy: 76, description: 'Circuiti di neon pulsano al ritmo di un futuro già presente.' },
  { code: 'innovator-004', name: 'Binary Beat', classSlug: 'the-innovator', variant: 'Binary Beat', rarity: 'uncommon', imgUrl: '', fans: 68, style: 76, influence: 70, energy: 70, description: "0 e 1 che ballano. La musica digitale trova l'anima nei bit." },
  { code: 'innovator-005', name: 'Pixel Bass', classSlug: 'the-innovator', variant: 'Pixel Bass', rarity: 'common', imgUrl: '', fans: 62, style: 70, influence: 64, energy: 66, description: 'Bassi pixelati che fanno vibrare i monitor. Retro futuro in ogni nota.' },

  { code: 'poet-001', name: 'Lyric Storm', classSlug: 'the-poet', variant: 'Lyric Storm', rarity: 'legendary', imgUrl: '', fans: 94, style: 88, influence: 96, energy: 72, description: 'Tempesta lirica. Le sue parole sono fulmini, i suoi versi sono tuoni.' },
  { code: 'poet-002', name: 'Verse of Fire', classSlug: 'the-poet', variant: 'Verse of Fire', rarity: 'epic', imgUrl: '', fans: 86, style: 82, influence: 90, energy: 68, description: "Versi infuocati che bruciano l'anima. Poesia che incendia i cuori." },
  { code: 'poet-003', name: 'Silent Rhyme', classSlug: 'the-poet', variant: 'Silent Rhyme', rarity: 'rare', imgUrl: '', fans: 78, style: 76, influence: 82, energy: 62, description: 'Rime silenziose che parlano più forte delle urla. La potenza del silenzio.' },
  { code: 'poet-004', name: 'Paper Wings', classSlug: 'the-poet', variant: 'Paper Wings', rarity: 'uncommon', imgUrl: '', fans: 70, style: 70, influence: 74, energy: 58, description: 'Ali di carta che volano lontano. Ogni verso è un viaggio.' },
  { code: 'poet-005', name: 'Ink & Soul', classSlug: 'the-poet', variant: 'Ink & Soul', rarity: 'common', imgUrl: '', fans: 64, style: 64, influence: 66, energy: 56, description: "Inchiostro e anima si fondono in versi che raccontano storie di vita." },

  { code: 'riff-001', name: 'Thunder Chord', classSlug: 'the-king-of-riffs', variant: 'Thunder Chord', rarity: 'legendary', imgUrl: '', fans: 96, style: 80, influence: 86, energy: 100, description: 'Il tuono ha trovato una chitarra. Ogni accordo scuote le fondamenta della terra.' },
  { code: 'riff-002', name: 'Electric Throne', classSlug: 'the-king-of-riffs', variant: 'Electric Throne', rarity: 'epic', imgUrl: '', fans: 88, style: 74, influence: 80, energy: 94, description: 'Siede sul trono elettrico, signore incontrastato dei riff più potenti.' },
  { code: 'riff-003', name: 'Iron Strings', classSlug: 'the-king-of-riffs', variant: 'Iron Strings', rarity: 'rare', imgUrl: '', fans: 80, style: 68, influence: 74, energy: 86, description: "Corde d'acciaio per un suono che piega il metallo. Riff che forgiano leggende." },
  { code: 'riff-004', name: 'Steel Resonance', classSlug: 'the-king-of-riffs', variant: 'Steel Resonance', rarity: 'uncommon', imgUrl: '', fans: 72, style: 62, influence: 66, energy: 78, description: "Risonanza d'acciaio. Il suono che rimane anche dopo l'ultima nota." },
  { code: 'riff-005', name: 'Power Chords', classSlug: 'the-king-of-riffs', variant: 'Power Chords', rarity: 'common', imgUrl: '', fans: 66, style: 56, influence: 60, energy: 72, description: "Power chords che fanno vibrare l'aria. L'essenza del rock in tre note." },

  { code: 'dreamer-001', name: 'Astral Lullaby', classSlug: 'the-dreamer', variant: 'Astral Lullaby', rarity: 'legendary', imgUrl: '', fans: 86, style: 90, influence: 82, energy: 70, description: "Ninnananna astrale che culla l'universo. La musica dei sogni più profondi." },
  { code: 'dreamer-002', name: 'Nebula Voice', classSlug: 'the-dreamer', variant: 'Nebula Voice', rarity: 'epic', imgUrl: '', fans: 80, style: 84, influence: 76, energy: 66, description: 'Voce di nebulosa, eterea e misteriosa. Canta i segreti delle stelle.' },
  { code: 'dreamer-003', name: 'Star Gazer', classSlug: 'the-dreamer', variant: 'Star Gazer', rarity: 'rare', imgUrl: '', fans: 72, style: 78, influence: 70, energy: 60, description: 'Osserva le stelle e trasforma il loro brillio in melodie celestiali.' },
  { code: 'dreamer-004', name: 'Lunar Echo', classSlug: 'the-dreamer', variant: 'Lunar Echo', rarity: 'uncommon', imgUrl: '/assets/img/LunarEcho.webp', fullImage: true, fans: 66, style: 70, influence: 64, energy: 56, description: "Eco lunare che danza nella notte. Sussurri d'argento sotto la luna." },
  { code: 'dreamer-005', name: 'Daydreamer', classSlug: 'the-dreamer', variant: 'Daydreamer', rarity: 'common', imgUrl: '/assets/img/DayDreamer.webp', fullImage: true, fans: 58, style: 64, influence: 58, energy: 52, description: 'Sognatore ad occhi aperti. La realtà è solo un suggerimento.' },

  { code: 'synth-001', name: 'Digital God', classSlug: 'the-synth-master', variant: 'Digital God', rarity: 'legendary', imgUrl: '/assets/img/DigitalGod.webp', fullImage: true, fans: 92, style: 98, influence: 94, energy: 96, description: 'Dio digitale del suono. Ogni frequenza è sotto il suo controllo divino.' },
  { code: 'synth-002', name: 'Cyberwave', classSlug: 'the-synth-master', variant: 'Cyberwave', rarity: 'epic', imgUrl: '/assets/img/CyberWave.webp', fullImage: true, fans: 86, style: 92, influence: 88, energy: 90, description: "Onda cibernetica che travolge tutto. Il futuro è adesso, e suona elettronico." },
  { code: 'synth-003', name: 'Pulse Matrix', classSlug: 'the-synth-master', variant: 'Pulse Matrix', rarity: 'rare', imgUrl: '/assets/img/PulseMatrix.webp', fullImage: true, fans: 78, style: 84, influence: 80, energy: 82, description: 'Matrice pulsante di suoni sintetici. La realtà è simulata, la musica è vera.' },
  { code: 'synth-004', name: 'Voltage Beat', classSlug: 'the-synth-master', variant: 'Voltage Beat', rarity: 'uncommon', imgUrl: '/assets/img/VoltageBeat.webp', fullImage: true, fans: 70, style: 76, influence: 72, energy: 74, description: "Battiti ad alto voltaggio. L'elettricità scorre in ogni singolo beat." },
  { code: 'synth-005', name: 'Neon Synth', classSlug: 'the-synth-master', variant: 'Neon Synth', rarity: 'common', imgUrl: '/assets/img/NeonSynth.webp', fullImage: true, fans: 62, style: 68, influence: 64, energy: 66, description: 'Sintetizzatore al neon. Luci aliene e suoni che vengono dal futuro.' }
];

const PACKS = [
  {
    code: 'pack-base', name: 'Pacchetto Base',
    description: '5 carte con 1 Rara garantita. Perfetto per iniziare la collezione!',
    priceGold: 50, cardCount: 5, isFree: true, freeCooldownHours: 4,
    dropRates: { common: 0.50, uncommon: 0.30, rare: 0.12, epic: 0.06, legendary: 0.02 },
    guarantees: { rare: 1 }
  },
  {
    code: 'pack-deluxe', name: 'Pacchetto Deluxe',
    description: '7 carte con 1 Epica garantita. Raddoppia le possibilità di trovare tesori!',
    priceGold: 100, cardCount: 7, isFree: false, freeCooldownHours: 0,
    dropRates: { common: 0.30, uncommon: 0.30, rare: 0.20, epic: 0.15, legendary: 0.05 },
    guarantees: { rare: 1, epic: 1 }
  },
  {
    code: 'pack-premium', name: 'Pacchetto Premium',
    description: '10 carte con 1 Leggendaria garantita. Il massimo del lusso!',
    priceGold: 250, cardCount: 10, isFree: false, freeCooldownHours: 0,
    dropRates: { common: 0.20, uncommon: 0.25, rare: 0.25, epic: 0.20, legendary: 0.10 },
    guarantees: { rare: 1, legendary: 1 }
  }
];

const MISSIONS = [
  { code: 'daily-open-pack', title: 'Apri un pacchetto', description: 'Apri 1 pacchetto oggi', type: 'open_packs', targetValue: 1, rewardGold: 25, rewardXp: 50, isDaily: true },
  { code: 'daily-collect-cards', title: 'Colleziona carte', description: 'Ottieni 3 carte oggi', type: 'collect_cards', targetValue: 3, rewardGold: 30, rewardXp: 60, isDaily: true },
  { code: 'weekly-open-5', title: 'Apri 5 pacchetti', description: 'Apri 5 pacchetti questa settimana', type: 'open_packs', targetValue: 5, rewardGold: 100, rewardXp: 200, isDaily: false },
  { code: 'weekly-legendary', title: 'Caccia alla Leggendaria', description: 'Ottieni 1 carta Leggendaria', type: 'collect_rarity', targetValue: 1, rewardGold: 150, rewardXp: 300, rewardPack: 'pack-deluxe', isDaily: false, metadata: { rarity: 'legendary' } },
  { code: 'weekly-market-sell', title: 'Commerciante', description: 'Vendi 1 carta nel mercato', type: 'sell_market', targetValue: 1, rewardGold: 50, rewardXp: 80, isDaily: false },
  { code: 'weekly-market-buy', title: 'Collezionista Astuto', description: "Compra 1 carta dal mercato", type: 'buy_market', targetValue: 1, rewardGold: 50, rewardXp: 80, isDaily: false },
  { code: 'progress-10', title: 'Prime 10 Carte!', description: 'Colleziona 10 carte uniche', type: 'collect_cards_unique', targetValue: 10, rewardGold: 100, rewardXp: 150, isDaily: false },
  { code: 'progress-25', title: 'Collezionista', description: 'Colleziona 25 carte uniche', type: 'collect_cards_unique', targetValue: 25, rewardGold: 200, rewardXp: 300, isDaily: false },
  { code: 'progress-40', title: 'Completista!', description: 'Colleziona tutte le carte uniche', type: 'collect_cards_unique', targetValue: CARDS.length, rewardGold: 500, rewardXp: 1000, rewardPack: 'pack-premium', isDaily: false },
  { code: 'album-50', title: 'Metà Album', description: "Completa il 50% dell'album", type: 'album_percent', targetValue: 50, rewardGold: 200, rewardXp: 250, isDaily: false, metadata: { percent: 50 } }
];

async function main() {
  console.log('VinylDex seed starting...');

  const classBySlug = {};
  for (const c of ARTIST_CLASSES) {
    const created = await prisma.artistClass.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c
    });
    classBySlug[c.slug] = created.id;
  }
  console.log(`Seeded ${ARTIST_CLASSES.length} artist classes`);

  for (const c of CARDS) {
    await prisma.card.upsert({
      where: { code: c.code },
      update: {
        name: c.name, artistClassId: classBySlug[c.classSlug], variant: c.variant, group: c.group || null,
        rarity: c.rarity, imgUrl: c.imgUrl || null, fullImage: !!c.fullImage,
        fans: c.fans, style: c.style, influence: c.influence, energy: c.energy, description: c.description,
        source: 'original'
      },
      create: {
        code: c.code, name: c.name, artistClassId: classBySlug[c.classSlug], variant: c.variant, group: c.group || null,
        rarity: c.rarity, imgUrl: c.imgUrl || null, fullImage: !!c.fullImage,
        fans: c.fans, style: c.style, influence: c.influence, energy: c.energy, description: c.description,
        source: 'original'
      }
    });
  }
  console.log(`Seeded ${CARDS.length} cards`);

  for (const p of PACKS) {
    const pack = await prisma.pack.upsert({
      where: { code: p.code },
      update: {
        name: p.name, description: p.description, priceGold: p.priceGold, cardCount: p.cardCount,
        isFree: p.isFree, freeCooldownHours: p.freeCooldownHours
      },
      create: {
        code: p.code, name: p.name, description: p.description, priceGold: p.priceGold, cardCount: p.cardCount,
        isFree: p.isFree, freeCooldownHours: p.freeCooldownHours
      }
    });

    for (const [rarity, weight] of Object.entries(p.dropRates)) {
      await prisma.packDropRate.upsert({
        where: { packId_rarity: { packId: pack.id, rarity } },
        update: { weight },
        create: { packId: pack.id, rarity, weight }
      });
    }
    for (const [rarity, count] of Object.entries(p.guarantees)) {
      await prisma.packGuarantee.upsert({
        where: { packId_rarity: { packId: pack.id, rarity } },
        update: { count },
        create: { packId: pack.id, rarity, count }
      });
    }
  }
  console.log(`Seeded ${PACKS.length} packs (drop-rate + garanzie)`);

  for (const m of MISSIONS) {
    await prisma.mission.upsert({
      where: { code: m.code },
      update: m,
      create: m
    });
  }
  console.log(`Seeded ${MISSIONS.length} missions`);

  const event = await prisma.event.upsert({
    where: { code: 'neon-nights' },
    update: {},
    create: {
      code: 'neon-nights',
      name: 'Neon Nights',
      description: 'Evento a tempo: drop-rate bonus per le carte Synth Master e Rebel.',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      bonusDropRateMultiplier: 1.25,
      isActive: true
    }
  });
  console.log(`Seeded event: ${event.name}`);

  const album = await prisma.album.upsert({
    where: { code: 'album-base' },
    update: { name: 'VinylDex' },
    create: { code: 'album-base', name: 'VinylDex', description: 'Catalogo completo degli artisti originali.' }
  });
  const allCards = await prisma.card.findMany({ where: { source: 'original' }, select: { id: true } });
  for (const c of allCards) {
    await prisma.albumCard.upsert({
      where: { albumId_cardId: { albumId: album.id, cardId: c.id } },
      update: {},
      create: { albumId: album.id, cardId: c.id }
    });
  }
  console.log(`Seeded album "${album.name}" with ${allCards.length} cards`);

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@vinyldex.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin1234!';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN' },
    create: {
      username: 'admin', email: adminEmail, passwordHash: adminPasswordHash,
      role: 'ADMIN', gold: 9999
    }
  });
  console.log(`Seeded admin user: ${adminEmail} / ${adminPassword} (cambia la password in produzione!)`);

  console.log('Seed completed.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
