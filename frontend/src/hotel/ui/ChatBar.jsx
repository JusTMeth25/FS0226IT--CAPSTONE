import { useEffect, useRef, useState } from 'react';

const MAX_LENGTH = 100;

/**
 * Barra della chat in basso, come su Habbo.
 *
 * - Invio: parla. Con "Grida" attivo il fumetto e' in grassetto maiuscolo.
 * - "/w nome messaggio" o il sussurro scelto dalla scheda utente: arriva solo a quella persona.
 * - Mentre si scrive gli altri vedono i puntini sopra la testa; spariscono all'invio o se
 *   si cancella tutto.
 */
export default function ChatBar({ send, whisperTo, onClearWhisper, disabled }) {
  const [text, setText] = useState('');
  const [shout, setShout] = useState(false);
  const typingRef = useRef(false);
  const inputRef = useRef(null);

  const setTyping = (on) => {
    if (typingRef.current === on) return;
    typingRef.current = on;
    send({ type: 'typing', on });
  };

  useEffect(() => {
    if (whisperTo) inputRef.current?.focus();
  }, [whisperTo]);

  function submit(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;

    const command = /^\/w\s+(\S+)\s+(.+)$/i.exec(value);
    if (command) send({ type: 'whisper', to: command[1], text: command[2] });
    else if (whisperTo) send({ type: 'whisper', to: whisperTo, text: value });
    else send({ type: shout ? 'shout' : 'chat', text: value });

    setText('');
    setTyping(false);
  }

  return (
    <form className="hotel-chat" onSubmit={submit}>
      {whisperTo && (
        <button type="button" className="hotel-chat-whisper" onClick={onClearWhisper} title="Smetti di sussurrare">
          <i className="ph-fill ph-ear" /> {whisperTo} <i className="ph ph-x" />
        </button>
      )}
      <input
        ref={inputRef}
        className="hotel-chat-input"
        value={text}
        maxLength={MAX_LENGTH}
        disabled={disabled}
        placeholder={whisperTo ? `Sussurra a ${whisperTo}…` : 'Scrivi qui e premi Invio…'}
        onChange={(e) => {
          setText(e.target.value);
          setTyping(e.target.value.trim().length > 0);
        }}
        onBlur={() => setTyping(false)}
        aria-label="Messaggio"
      />
      {!whisperTo && (
        <button
          type="button"
          className={`hotel-chat-mode${shout ? ' active' : ''}`}
          onClick={() => setShout((s) => !s)}
          aria-pressed={shout}
          title="Grida: il messaggio appare in grassetto"
        >
          <i className="ph-fill ph-megaphone" />
        </button>
      )}
      <button type="submit" className="hotel-chat-send" disabled={disabled || !text.trim()} aria-label="Invia">
        <i className="ph-fill ph-paper-plane-tilt" />
      </button>
    </form>
  );
}
