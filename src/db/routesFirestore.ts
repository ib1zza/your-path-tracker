import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { fromFirestoreRoute, sanitizeForFirestore } from '../lib/firebase/sanitizeForFirestore';
import type { RouteFeature } from '../types/route';

const SYNC_DOC_ID = 'routes';

interface CloudRoutesDocument {
  routesJson: string;
  updatedAt: string;
  routeCount: number;
}

function syncDoc(uid: string) {
  if (!db) {
    throw new Error('Firestore is not configured.');
  }

  return doc(db, 'users', uid, 'sync', SYNC_DOC_ID);
}

function encodeRoutes(routes: RouteFeature[]): CloudRoutesDocument {
  const cleaned = sanitizeForFirestore(routes);
  const updatedAt = routes.reduce((latest, route) => {
    const value = route.properties.updatedAt || route.properties.createdAt;
    return value > latest ? value : latest;
  }, '1970-01-01T00:00:00.000Z');

  return {
    routesJson: JSON.stringify(cleaned),
    updatedAt,
    routeCount: routes.length,
  };
}

function decodeRoutes(data: unknown): RouteFeature[] {
  if (!data || typeof data !== 'object') {
    return [];
  }

  const record = data as Record<string, unknown>;

  if (typeof record.routesJson === 'string') {
    try {
      const parsed = JSON.parse(record.routesJson) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed as RouteFeature[];
    } catch {
      return [];
    }
  }

  // Legacy single-route docs: { routeJson: "..." } or raw GeoJSON feature.
  if (typeof record.routeJson === 'string') {
    const legacy = fromFirestoreRoute(data);
    return legacy ? [legacy] : [];
  }

  const legacy = fromFirestoreRoute(data);
  return legacy ? [legacy] : [];
}

export async function fetchCloudRoutes(uid: string): Promise<RouteFeature[]> {
  const snapshot = await getDoc(syncDoc(uid));
  if (!snapshot.exists()) {
    return [];
  }

  return decodeRoutes(snapshot.data());
}

export async function saveCloudRoutes(uid: string, routes: RouteFeature[]): Promise<void> {
  await setDoc(syncDoc(uid), encodeRoutes(routes));
}

export async function saveCloudRoute(uid: string, route: RouteFeature): Promise<void> {
  const existing = await fetchCloudRoutes(uid);
  const index = existing.findIndex((item) => item.properties.id === route.properties.id);
  const next =
    index >= 0
      ? existing.map((item, itemIndex) => (itemIndex === index ? route : item))
      : [route, ...existing];

  await saveCloudRoutes(uid, next);
}

export async function deleteCloudRoute(uid: string, routeId: string): Promise<void> {
  const existing = await fetchCloudRoutes(uid);
  const next = existing.filter((route) => route.properties.id !== routeId);
  if (next.length === existing.length) {
    return;
  }

  await saveCloudRoutes(uid, next);
}
