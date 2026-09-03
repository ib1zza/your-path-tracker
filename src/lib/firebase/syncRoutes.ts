import { getCurrentUser } from '../firebase/auth';
import {
  deleteRoute as deleteLocalRoute,
  getAllRoutes,
  replaceAllRoutes,
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

function sortRoutes(routes: RouteFeature[]): RouteFeature[] {
  return [...routes].sort((a, b) => routeUpdatedAt(b) - routeUpdatedAt(a));
}

/** Overlay route updates onto an existing cloud snapshot. */
function applyRouteUpdates(base: RouteFeature[], updates: RouteFeature[]): RouteFeature[] {
  const merged = new Map(base.map((route) => [route.properties.id, route]));
  for (const route of updates) {
    merged.set(route.properties.id, route);
  }
  return sortRoutes([...merged.values()]);
}

/**
 * Firebase-first sync on sign-in:
 * - cloud has data → replace local cache with cloud
 * - cloud empty, local has data → bootstrap cloud from local
 * - both empty → nothing to do
 */
export async function syncRoutesForUser(
  uid: string,
  onProgress?: (message: string) => void,
): Promise<RouteFeature[]> {
  onProgress?.('Loading routes from cloud…');
  const cloud = await fetchCloudRoutes(uid);

  if (cloud.length > 0) {
    onProgress?.(`Applying ${cloud.length} routes from cloud…`);
    await replaceAllRoutes(cloud);
    onProgress?.('Sync complete');
    return sortRoutes(cloud);
  }

  onProgress?.('Cloud is empty, checking local cache…');
  const local = await getAllRoutes();

  if (local.length > 0) {
    onProgress?.(`Uploading ${local.length} local routes to cloud…`);
    await saveCloudRoutes(uid, local);
    onProgress?.('Sync complete');
    return sortRoutes(local);
  }

  onProgress?.('No routes yet');
  return [];
}

export async function loadRoutesForCurrentUser(): Promise<RouteFeature[]> {
  const uid = getCurrentUser()?.uid;
  if (!uid) {
    return getAllRoutes();
  }

  const cloud = await fetchCloudRoutes(uid);
  if (cloud.length > 0) {
    await replaceAllRoutes(cloud);
    return cloud;
  }

  return getAllRoutes();
}

async function mirrorCloudToLocal(uid: string): Promise<RouteFeature[]> {
  const cloud = await fetchCloudRoutes(uid);
  await replaceAllRoutes(cloud);
  return cloud;
}

export async function pushRouteToCloud(uid: string, route: RouteFeature): Promise<void> {
  await saveCloudRoute(uid, route);
  await saveRoute(route);
}

export async function pushRoutesToCloud(uid: string, routes: RouteFeature[]): Promise<void> {
  const cloud = await fetchCloudRoutes(uid);
  const next = applyRouteUpdates(cloud, routes);
  await saveCloudRoutes(uid, next);
  await replaceAllRoutes(next);
}

export async function removeRouteEverywhere(uid: string, routeId: string): Promise<void> {
  await deleteCloudRoute(uid, routeId);
  await deleteLocalRoute(routeId);
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

export async function refreshLocalFromCloud(uid: string): Promise<RouteFeature[]> {
  return mirrorCloudToLocal(uid);
}
