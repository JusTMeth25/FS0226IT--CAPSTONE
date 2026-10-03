/**
 * Catalogo di Apple Music per il jukebox (iTunes Search API: gratuita, senza chiave, anteprime
 * di 30 secondi per tutti). Stesse funzioni del catalogo di Spotify (spotify.js): brani, album,
 * artisti e radio.
 *
 * La ricerca per titolo rende spesso solo la versione censurata dei brani rap: per quelli si
 * prende dal catalogo dell'artista la versione originale esplicita con lo stesso titolo.
 */

async function itunes(path, params) {
  const res = await fetch(`https://itunes.apple.com/${path}?${new URLSearchParams({ country: 'it', ...params })}`);
  if (!res.ok) throw new Error('apple_search');
  return (await res.json()).results || [];
}

/** Catalogo di un artista (fino a 200 brani), tenuto in memoria per le ricerche dopo. */
const catalogs = new Map();
function artistCatalog(artistId) {
  if (!catalogs.has(artistId)) {
    catalogs.set(artistId, itunes('lookup', { id: artistId, entity: 'song', limit: '200' })
      .then((list) => list.filter((r) => r.wrapperType === 'track' && r.previewUrl))
      .catch(() => []));
  }
  return catalogs.get(artistId);
}

const baseTitle = (name) => name.toLowerCase().split(' (')[0].split(' [')[0];

function appleTrack(r) {
  return {
    title: r.trackName,
    artist: r.artistName,
    artwork: r.artworkUrl100?.replace('100x100', '300x300') || null,
    preview: r.previewUrl,
    url: r.trackViewUrl || null,
    explicit: r.trackExplicitness === 'explicit',
    censored: r.trackExplicitness === 'cleaned'
  };
}

/** Le versioni censurate sostituite dall'originale (stesso artista, stesso titolo), poi un brano per titolo. */
async function uncensored(found, max) {
  const censored = [...new Set(found.filter((r) => r.trackExplicitness === 'cleaned').map((r) => r.artistId))].slice(0, max);
  const uncut = (await Promise.all(censored.map(artistCatalog))).flat().filter((r) => r.trackExplicitness === 'explicit');
  const list = found.map((r) => (r.trackExplicitness !== 'cleaned' ? r
    : uncut.find((u) => u.artistId === r.artistId && baseTitle(u.trackName) === baseTitle(r.trackName)) || r));
  const seen = new Set();
  return list.filter((r) => {
    const key = `${baseTitle(r.trackName)}|${r.artistName.toLowerCase()}|${r.trackName.toLowerCase().includes('live')}`;
    return !seen.has(key) && seen.add(key);
  });
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function searchAppleTracks(query) {
  const found = (await itunes('search', { term: query, entity: 'song', limit: '15' })).filter((r) => r.previewUrl);
  return (await uncensored(found, 3)).map(appleTrack);
}

export async function searchAppleAlbums(query) {
  const found = await itunes('search', { term: query, entity: 'album', limit: '12' });
  // Le versioni "clean" degli album no: c'e' sempre anche l'originale.
  return found.filter((a) => a.collectionExplicitness !== 'cleaned').map((a) => ({
    id: a.collectionId,
    title: a.collectionName,
    artist: a.artistName,
    artwork: a.artworkUrl100?.replace('100x100', '300x300') || null,
    year: (a.releaseDate || '').slice(0, 4),
    total: a.trackCount
  }));
}

export async function appleAlbumTracks(album) {
  const list = await itunes('lookup', { id: album.id, entity: 'song' });
  return list.filter((r) => r.wrapperType === 'track' && r.previewUrl).map(appleTrack);
}

export async function searchAppleArtists(query) {
  const found = await itunes('search', { term: query, entity: 'musicArtist', limit: '8' });
  return found.map((a) => ({ id: a.artistId, title: a.artistName, artwork: null }));
}

export async function appleArtistAlbums(artist) {
  const list = await itunes('lookup', { id: artist.id, entity: 'album', limit: '25' });
  return list.filter((a) => a.wrapperType === 'collection' && a.collectionExplicitness !== 'cleaned').map((a) => ({
    id: a.collectionId,
    title: a.collectionName,
    artist: a.artistName,
    artwork: a.artworkUrl100?.replace('100x100', '300x300') || null,
    year: (a.releaseDate || '').slice(0, 4),
    total: a.trackCount
  }));
}

/** Radio di un artista: i brani del suo catalogo (versioni originali), mescolati. */
export async function appleArtistRadio(artist, size = 40) {
  const songs = (await artistCatalog(artist.id)).filter((r) => r.trackExplicitness !== 'cleaned');
  return shuffle(await uncensored(songs, 0)).slice(0, size).map(appleTrack);
}

/** Radio libera: i brani di una ricerca (un genere, un umore, un anno...), mescolati. */
export async function appleSearchRadio(query, size = 40) {
  // Prima i brani di quel genere, poi quelli che lo nominano; via le basi "da palestra" che hanno
  // il genere nel titolo (Dubstep Running Music...).
  const [byGenre, byWord] = await Promise.all([
    itunes('search', { term: query, entity: 'song', limit: '80', attribute: 'genreTerm' }).catch(() => []),
    itunes('search', { term: query, entity: 'song', limit: '40' }).catch(() => [])
  ]);
  const word = query.toLowerCase().trim();
  const found = [...byGenre, ...byWord].filter((r) => r.previewUrl && !/fitness|workout|allenamento/i.test(r.primaryGenreName || '')
    && !r.trackName.toLowerCase().includes(word));
  return shuffle(await uncensored(found, 4)).slice(0, size).map(appleTrack);
}

/** L'anteprima Apple di un brano di Spotify, per chi nella stanza non ha Spotify. */
export async function applePreviewFor(track) {
  try {
    const found = await searchAppleTracks(`${track.artist.split(',')[0]} ${track.title.split(' (')[0]}`);
    const want = track.title.toLowerCase().split(' (')[0];
    return found.find((t) => t.title.toLowerCase().startsWith(want)) || null;
  } catch {
    return null;
  }
}
