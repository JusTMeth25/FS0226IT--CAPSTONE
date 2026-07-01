import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';
import AdminRoute from './components/common/AdminRoute.jsx';

import HomePage from './pages/HomePage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import PackOpeningPage from './pages/PackOpeningPage.jsx';
import CollectionPage from './pages/CollectionPage.jsx';
import CardDetailPage from './pages/CardDetailPage.jsx';
import AlbumPage from './pages/AlbumPage.jsx';
import MarketplacePage from './pages/MarketplacePage.jsx';
import TradesPage from './pages/TradesPage.jsx';
import MissionsPage from './pages/MissionsPage.jsx';
import EventsPage from './pages/EventsPage.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import BattlePage from './pages/BattlePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<HomePage />} />
        <Route path="login" element={<AuthPage />} />
        <Route path="register" element={<AuthPage />} />
        <Route path="packs" element={<PackOpeningPage />} />
        <Route path="collection" element={<CollectionPage />} />
        <Route path="card/:id" element={<CardDetailPage />} />
        <Route path="album" element={<AlbumPage />} />
        <Route path="marketplace" element={<MarketplacePage />} />
        <Route path="missions" element={<MissionsPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="battle" element={<BattlePage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="trades" element={<TradesPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="admin" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
