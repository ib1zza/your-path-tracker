import { centroid } from '@turf/turf';
import * as THREE from 'three';
import type { RouteFeature } from '../../types/route';

export function latLngToVector3(lng: number, lat: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);

  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export function routeToGlobePoints(route: RouteFeature, radius = 1.012): THREE.Vector3[] {
  return route.geometry.coordinates.map(([lng, lat]) => latLngToVector3(lng, lat, radius));
}

export function routeCentroid(route: RouteFeature): [number, number] | null {
  if (route.geometry.coordinates.length === 0) {
    return null;
  }

  const point = centroid(route);
  const [lng, lat] = point.geometry.coordinates;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return [lng, lat];
}

export function cameraDistanceForRoute(route: RouteFeature): number {
  const coords = route.geometry.coordinates;
  if (coords.length < 2) {
    return 1.08;
  }

  let minLng = coords[0][0];
  let maxLng = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  const spanDeg = Math.max(maxLng - minLng, maxLat - minLat);
  const spanKm = spanDeg * 111;
  const altitudeKm = Math.max(8, spanKm * 4);
  return 1 + altitudeKm / 6371;
}
