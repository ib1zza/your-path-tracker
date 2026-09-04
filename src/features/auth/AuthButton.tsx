import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useRouteStore } from '../../stores/routeStore';

function formatLastSyncedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuthButton() {
  const user = useAuthStore((state) => state.user);
  const isReady = useAuthStore((state) => state.isReady);
  const isSyncing = useAuthStore((state) => state.isSyncing);
  const syncStatus = useAuthStore((state) => state.syncStatus);
  const lastSyncedAt = useAuthStore((state) => state.lastSyncedAt);
  const error = useAuthStore((state) => state.error);
  const isConfigured = useAuthStore((state) => state.isConfigured);
  const signIn = useAuthStore((state) => state.signIn);
  const signOut = useAuthStore((state) => state.signOut);
  const syncNow = useAuthStore((state) => state.syncNow);
  const removeDuplicateRoutes = useRouteStore((state) => state.removeDuplicateRoutes);
  const routeCount = useRouteStore((state) => state.routes.length);
  const [isBusy, setIsBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  if (!isConfigured) {
    return null;
  }

  if (!isReady) {
    return <span className="auth-status">Loading account…</span>;
  }

  const closeSettings = () => {
    setSettingsOpen(false);
    setSettingsMessage(null);
  };

  const handleSignIn = async () => {
    setIsBusy(true);
    try {
      await signIn();
    } catch {
      // Error is stored in authStore.
    } finally {
      setIsBusy(false);
    }
  };

  const handleSignOut = async () => {
    setIsBusy(true);
    try {
      await signOut();
      closeSettings();
    } finally {
      setIsBusy(false);
    }
  };

  const handleSyncNow = async () => {
    setIsBusy(true);
    try {
      await syncNow();
    } catch {
      // Error is stored in authStore.
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveDuplicates = async () => {
    const confirmed = window.confirm(
      'Remove duplicate routes that share the same start time? The newest copy of each route is kept.',
    );
    if (!confirmed) {
      return;
    }

    setIsBusy(true);
    setSettingsMessage(null);
    try {
      const result = await removeDuplicateRoutes();
      setSettingsMessage(
        result.removed > 0
          ? `Removed ${result.removed} duplicate route${result.removed === 1 ? '' : 's'}`
          : 'No duplicate routes found',
      );
    } catch (removeError) {
      setSettingsMessage(
        removeError instanceof Error ? removeError.message : 'Failed to remove duplicates',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const label = user ? user.displayName || user.email || 'Signed in' : 'Sign in with Google';

  return (
    <div className="auth-control">
      {user ? (
        <>
          <span className="auth-status" title={user.email ?? undefined}>
            {label}
            {isSyncing ? ` · ${syncStatus ?? 'syncing…'}` : ''}
            {!isSyncing && lastSyncedAt ? ` · synced ${formatLastSyncedAt(lastSyncedAt)}` : ''}
          </span>
          <div className="import-menu">
            <button
              type="button"
              className="btn btn--ghost auth-btn"
              aria-expanded={settingsOpen}
              aria-haspopup="menu"
              onClick={() => setSettingsOpen((open) => !open)}
              disabled={isBusy || isSyncing}
            >
              Settings
            </button>
            {settingsOpen && (
              <>
                <button
                  type="button"
                  className="import-menu__backdrop"
                  aria-label="Close settings menu"
                  onClick={closeSettings}
                />
                <div className="import-menu__list settings-menu__list" role="menu">
                  <button
                    type="button"
                    className="import-menu__item"
                    role="menuitem"
                    onClick={() => void handleSyncNow()}
                    disabled={isBusy || isSyncing}
                  >
                    <span>{isSyncing ? 'Syncing…' : 'Sync now'}</span>
                    <small>Upload and download routes from cloud</small>
                  </button>
                  <button
                    type="button"
                    className="import-menu__item"
                    role="menuitem"
                    onClick={() => void handleSignOut()}
                    disabled={isBusy || isSyncing}
                  >
                    <span>Sign out</span>
                    <small>Keep local routes on this device</small>
                  </button>
                  <button
                    type="button"
                    className="import-menu__item"
                    role="menuitem"
                    onClick={() => void handleRemoveDuplicates()}
                    disabled={isBusy || isSyncing || routeCount === 0}
                  >
                    <span>Delete duplicates</span>
                    <small>Same start time or name and distance</small>
                  </button>
                  {settingsMessage && <p className="settings-menu__message">{settingsMessage}</p>}
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="import-menu">
            <button
              type="button"
              className="btn btn--ghost auth-btn"
              aria-expanded={settingsOpen}
              aria-haspopup="menu"
              onClick={() => setSettingsOpen((open) => !open)}
              disabled={isBusy}
            >
              Settings
            </button>
            {settingsOpen && (
              <>
                <button
                  type="button"
                  className="import-menu__backdrop"
                  aria-label="Close settings menu"
                  onClick={closeSettings}
                />
                <div className="import-menu__list settings-menu__list" role="menu">
                  <button
                    type="button"
                    className="import-menu__item"
                    role="menuitem"
                    onClick={() => void handleRemoveDuplicates()}
                    disabled={isBusy || routeCount === 0}
                  >
                    <span>Delete duplicates</span>
                    <small>Same start time or name and distance</small>
                  </button>
                  {settingsMessage && <p className="settings-menu__message">{settingsMessage}</p>}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            className="btn auth-btn auth-btn--google"
            onClick={() => void handleSignIn()}
            disabled={isBusy}
          >
            {isBusy ? 'Signing in…' : label}
          </button>
        </>
      )}
      {error && <span className="auth-error">{error}</span>}
    </div>
  );
}
