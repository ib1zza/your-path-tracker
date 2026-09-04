import type { Feature, FeatureCollection, LineString } from 'geojson';

export interface RouteProperties {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  color: string;
  notes?: string;
  placeName?: string;
  tags?: string[];
  source?: 'draw' | 'gps' | 'import';
  distanceMeters: number;
}

export type RouteFeature = Feature<LineString, RouteProperties>;
export type RouteCollection = FeatureCollection<LineString, RouteProperties>;

export const ROUTE_COLORS = [
  '#e53935',
  '#1e88e5',
  '#43a047',
  '#fb8c00',
  '#8e24aa',
  '#00acc1',
  '#6d4c41',
  '#d81b60',
] as const;

export function pickRouteColor(index: number): string {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
