import { useEffect, useRef } from 'react';
import { getJukebox } from '../music.js';
import { KARAOKE_SONGS, PITCH_COLORS, PITCH_LABELS } from './karaokeSongs.js';

/**
 * Schermate del karaoke (karaokeGame.jsx): scelta della canzone, le corsie delle altezze con le
 * sillabe che scorrono verso il microfono, il testo della riga con le sillabe gia' cantate
 * accese, il giudizio della riga e il riepilogo finale.
 */

const W = 640;
const H = 250;
const CURSOR = 150;
/** Battiti visibili a destra del cursore. */
const AHEAD = 8;
const TOP = 16;
const LANE_H = 50;

function starsFor(grade) {
  return [20, 45, 70, 95, 112].filter((min) => grade >= min).length;
}

function Lanes({ s }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !s.melody) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== W * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(1, '#3b0764');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const pxPerBeat = (W - CURSOR) / AHEAD;
    const beat = s.t / s.beatMs;
    // Corsie: l'acuto in alto, il basso in fondo.
    for (let level = 0; level < 4; level += 1) {
      const y = TOP + (3 - level) * LANE_H;
      ctx.fillStyle = s.level === level ? 'rgba(255,255,255,0.12)' : level % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, y, W, LANE_H);
      ctx.fillStyle = PITCH_COLORS[level];
      ctx.globalAlpha = 0.8;
      ctx.font = '700 11px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${'ASDF'[level]} · ${PITCH_LABELS[level]}`, 8, y + 16);
      ctx.globalAlpha = 1;
    }
    // Sillabe: barre arrotondate, piene nella parte gia' cantata bene.
    s.melody.syllables.forEach((syl) => {
      const x = CURSOR + (syl.beat - beat) * pxPerBeat;
      const w = syl.length * 0.9 * pxPerBeat;
      if (x > W || x + w < 0) return;
      const y = TOP + (3 - syl.level) * LANE_H + 12;
      const h = LANE_H - 24;
      const color = syl.gold ? '#fbbf24' : PITCH_COLORS[syl.level];
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.fill();
      ctx.stroke();
      const done = Math.min(1, syl.sung / (syl.length * s.beatMs * 0.9));
      if (done > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, h / 2);
        ctx.clip();
        ctx.fillStyle = color;
        if (syl.gold) {
          ctx.shadowColor = '#fde047';
          ctx.shadowBlur = 12;
        }
        ctx.fillRect(x, y, w * done, h);
        ctx.restore();
      }
      ctx.fillStyle = '#fff';
      ctx.font = '700 12px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(syl.text.trim(), x + 6, y + h / 2 + 4);
    });
    // Cursore con il microfono, e la voce di chi canta (pallino all'altezza del tasto).
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(CURSOR, TOP - 6);
    ctx.lineTo(CURSOR, TOP + LANE_H * 4 + 6);
    ctx.stroke();
    if (s.level >= 0) {
      const y = TOP + (3 - s.level) * LANE_H + LANE_H / 2;
      ctx.fillStyle = PITCH_COLORS[s.level];
      ctx.shadowColor = PITCH_COLORS[s.level];
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(CURSOR, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // Conteggio iniziale.
    if (s.t < 0) {
      ctx.fillStyle = '#fde047';
      ctx.font = '900 54px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.ceil(-s.t / s.beatMs)), W / 2, H / 2 + 16);
    }
    // Giudizio della riga.
    if (s.rating && s.t - s.rating.at < 1600) {
      const age = (s.t - s.rating.at) / 1600;
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = s.rating.color;
      ctx.font = '900 30px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.rating.text, W / 2 + 60, 60 - age * 20);
      ctx.globalAlpha = 1;
    }
  });
  return <canvas ref={ref} className="rock-canvas karaoke-canvas" style={{ aspectRatio: `${W} / ${H}` }} aria-label="Corsie del karaoke" />;
}

/** Riga di testo con le sillabe cantate accese, e la riga dopo. */
function Lyrics({ s }) {
  const beat = s.t / s.beatMs;
  const { lines, syllables } = s.melody;
  let current = lines.findIndex((line) => beat < line.end + 0.3);
  if (current < 0) current = lines.length - 1;
  const next = lines[current + 1];
  const words = (index) => syllables.filter((syl) => syl.line === index);
  return (
    <div className="mg-lyrics karaoke-lyrics" aria-live="polite">
      <p className={lines[current].gold ? 'gold' : ''}>
        {words(current).map((syl) => {
          const state = beat >= syl.beat + syl.length * 0.9 ? 'sung' : beat >= syl.beat ? 'now' : '';
          const good = syl.sung > syl.length * s.beatMs * 0.4;
          return <span key={syl.id} className={`${state}${state && good ? ' good' : ''}`}>{syl.text}</span>;
        })}
      </p>
      {next && <p className="next">{words(next.index).map((syl) => syl.text).join('')}</p>}
    </div>
  );
}

export default function KaraokeView({ s, act, grade }) {
  // Mentre si canta la musica della stanza tace; la canzone si ferma chiudendo il gioco.
  const audioRef = useRef(null);
  useEffect(() => {
    audioRef.current = s.audio;
  });
  useEffect(() => {
    getJukebox().setMuted(true);
    return () => {
      getJukebox().setMuted(false);
      audioRef.current?.stop();
    };
  }, []);

  if (s.phase === 'select') {
    return (
      <div className="rock-select">
        <div className="rock-songs">
          {KARAOKE_SONGS.map((song, i) => (
            <button key={song.id} type="button" className={`rock-song karaoke-song${s.song === i ? ' active' : ''}`} onClick={() => act(`song:${i}`)}>
              <strong>{song.title}</strong>
              <span>{song.artist} · {song.genre}</span>
              <small>{song.bpm} bpm · {Array.from({ length: song.level }, (_, k) => <i key={k} className="ph-fill ph-microphone-stage" />)}</small>
            </button>
          ))}
        </div>
        <p className="rock-gear"><i className="ph-fill ph-music-notes" /> Anteprima: “{KARAOKE_SONGS[s.song].lines[0].replace(/[-~*]/g, '')}…”</p>
        <button type="button" className="btn btn-primary rock-go" onClick={() => act('go')}>
          <i className="ph-fill ph-microphone-stage" /> Canta!
        </button>
      </div>
    );
  }
  const stars = starsFor(grade);
  return (
    <div className="rock-stage-view karaoke-view">
      <Lanes s={s} />
      <Lyrics s={s} />
      <div className="mg-row">
        <span>Righe di fila {s.lineStreak} (max {s.bestStreak})</span>
        <div className="mg-big">{grade}<small>punti</small></div>
      </div>
      {s.phase === 'results' && (
        <div className="rock-results">
          <h4>{stars >= 4 ? 'Star della serata!' : stars >= 2 ? 'Bella voce!' : 'Il pubblico applaude lo stesso'}</h4>
          <div className="rock-stars">
            {[1, 2, 3, 4, 5].map((n) => <i key={n} className={`ph-fill ph-star${n <= stars ? ' on' : ''}`} />)}
          </div>
          <p>{s.lineRatings.filter((r) => r >= 0.8).length} righe perfette su {s.lineRatings.length} · serie migliore {s.bestStreak}</p>
          <p className="rock-grade">Voto: <strong>{grade}</strong>/120</p>
          <button type="button" className="btn btn-primary" onClick={() => act('finish')}>Consegna il voto</button>
        </div>
      )}
    </div>
  );
}
