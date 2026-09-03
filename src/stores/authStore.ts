import { create } from 'zustand';
import type { User } from 'firebase/auth';
import {
  isFirebaseConfigured,
  signInWithGoogle,
  signOutUser,
  subscribeToAuth,
} from '../lib/firebase/auth';
import { syncRoutesForUser } from '../lib/firebase/syncRoutes';
import { useRouteStore } from './routeStore';

interface AuthState {
  user: User | null;
  isReady: boolean;
  isSyncing: boolean;
  syncStatus: string | null;
  error: string | null;
  isConfigured: boolean;
  init: () => () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isReady: !isFirebaseConfigured,
  isSyncing: false,
  syncStatus: null,
  error: null,
  isConfigured: isFirebaseConfigured,

  init: () => {
    if (!isFirebaseConfigured) {
      void useRouteStore.getState().loadRoutes();
      return () => {};
    }

    return subscribeToAuth((user) => {
      set({ user, isReady: true, error: null });

      if (user) {
        set({ isSyncing: true, syncStatus: 'Starting sync…' });
        void syncRoutesForUser(user.uid, (syncStatus) => {
          set({ syncStatus });
        })
          .then((routes) => {
            useRouteStore.getState().applyRoutes(routes);
          })
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

      set({ syncStatus: null, isSyncing: false });
      void useRouteStore.getState().loadRoutes();
    });
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
    set({ error: null, syncStatus: null });
    await signOutUser();
    await useRouteStore.getState().loadRoutes();
  },
}));
