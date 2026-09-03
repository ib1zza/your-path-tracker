import { Link, Outlet, useLocation } from 'react-router-dom';
import { DrawToolbar } from '../features/map/DrawToolbar';
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
        <nav className="app-header__nav">
          <Link to="/" className={location.pathname === '/' ? 'nav-link nav-link--active' : 'nav-link'}>
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
      <div className="app-body">
        {isMapPage && <RoutePanel />}
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
