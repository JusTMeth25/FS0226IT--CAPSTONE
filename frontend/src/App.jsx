import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';
import AdminRoute from './components/common/AdminRoute.jsx';
import Aurora from './components/fx/Aurora.jsx';
import Particles from './components/fx/Particles.jsx';
import ClickSpark from './components/fx/ClickSpark.jsx';
import GamepadLayer from './gamepad/GamepadLayer.jsx';

import HomePage from './pages/HomePage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import LoadingSpinner from './components/common/LoadingSpinner.jsx';

// Le pagine si scaricano quando si aprono (la Home e l'accesso subito): il primo caricamento e'
// piu' leggero. L'attesa la mostra il Suspense del layout, attorno alla pagina.
const PackOpeningPage = lazy(() => import('./pages/PackOpeningPage.jsx'));
const CollectionPage = lazy(() => import('./pages/CollectionPage.jsx'));
const CardDetailPage = lazy(() => import('./pages/CardDetailPage.jsx'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage.jsx'));
const TradesPage = lazy(() => import('./pages/TradesPage.jsx'));
const MissionsPage = lazy(() => import('./pages/MissionsPage.jsx'));
const EventsPage = lazy(() => import('./pages/EventsPage.jsx'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const BattlePage = lazy(() => import('./pages/BattlePage.jsx'));
const NewsPage = lazy(() => import('./pages/NewsPage.jsx'));
const SetsPage = lazy(() => import('./pages/SetsPage.jsx'));
const FusionPage = lazy(() => import('./pages/FusionPage.jsx'));
const WishlistPage = lazy(() => import('./pages/WishlistPage.jsx'));
const StatsPage = lazy(() => import('./pages/StatsPage.jsx'));
const BinderPage = lazy(() => import('./pages/BinderPage.jsx'));
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
      {/* Controller Xbox e PlayStation: navigazione, puntatore e tastiera a schermo, su ogni pagina. */}
      <GamepadLayer />

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
            <Route path="news" element={<NewsPage />} />
            <Route path="sets" element={<SetsPage />} />
            <Route path="fusion" element={<FusionPage />} />
            <Route path="binder" element={<BinderPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="stats" element={<StatsPage />} />

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
