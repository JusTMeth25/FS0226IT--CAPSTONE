import { useEffect, useState } from 'react';
import {
  albumTracks, artistAlbums, artistRadio, connectSpotify, disconnectSpotify, onSpotifyChange, redirectUri,
  searchRadio, searchSpotify, spotifyConfigured, spotifyConnected
} from '../spotify.js';
import {
  appleAlbumTracks, appleArtistAlbums, appleArtistRadio, applePreviewFor, appleSearchRadio, searchAppleAlbums,
  searchAppleArtists, searchAppleTracks
} from '../appleMusic.js';
import { QUEUE_TRACK, getJukebox } from '../music.js';

/**
 * Jukebox (e giradischi) della stanza: chi c'e' cerca canzoni, album e artisti veri e li mette in
 * coda, o accende una radio (un artista, un album, un genere); il server fa partire tutto a tempo
 * per tutti. La ricerca e' su Apple Music (anteprime di 30 secondi, per tutti) o sul proprio
 * Spotify (brani interi per chi ha Premium collegato). In Disco lo usa la regia (admin) e la
 * musica arriva in tutte le discoteche.
 */

/** Le stesse ricerche sui due cataloghi. */
const CATALOGS = {
  apple: {
    track: searchAppleTracks, album: searchAppleAlbums, artist: searchAppleArtists,
    albumTracks: appleAlbumTracks, artistAlbums: appleArtistAlbums, artistRadio: appleArtistRadio, searchRadio: appleSearchRadio
  },
  spotify: {
    track: (q) => searchSpotify(q, 'track'), album: (q) => searchSpotify(q, 'album'), artist: (q) => searchSpotify(q, 'artist'),
    albumTracks, artistAlbums, artistRadio, searchRadio
  }
};

const MODES = [
  ['track', 'Brani', 'ph-music-note'],
  ['album', 'Album', 'ph-vinyl-record'],
  ['artist', 'Artisti', 'ph-user-sound'],
  ['radio', 'Radio', 'ph-radio']
];

const PLACEHOLDER = {
  track: 'Artista o canzone',
  album: 'Titolo dell\'album o artista',
  artist: 'Nome dell\'artista',
  radio: 'Un genere, un umore, un anno: dubstep, rap anni 90...'
};

function formatDuration(ms) {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Solo i campi che il server accetta per un brano. */
function songPayload(t) {
  return { title: t.title, artist: t.artist, artwork: t.artwork, preview: t.preview, url: t.url, spotifyUri: t.spotifyUri, durationMs: t.durationMs };
}

export default function JukeboxPanel({ jukebox, meId, isOwner, send, onClose }) {
  const [source, setSource] = useState(spotifyConnected() ? 'spotify' : 'apple');
  const [mode, setMode] = useState('track');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  // Album aperto (con i brani) o album di un artista.
  const [album, setAlbum] = useState(null);
  const [albums, setAlbums] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [linked, setLinked] = useState(spotifyConnected());
  useEffect(() => onSpotifyChange(() => setLinked(spotifyConnected())), []);

  const catalog = CATALOGS[source];
  const playing = jukebox.track === QUEUE_TRACK ? jukebox.radio : null;
  const queue = jukebox.queue || [];
  const station = jukebox.station;
  const spotifyError = getJukebox().spotifyError;

  async function run(task, failMessage = 'Ricerca non riuscita, riprova.') {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (err) {
      setError(err.message === 'spotify_not_connected' ? 'Collega di nuovo Spotify.' : failMessage);
    } finally {
      setBusy(false);
    }
  }

  function switchTo(nextSource, nextMode) {
    setSource(nextSource);
    setMode(nextMode);
    setResults([]);
    setAlbum(null);
    setAlbums(null);
  }

  /** Accende una radio con questi brani (al massimo 60, li tiene il server). */
  function startRadio(name, tracks) {
    if (!tracks.length) {
      setError('Nessun brano trovato per questa radio.');
      return;
    }
    // A pezzi: il server accetta messaggi piccoli (sotto i 7 KB), il primo accende la radio.
    const list = tracks.slice(0, 60).map(songPayload);
    let chunk = [];
    let first = true;
    const flush = () => {
      if (!chunk.length) return;
      send(first ? { type: 'jukebox_radio', name, tracks: chunk } : { type: 'jukebox_radio', name, append: true, tracks: chunk });
      first = false;
      chunk = [];
    };
    for (const song of list) {
      if (JSON.stringify({ type: 'jukebox_radio', name, append: true, tracks: [...chunk, song] }).length > 6500) flush();
      chunk.push(song);
    }
    flush();
    setNotice(`${name}: ${Math.min(tracks.length, 60)} brani. Suona quando la coda e' vuota.`);
  }

  function search(event) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setAlbum(null);
    setAlbums(null);
    if (mode === 'radio') {
      run(async () => startRadio(`Radio ${q}`, await catalog.searchRadio(q)), 'Radio non riuscita, riprova.');
      return;
    }
    run(async () => setResults(await catalog[mode](q)));
  }

  async function add(track) {
    let song = track;
    // Dai brani di Spotify si cerca anche l'anteprima Apple, cosi' la sente tutta la stanza
    // (se non la trova qui, la cerca il server).
    if (track.spotifyUri && !track.preview) {
      const apple = await applePreviewFor(track);
      if (apple) song = { ...track, preview: apple.preview, url: apple.url, artwork: track.artwork || apple.artwork };
    }
    send({ type: 'jukebox_add', track: songPayload(song) });
  }

  const openAlbum = (a) => run(async () => setAlbum({ ...a, tracks: await catalog.albumTracks(a) }));
  const openArtistAlbums = (artist) => run(async () => setAlbums({ artist, list: await catalog.artistAlbums(artist) }));
  const radioOfArtist = (artist) => run(async () => startRadio(`Radio ${artist.title}`, await catalog.artistRadio(artist)), 'Radio non riuscita, riprova.');

  const trackRow = (t, i) => (
    <li key={`${t.spotifyUri || t.preview}-${i}`}>
      {t.artwork && <img src={t.artwork} alt="" />}
      <span>
        <strong>
          {t.title} {t.explicit && <em className="jukebox-explicit" title="Versione originale (esplicita)">E</em>}
          {t.censored && <em className="jukebox-explicit" title="Versione censurata: l'originale non e' su Apple Music">censurata</em>}
        </strong>
        <small>{t.artist}{t.durationMs ? ` · ${formatDuration(t.durationMs)}` : ''}</small>
      </span>
      <button type="button" className="btn btn-primary btn-small" onClick={() => add(t)} title="Metti in coda"><i className="ph ph-plus" /></button>
    </li>
  );

  const albumRow = (a) => (
    <li key={a.id}>
      {a.artwork && <img src={a.artwork} alt="" />}
      <span>
        <strong>{a.title}</strong>
        <small>{a.artist}{a.year ? ` · ${a.year}` : ''}{a.total ? ` · ${a.total} brani` : ''}</small>
      </span>
      <button type="button" className="btn btn-secondary btn-small" onClick={() => openAlbum(a)} title="Apri l'album"><i className="ph ph-caret-right" /></button>
    </li>
  );

  return (
    <div className="hotel-panel hotel-jukebox-panel" role="dialog" aria-label="Jukebox">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-vinyl-record" /> {jukebox.booth ? 'Regia della Disco' : 'Jukebox'}</h3>
        <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
      </header>
      {jukebox.booth && <p className="jukebox-empty">Le canzoni e le radio che metti qui suonano in tutte le discoteche del server; finita la coda tornano i DJ.</p>}

      {playing && (
        <div className="jukebox-now">
          {playing.artwork && <img src={playing.artwork} alt="" />}
          <div>
            <strong>{playing.title}</strong>
            <small>{playing.artist} · scelta da {playing.addedBy}</small>
            <small className="jukebox-source">
              {playing.spotifyUri && linked && spotifyError == null ? <><i className="ph-fill ph-spotify-logo" /> intera su Spotify</> : <><i className="ph-fill ph-apple-logo" /> anteprima di 30 secondi</>}
            </small>
          </div>
          {(isOwner || playing.addedById === meId) && (
            <button type="button" className="btn btn-secondary btn-small" onClick={() => send({ type: 'jukebox_skip' })} title="Brano successivo">
              <i className="ph-fill ph-skip-forward" />
            </button>
          )}
        </div>
      )}

      {station && (
        <div className="jukebox-station">
          <i className="ph-fill ph-radio" />
          <span>
            <strong>{station.name}</strong>
            <small>{station.left} brani · accesa da {station.addedBy}{station.next?.[0] ? ` · poi ${station.next[0].title}` : ''}</small>
          </span>
          {(isOwner || station.addedById === meId) && (
            <button type="button" className="btn btn-secondary btn-small" onClick={() => send({ type: 'jukebox_radio_stop' })} title="Spegni la radio">
              <i className="ph-fill ph-stop" />
            </button>
          )}
        </div>
      )}

      <div className="jukebox-spotify">
        {!spotifyConfigured() && (
          <small>Spotify non e' ancora configurato: serve il Client ID dell'app Spotify (VITE_SPOTIFY_CLIENT_ID), con redirect {redirectUri()}.</small>
        )}
        {spotifyConfigured() && !linked && (
          <>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => connectSpotify().catch(() => setError('Spotify non risponde.'))}>
              <i className="ph-fill ph-spotify-logo" /> Collega Spotify
            </button>
            <small>Con Spotify Premium senti le canzoni intere, e i brani che metti in coda dall'app di Spotify (anche dal telefono) arrivano qui.</small>
          </>
        )}
        {spotifyConfigured() && linked && (
          <>
            <span><i className="ph-fill ph-spotify-logo" /> Spotify collegato</span>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => { disconnectSpotify(); switchTo('apple', mode); }}>Scollega</button>
            {spotifyError === 'spotify_premium_required' && <small className="jukebox-warn">Il player di Spotify suona solo con Premium: senti l'anteprima.</small>}
          </>
        )}
      </div>

      <div className="jukebox-tabs" role="tablist" aria-label="Catalogo">
        <button type="button" role="tab" aria-selected={source === 'apple'} className={source === 'apple' ? 'active' : ''} onClick={() => switchTo('apple', mode)}>
          <i className="ph-fill ph-apple-logo" /> Apple Music
        </button>
        {linked && (
          <button type="button" role="tab" aria-selected={source === 'spotify'} className={source === 'spotify' ? 'active' : ''} onClick={() => switchTo('spotify', mode)}>
            <i className="ph-fill ph-spotify-logo" /> Spotify
          </button>
        )}
      </div>
      <div className="jukebox-tabs jukebox-modes" role="tablist" aria-label="Cosa cercare">
        {MODES.map(([key, label, icon]) => (
          <button key={key} type="button" role="tab" aria-selected={mode === key} className={mode === key ? 'active' : ''} onClick={() => switchTo(source, key)}>
            <i className={`ph ${icon}`} /> {label}
          </button>
        ))}
      </div>
      <form className="jukebox-search" onSubmit={search}>
        <div className="jukebox-search-row">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={PLACEHOLDER[mode]} maxLength={80} aria-label="Cerca" />
          <button type="submit" className="btn btn-primary btn-small" disabled={busy}>
            <i className={mode === 'radio' ? 'ph-fill ph-radio' : 'ph ph-magnifying-glass'} /> {mode === 'radio' ? 'Accendi' : 'Cerca'}
          </button>
        </div>
      </form>
      {busy && <p className="jukebox-empty">Un attimo...</p>}
      {error && <p className="jukebox-warn">{error}</p>}
      {notice && <p className="jukebox-ok">{notice}</p>}

      {album ? (
        <div className="jukebox-album">
          <div className="jukebox-album-head">
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setAlbum(null)} title="Indietro"><i className="ph ph-caret-left" /></button>
            {album.artwork && <img src={album.artwork} alt="" />}
            <span>
              <strong>{album.title}</strong>
              <small>{album.artist}{album.year ? ` · ${album.year}` : ''}</small>
            </span>
          </div>
          <button type="button" className="btn btn-primary btn-small jukebox-wide" onClick={() => startRadio(album.title, album.tracks)}>
            <i className="ph-fill ph-play" /> Suona tutto l'album
          </button>
          <ul className="jukebox-list">{album.tracks.map(trackRow)}</ul>
        </div>
      ) : albums ? (
        <div className="jukebox-album">
          <div className="jukebox-album-head">
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setAlbums(null)} title="Indietro"><i className="ph ph-caret-left" /></button>
            <span><strong>Album di {albums.artist.title}</strong></span>
          </div>
          <ul className="jukebox-list">{albums.list.map(albumRow)}</ul>
        </div>
      ) : results.length > 0 && (
        <ul className="jukebox-list">
          {mode === 'track' && results.map(trackRow)}
          {mode === 'album' && results.map(albumRow)}
          {mode === 'artist' && results.map((a) => (
            <li key={a.id}>
              {a.artwork ? <img src={a.artwork} alt="" /> : <i className="ph-fill ph-user-sound jukebox-avatar" />}
              <span><strong>{a.title}</strong></span>
              <button type="button" className="btn btn-primary btn-small" onClick={() => radioOfArtist(a)} title={`Radio di ${a.title}`}><i className="ph-fill ph-radio" /> Radio</button>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => openArtistAlbums(a)} title="I suoi album"><i className="ph ph-vinyl-record" /></button>
            </li>
          ))}
        </ul>
      )}

      <h4 className="jukebox-queue-title">In coda {queue.length > 0 && `(${queue.length})`}</h4>
      {queue.length === 0 && <p className="jukebox-empty">{station ? 'Nessuna canzone scelta: suona la radio.' : 'Nessuna canzone in coda: cercane una e premi +.'}</p>}
      <ul className="jukebox-list">
        {queue.map((t, i) => (
          <li key={t.id}>
            <b className="jukebox-pos">{i + 1}</b>
            <span>
              <strong>{t.title}</strong>
              <small>{t.artist} · scelta da {t.addedBy}{t.spotifyUri ? ' · Spotify' : ''}</small>
            </span>
            {(isOwner || t.addedById === meId) && (
              <button type="button" className="btn btn-secondary btn-small" onClick={() => send({ type: 'jukebox_remove', songId: t.id })} title="Togli dalla coda">
                <i className="ph ph-trash" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="jukebox-credits">
        Anteprime e copertine da Apple Music{linked ? ', brani interi da Spotify' : ''}.
      </p>
    </div>
  );
}
