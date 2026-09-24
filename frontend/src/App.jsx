import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';
import AdminRoute from './components/common/AdminRoute.jsx';
import Aurora from './components/fx/Aurora.jsx';
import Particles from './components/fx/Particles.jsx';
import ClickSpark from './components/fx/ClickSpark.jsx';

import HomePage from './pages/HomePage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import PackOpeningPage from './pages/PackOpeningPage.jsx';
import CollectionPage from './pages/CollectionPage.jsx';
import CardDetailPage from './pages/CardDetailPage.jsx';
import MarketplacePage from './pages/MarketplacePage.jsx';
import TradesPage from './pages/TradesPage.jsx';
import MissionsPage from './pages/MissionsPage.jsx';
import EventsPage from './pages/EventsPage.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import BattlePage from './pages/BattlePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import LoadingSpinner from './components/common/LoadingSpinner.jsx';

// L'hotel ha un motore grafico tutto suo: si scarica solo quando ci si entra.
const HotelPage = lazy(() => import('./pages/HotelPage.jsx'));

export default function App() {
  return (
    <>
      {/* Sfondo animato a livello di applicazione e non dentro la shell: cosi' copre anche
          la pagina di accesso, che ora sta fuori dal layout per occupare tutto lo schermo. */}
      <Aurora />
      <Particles />
      <ClickSpark />

      <Routes>
        {/* Fuori dal layout: niente barra laterale, barra superiore o navigazione in basso.
            Chi non ha ancora un account vede solo la presentazione e il modulo. */}
        <Route path="login" element={<AuthPage />} />
        <Route path="register" element={<AuthPage />} />

        {/* Per giocare serve un account: non esiste piu' una modalita' ospite.
            ProtectedRoute avvolge l'intero layout, quindi ogni pagina interna e'
            raggiungibile solo da autenticati e rimanda all'accesso ricordando la
            destinazione richiesta. */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="home" element={<HomePage />} />
            <Route path="packs" element={<PackOpeningPage />} />
            <Route path="collection" element={<CollectionPage />} />
            <Route path="card/:id" element={<CardDetailPage />} />
            <Route path="marketplace" element={<MarketplacePage />} />
            <Route path="missions" element={<MissionsPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="battle" element={<BattlePage />} />
            <Route path="hotel" element={<Suspense fallback={<LoadingSpinner label="Apro l'hotel…" />}><HotelPage /></Suspense>} />
            <Route path="trades" element={<TradesPage />} />
            <Route path="profile" element={<ProfilePage />} />

            <Route element={<AdminRoute />}>
              <Route path="admin" element={<AdminPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
