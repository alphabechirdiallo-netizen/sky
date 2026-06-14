import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import SplashScreen from './components/SplashScreen';
import BottomNav from './components/BottomNav';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import UploadPage from './pages/UploadPage';
import ActivityPage from './pages/ActivityPage';
import ProfilePage from './pages/ProfilePage';
import AuthPage from './pages/AuthPage';
import './styles/global.css';

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/upload" element={user ? <UploadPage /> : <Navigate to="/auth" />} />
      <Route path="/activity" element={<ActivityPage />} />
      <Route path="/profile" element={<ProfilePage isOwn />} />
      <Route path="/user/:username" element={<ProfilePage />} />
      <Route path="/auth" element={user ? <Navigate to="/" /> : <AuthPage />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const AppLayout = () => {
  const { loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  if (!splashDone) {
    return <SplashScreen onComplete={() => setSplashDone(true)} />;
  }

  return (
    <>
      <AppRoutes />
      <BottomNav />
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
