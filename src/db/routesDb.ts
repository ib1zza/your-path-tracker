import Dexie, { type Table } from 'dexie';
import type { RouteFeature } from '../types/route';

class RoutesDatabase extends Dexie {
  routes!: Table<RouteFeature, string>;

  constructor() {
    super('PathTrackerDB');
    this.version(1).stores({
      routes: 'properties.id, properties.name, properties.createdAt',
    });
  }
}

export const db = new RoutesDatabase();

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
