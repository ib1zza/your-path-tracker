import { useEffect, useState } from 'react';
import { ShortcutsList } from '../map/ShortcutsHelp';
import { useAuthStore } from '../../stores/authStore';
import { useDrawStore } from '../../stores/drawStore';
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
  const hasPendingSync = useAuthStore((state) => state.hasPendingSync);
  const flushPendingSync = useAuthStore((state) => state.flushPendingSync);
  const signIn = useAuthStore((state) => state.signIn);
  const signOut = useAuthStore((state) => state.signOut);
  const syncNow = useAuthStore((state) => state.syncNow);
  const removeDuplicateRoutes = useRouteStore((state) => state.removeDuplicateRoutes);
  const clearAllRoutes = useRouteStore((state) => state.clearAllRoutes);
  const routeCount = useRouteStore((state) => state.routes.length);
  const [isBusy, setIsBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const closeSettings = () => {
    if (isBusy) {
      return;
    }
    setSettingsOpen(false);
    setSettingsMessage(null);
    setConfirmClearAll(false);
  };

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) {
        setSettingsOpen(false);
        setSettingsMessage(null);
        setConfirmClearAll(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen, isBusy]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault();
        setSettingsOpen((open) => !open);
        setSettingsMessage(null);
        setConfirmClearAll(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (isConfigured && !isReady) {
    return <span className="auth-status">Loading account…</span>;
  }

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
      setSettingsOpen(false);
      setSettingsMessage(null);
      setConfirmClearAll(false);
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

  const handleClearAllData = async () => {
    setIsBusy(true);
    setSettingsMessage(null);
    try {
      await clearAllRoutes();
      useDrawStore.getState().cancel();
      setConfirmClearAll(false);
      setSettingsMessage(
        user
          ? 'All saved routes were deleted from this device and the cloud'
          : 'All saved routes were deleted',
      );
    } catch (clearError) {
      setSettingsMessage(
        clearError instanceof Error ? clearError.message : 'Failed to delete routes',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const label = user ? user.displayName || user.email || 'Signed in' : 'Sign in with Google';

  return (
    <div className="auth-control">
      {user && (
        <span className="auth-status" title={user.email ?? undefined}>
          {label}
          {isSyncing ? ` · ${syncStatus ?? 'syncing…'}` : ''}
          {!isSyncing && hasPendingSync ? ' · pending upload' : ''}
        </span>
      )}
      <button
        type="button"
        className="btn btn--ghost auth-btn"
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
        onClick={() => {
          setSettingsMessage(null);
          setConfirmClearAll(false);
          setSettingsOpen(true);
        }}
        disabled={isBusy || isSyncing}
      >
        Settings
      </button>
      {!user && isConfigured && (
        <button
          type="button"
          className="btn auth-btn auth-btn--google"
          onClick={() => void handleSignIn()}
          disabled={isBusy}
        >
          {isBusy ? 'Signing in…' : label}
        </button>
      )}
      {error && <span className="auth-error">{error}</span>}
      {settingsOpen && (
        <div
          className="modal-backdrop modal-backdrop--page"
          role="presentation"
          onClick={closeSettings}
        >
          <div
            className="modal settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="settings-title">Settings</h2>
            <div className="settings-modal__list">
              {user && (
                <>
                  <p className="settings-modal__meta">
                    {isSyncing
                      ? (syncStatus ?? 'Syncing…')
                      : hasPendingSync
                        ? 'Pending upload'
                        : lastSyncedAt
                          ? `Last synced ${formatLastSyncedAt(lastSyncedAt)}`
                          : 'Not synced yet'}
                  </p>
                  <button
                    type="button"
                    className="import-menu__item"
                    onClick={() => void handleSyncNow()}
                    disabled={isBusy || isSyncing}
                  >
                    <span>{isSyncing ? 'Syncing…' : 'Sync now'}</span>
                    <small>Upload and download routes from cloud</small>
                  </button>
                  {hasPendingSync && (
                    <button
                      type="button"
                      className="import-menu__item"
                      onClick={() => void flushPendingSync()}
                      disabled={isBusy || isSyncing}
                    >
                      <span>Upload pending changes</span>
                      <small>Send offline edits to the cloud</small>
                    </button>
                  )}
                  <button
                    type="button"
                    className="import-menu__item"
                    onClick={() => void handleSignOut()}
                    disabled={isBusy || isSyncing}
                  >
                    <span>Sign out</span>
                    <small>Keep local routes on this device</small>
                  </button>
                </>
              )}
              <button
                type="button"
                className="import-menu__item"
                onClick={() => void handleRemoveDuplicates()}
                disabled={isBusy || isSyncing || routeCount === 0}
              >
                <span>Delete duplicates</span>
                <small>Same start time or name and distance</small>
              </button>
              {confirmClearAll ? (
                <div className="settings-modal__confirm">
                  <p>
                    {user
                      ? 'This permanently deletes all saved routes on this device and in the cloud. Your account will not be deleted.'
                      : 'This permanently deletes all saved routes on this device.'}
                  </p>
                  <div className="modal__actions">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => setConfirmClearAll(false)}
                      disabled={isBusy}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger-solid"
                      onClick={() => void handleClearAllData()}
                      disabled={isBusy || isSyncing}
                    >
                      {isBusy ? 'Deleting…' : 'Delete all routes'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="import-menu__item settings-modal__danger"
                  onClick={() => {
                    setSettingsMessage(null);
                    setConfirmClearAll(true);
                  }}
                  disabled={isBusy || isSyncing || routeCount === 0}
                >
                  <span>Delete all my data</span>
                  <small>
                    {user
                      ? 'Remove saved routes here and in the cloud. Account stays.'
                      : 'Remove saved routes stored on this device.'}
                  </small>
                </button>
              )}
            </div>
            <section className="settings-modal__help">
              <h3>Keyboard shortcuts</h3>
              <ShortcutsList />
            </section>
            {settingsMessage && <p className="settings-modal__message">{settingsMessage}</p>}
            <div className="modal__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={closeSettings}
                disabled={isBusy}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
