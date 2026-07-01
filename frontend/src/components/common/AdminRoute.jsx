import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import EmptyState from './EmptyState.jsx';

/**
 * Guardia per il pannello Admin: richiede utente autenticato con ruolo ADMIN.
 * Il campo `role` arriverà dal backend in Fase 2 (schema Prisma User.role);
 * finché non è presente, l'accesso viene negato in modo esplicito (fail-closed).
 */
export default function AdminRoute() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return <LoadingSpinner label="Verifica permessi…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'ADMIN') {
    return (
      <EmptyState
        icon="ph-lock-key"
        title="Accesso riservato"
        description="Questa sezione è visibile solo agli amministratori."
      />
    );
  }
  return <Outlet />;
}
