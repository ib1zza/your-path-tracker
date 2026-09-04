import { Link, Outlet, useLocation } from 'react-router-dom';
import { AuthButton } from '../features/auth/AuthButton';
import { DrawToolbar, GpsStatusBadge } from '../features/map/DrawToolbar';
import { GpsResumePrompt } from '../features/map/GpsResumePrompt';
import { RoutePanel } from '../features/routes/RoutePanel';

export function Layout() {
  const location = useLocation();
  const isMapPage = location.pathname === '/';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <Link to="/">Path Tracker</Link>
        </div>
        {isMapPage && <DrawToolbar />}
        {isMapPage && <GpsStatusBadge />}
        <nav className="app-header__nav">
          <AuthButton />
          <Link
            to="/"
            className={location.pathname === '/' ? 'nav-link nav-link--active' : 'nav-link'}
          >
            Map
          </Link>
          <Link
            to="/globe"
            className={location.pathname === '/globe' ? 'nav-link nav-link--active' : 'nav-link'}
          >
            Globe
          </Link>
        </nav>
      </header>
      {isMapPage && <GpsResumePrompt />}
      <div className="app-body">
        {isMapPage && <RoutePanel />}
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
