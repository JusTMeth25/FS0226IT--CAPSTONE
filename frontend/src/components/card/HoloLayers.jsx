/** Riflesso olografico + sparkle (solo rarità alte, gestito via CSS) che segue il puntatore. */
export default function HoloLayers() {
  return (
    <>
      <div className="card-holo-glare" />
      <div className="card-holo-rainbow" />
      <div className="card-holo-sparkles">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={`card-sparkle card-sparkle-${i + 1}`} />
        ))}
      </div>
    </>
  );
}
