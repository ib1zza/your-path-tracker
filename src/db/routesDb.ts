import Dexie, { type Table } from 'dexie';
import type { Position } from 'geojson';
import type { RouteFeature } from '../types/route';

export interface GpsDraft {
  id: string;
  points: Position[];
  startedAt: string;
  updatedAt: string;
  active: boolean;
  paused: boolean;
}

class RoutesDatabase extends Dexie {
  routes!: Table<RouteFeature, string>;
  gpsDraft!: Table<GpsDraft, string>;

  constructor() {
    super('PathTrackerDB');
    this.version(1).stores({
      routes: 'properties.id, properties.name, properties.createdAt',
    });
    this.version(2).stores({
      routes: 'properties.id, properties.name, properties.createdAt',
      gpsDraft: 'id',
    });
  }
}

export const db = new RoutesDatabase();

export const GPS_DRAFT_ID = 'current';

export async function getAllRoutes(): Promise<RouteFeature[]> {
  return db.routes.orderBy('properties.createdAt').reverse().toArray();
}

export async function saveRoute(route: RouteFeature): Promise<void> {
  await db.routes.put(route, route.properties.id);
}

export async function deleteRoute(id: string): Promise<void> {
  await db.routes.delete(id);
}

export async function saveRoutes(routes: RouteFeature[]): Promise<void> {
  await db.routes.bulkPut(routes);
}

export async function replaceAllRoutes(routes: RouteFeature[]): Promise<void> {
  await db.routes.clear();
  if (routes.length > 0) {
    await db.routes.bulkPut(routes);
  }
}

export async function getGpsDraft(): Promise<GpsDraft | undefined> {
  return db.gpsDraft.get(GPS_DRAFT_ID);
}

export async function saveGpsDraft(draft: Omit<GpsDraft, 'id'>): Promise<void> {
  await db.gpsDraft.put({ ...draft, id: GPS_DRAFT_ID });
}

export async function clearGpsDraft(): Promise<void> {
  await db.gpsDraft.delete(GPS_DRAFT_ID);
}
