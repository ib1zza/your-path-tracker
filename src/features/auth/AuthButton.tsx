import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

export function AuthButton() {
  const user = useAuthStore((state) => state.user);
  const isReady = useAuthStore((state) => state.isReady);
  const isSyncing = useAuthStore((state) => state.isSyncing);
  const syncStatus = useAuthStore((state) => state.syncStatus);
  const error = useAuthStore((state) => state.error);
  const isConfigured = useAuthStore((state) => state.isConfigured);
  const signIn = useAuthStore((state) => state.signIn);
  const signOut = useAuthStore((state) => state.signOut);
  const [isBusy, setIsBusy] = useState(false);

  if (!isConfigured) {
    return null;
  }

  if (!isReady) {
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
    } finally {
      setIsBusy(false);
    }
  };

  const label = user
    ? user.displayName || user.email || 'Signed in'
    : 'Sign in with Google';

  return (
    <div className="auth-control">
      {user ? (
        <>
          <span className="auth-status" title={user.email ?? undefined}>
            {label}
            {isSyncing ? ` · ${syncStatus ?? 'syncing…'}` : ''}
          </span>
          <button
            type="button"
            className="btn btn--ghost auth-btn"
            onClick={() => void handleSignOut()}
            disabled={isBusy || isSyncing}
          >
            Sign out
          </button>
        </>
      ) : (
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
    </div>
  );
}
