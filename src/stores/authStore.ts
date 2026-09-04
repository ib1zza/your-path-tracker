import { create } from 'zustand';
import type { User } from 'firebase/auth';
import {
  isFirebaseConfigured,
  signInWithGoogle,
  signOutUser,
  subscribeToAuth,
} from '../lib/firebase/auth';
import {
  clearCloudSyncPending,
  isCloudSyncPending,
  subscribeCloudSyncPending,
} from '../lib/firebase/offlineQueue';
import { flushPendingCloudRoutes, syncRoutesForUser } from '../lib/firebase/syncRoutes';
import { useRouteStore } from './routeStore';

interface AuthState {
  user: User | null;
  isReady: boolean;
  isSyncing: boolean;
  syncStatus: string | null;
  lastSyncedAt: string | null;
  error: string | null;
  isConfigured: boolean;
  hasPendingSync: boolean;
  init: () => () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  flushPendingSync: () => Promise<void>;
}

async function runCloudSync(uid: string, onProgress: (message: string) => void): Promise<void> {
  const routes = await syncRoutesForUser(uid, onProgress);
  useRouteStore.getState().applyRoutes(routes);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isReady: !isFirebaseConfigured,
  isSyncing: false,
  syncStatus: null,
  lastSyncedAt: null,
  error: null,
  isConfigured: isFirebaseConfigured,
  hasPendingSync: isCloudSyncPending(),

  flushPendingSync: async () => {
    if (!get().user || get().isSyncing || !isCloudSyncPending()) {
      return;
    }

    set({ isSyncing: true, syncStatus: 'Uploading offline changes…', error: null });
    try {
      await flushPendingCloudRoutes();
      clearCloudSyncPending();
      set({ lastSyncedAt: new Date().toISOString(), hasPendingSync: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to upload offline changes.';
      set({ error: message });
    } finally {
      set({ isSyncing: false, syncStatus: null });
    }
  },

  init: () => {
    const unsubscribePending = subscribeCloudSyncPending((hasPendingSync) => {
      set({ hasPendingSync });
    });

    const onOnline = () => {
      void get().flushPendingSync();
    };
    window.addEventListener('online', onOnline);

    if (!isFirebaseConfigured) {
      void useRouteStore.getState().loadRoutes();
      return () => {
        unsubscribePending();
        window.removeEventListener('online', onOnline);
      };
    }

    const unsubscribeAuth = subscribeToAuth((user) => {
      set({ user, isReady: true, error: null });

      if (user) {
        set({ isSyncing: true, syncStatus: 'Starting sync…' });
        void (async () => {
          if (isCloudSyncPending()) {
            set({ syncStatus: 'Uploading offline changes…' });
            await flushPendingCloudRoutes();
            clearCloudSyncPending();
            set({ hasPendingSync: false });
          }
          await runCloudSync(user.uid, (syncStatus) => {
            set({ syncStatus });
          });
          set({ lastSyncedAt: new Date().toISOString() });
        })()
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : 'Failed to sync routes with cloud.';
            set({ error: message, syncStatus: null });
          })
          .finally(() => {
            set({ isSyncing: false, syncStatus: null });
          });
        return;
      }

      set({ syncStatus: null, isSyncing: false, lastSyncedAt: null });
      void useRouteStore.getState().loadRoutes();
    });

    return () => {
      unsubscribePending();
      unsubscribeAuth();
      window.removeEventListener('online', onOnline);
    };
  },

  signIn: async () => {
    set({ error: null });
    try {
      await signInWithGoogle();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Sign-in failed.';
      set({ error: message });
      throw error;
    }
  },

  signOut: async () => {
    set({ error: null, syncStatus: null, lastSyncedAt: null });
    await signOutUser();
    await useRouteStore.getState().loadRoutes();
  },

  syncNow: async () => {
    const user = get().user;
    if (!user || get().isSyncing) {
      return;
    }

    set({ isSyncing: true, syncStatus: 'Starting sync…', error: null });
    try {
      await runCloudSync(user.uid, (syncStatus) => {
        set({ syncStatus });
      });
      set({ lastSyncedAt: new Date().toISOString() });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sync routes with cloud.';
      set({ error: message });
      throw error;
    } finally {
      set({ isSyncing: false, syncStatus: null });
    }
  },
}));
