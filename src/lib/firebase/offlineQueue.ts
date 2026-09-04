const STORAGE_KEY = 'path-tracker-pending-cloud-sync';

type PendingListener = (pending: boolean) => void;

const listeners = new Set<PendingListener>();

function readPending(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function notify(pending: boolean): void {
  for (const listener of listeners) {
    listener(pending);
  }
}

export function isCloudSyncPending(): boolean {
  return readPending();
}

export function markCloudSyncPending(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Private mode may block storage.
  }
  notify(true);
}

export function clearCloudSyncPending(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notify(false);
}

export function subscribeCloudSyncPending(listener: PendingListener): () => void {
  listeners.add(listener);
  listener(readPending());
  return () => {
    listeners.delete(listener);
  };
}

export function isLikelyOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('failed to fetch') ||
    message.includes('unavailable')
  );
}
