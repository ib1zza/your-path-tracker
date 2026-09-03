import { getCurrentUser } from '../firebase/auth';
import {
  deleteRoute as deleteLocalRoute,
  getAllRoutes,
  saveRoute,
  saveRoutes,
} from '../../db/routesDb';
import {
  deleteCloudRoute,
  fetchCloudRoutes,
  saveCloudRoute,
  saveCloudRoutes,
} from '../../db/routesFirestore';
import type { RouteFeature } from '../../types/route';

function routeUpdatedAt(route: RouteFeature): number {
  const value = Date.parse(route.properties.updatedAt || route.properties.createdAt);
  return Number.isNaN(value) ? 0 : value;
}

export function mergeRoutes(local: RouteFeature[], cloud: RouteFeature[]): RouteFeature[] {
  const merged = new Map<string, RouteFeature>();

  for (const route of [...local, ...cloud]) {
    const existing = merged.get(route.properties.id);
    if (!existing || routeUpdatedAt(route) >= routeUpdatedAt(existing)) {
      merged.set(route.properties.id, route);
    }
  }

  return [...merged.values()].sort(
    (a, b) => routeUpdatedAt(b) - routeUpdatedAt(a),
  );
}

export async function syncRoutesForUser(
  uid: string,
  onProgress?: (message: string) => void,
): Promise<RouteFeature[]> {
  onProgress?.('Reading local routes…');
  const local = await getAllRoutes();

  onProgress?.('Reading cloud backup…');
  const cloud = await fetchCloudRoutes(uid);

  onProgress?.('Merging routes…');
  const merged = mergeRoutes(local, cloud);

  const localMap = new Map(local.map((route) => [route.properties.id, route]));
  const cloudMap = new Map(cloud.map((route) => [route.properties.id, route]));

  const toLocal = merged.filter((route) => {
    const current = localMap.get(route.properties.id);
    return !current || routeUpdatedAt(route) > routeUpdatedAt(current);
  });

  const needsCloudUpload =
    cloud.length === 0 ||
    merged.length !== cloud.length ||
    merged.some((route) => {
      const current = cloudMap.get(route.properties.id);
      return !current || routeUpdatedAt(route) > routeUpdatedAt(current);
    });

  if (toLocal.length > 0) {
    onProgress?.(`Updating ${toLocal.length} local routes…`);
    await saveRoutes(toLocal);
  }

  if (needsCloudUpload) {
    onProgress?.(`Uploading ${merged.length} routes…`);
    await saveCloudRoutes(uid, merged);
  }

  onProgress?.('Sync complete');
  return merged;
}

export async function pushRouteToCloud(uid: string, route: RouteFeature): Promise<void> {
  await Promise.all([saveRoute(route), saveCloudRoute(uid, route)]);
}

export async function pushRoutesToCloud(uid: string, routes: RouteFeature[]): Promise<void> {
  await saveRoutes(routes);
  const cloud = await fetchCloudRoutes(uid);
  await saveCloudRoutes(uid, mergeRoutes(cloud, routes));
}

export async function removeRouteEverywhere(uid: string, routeId: string): Promise<void> {
  await Promise.all([deleteLocalRoute(routeId), deleteCloudRoute(uid, routeId)]);
}

function currentUid(): string | null {
  return getCurrentUser()?.uid ?? null;
}

export async function persistRoute(route: RouteFeature): Promise<void> {
  const uid = currentUid();
  if (uid) {
    await pushRouteToCloud(uid, route);
    return;
  }

  await saveRoute(route);
}

export async function persistRoutes(routes: RouteFeature[]): Promise<void> {
  const uid = currentUid();
  if (uid) {
    await pushRoutesToCloud(uid, routes);
    return;
  }

  await saveRoutes(routes);
}

export async function removeRoute(routeId: string): Promise<void> {
  const uid = currentUid();
  if (uid) {
    await removeRouteEverywhere(uid, routeId);
    return;
  }

  await deleteLocalRoute(routeId);
}
