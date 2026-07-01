export default function LoadingSpinner({ label = 'Caricamento…' }) {
  return (
    <div className="loading-spinner-wrap">
      <div className="loading-spinner" />
      <span>{label}</span>
    </div>
  );
}
