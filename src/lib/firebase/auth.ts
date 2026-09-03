import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './config';

const googleProvider = new GoogleAuthProvider();

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle(): Promise<User> {
  if (!auth) {
    throw new Error('Firebase is not configured. Add VITE_FIREBASE_* variables to .env.');
  }

  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  if (!auth) {
    return;
  }

  await signOut(auth);
}

export function getCurrentUser(): User | null {
  return auth?.currentUser ?? null;
}

export { isFirebaseConfigured };
