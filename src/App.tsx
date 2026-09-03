import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { GlobePage } from './pages/GlobePage';
import { MapPage } from './pages/MapPage';
import { useAuthStore } from './stores/authStore';

function AppRoutes() {
  const initAuth = useAuthStore((state) => state.init);

  useEffect(() => {
    return initAuth();
  }, [initAuth]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<MapPage />} />
        <Route path="globe" element={<GlobePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
