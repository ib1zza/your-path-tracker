import type { RouteFeature } from '../../types/route';

export interface FirestoreRouteDocument {
  routeJson: string;
}

/** Firestore rejects undefined anywhere in a document; strip those fields. */
export function sanitizeForFirestore<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForFirestore(item)) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      result[key] = sanitizeForFirestore(entry);
    }
  }

  return result as T;
}

/** Encode a GeoJSON route for Firestore (no nested arrays / undefined). */
export function toFirestoreRoute(route: RouteFeature): FirestoreRouteDocument {
  return {
    routeJson: JSON.stringify(sanitizeForFirestore(route)),
  };
}

export function fromFirestoreRoute(data: unknown): RouteFeature | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;

  if (typeof record.routeJson === 'string') {
    try {
      return JSON.parse(record.routeJson) as RouteFeature;
    } catch {
      return null;
    }
  }

  // Backward compatibility if an older client wrote raw GeoJSON fields.
  if (record.type === 'Feature' && record.geometry && record.properties) {
    return data as RouteFeature;
  }

  return null;
}
