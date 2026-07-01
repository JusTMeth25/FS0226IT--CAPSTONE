import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/common/EmptyState.jsx';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon="ph-map-trifold"
      title="Pagina non trovata"
      description="La sezione che cerchi non esiste."
      action={<button className="btn btn-primary" onClick={() => navigate('/home')}>Torna alla Home</button>}
    />
  );
}
