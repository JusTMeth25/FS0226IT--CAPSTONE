import { Component } from 'react';

/**
 * Rete di sicurezza contro i crash: senza, un errore di rendering in una qualsiasi pagina
 * fa sparire l'intera app (schermata bianca). Qui isoliamo il crash al solo contenuto della
 * pagina (vedi AppLayout: avvolge `<Outlet/>`, non l'intero shell), così sidebar/topbar restano
 * utilizzabili e l'utente può navigare altrove. Si resetta automaticamente al cambio pagina
 * perché il nodo <main> che lo contiene ha `key={location.pathname}` (remount forzato).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary ha intercettato un crash:', error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="empty-state glass-panel text-center">
        <div className="empty-state-icon"><i className="ph-fill ph-warning-circle" /></div>
        <div className="empty-state-title">Qualcosa è andato storto</div>
        <p>Si è verificato un errore imprevisto in questa pagina. Prova a ricaricare o torna alla home.</p>
        <div className="empty-state-actions">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            <i className="ph-fill ph-arrows-clockwise" /> Ricarica
          </button>
          <a href="#/home" className="btn btn-secondary">
            <i className="ph-fill ph-house" /> Torna alla Home
          </a>
        </div>
      </div>
    );
  }
}
