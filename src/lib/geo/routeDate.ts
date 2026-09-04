import type { RouteFeature } from '../../types/route';

export type RouteGroupBy = 'none' | 'month' | 'year';

/** `2024-03-15_07-32-00` or `2024-03-15 07:32:00` */
const NAME_DATETIME_RE =
  /(\d{4})-(\d{2})-(\d{2})[\s_T]+(\d{1,2})[-:](\d{2})(?:[-:](\d{2}))?\s*(am|pm)?/i;

/** Date only: `2024-03-15` */
const NAME_DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Round to minute in UTC for stable dedup keys across re-imports. */
export function roundToMinuteIso(date: Date): string {
  const copy = new Date(date);
  copy.setUTCSeconds(0, 0);
  return copy.toISOString();
}

function parseHourMinute(
  hour: string,
  minute: string,
  meridiem?: string,
): { hour: number; minute: number } | undefined {
  let h = Number.parseInt(hour, 10);
  const m = Number.parseInt(minute, 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return undefined;
  }

  if (meridiem) {
    const isPm = meridiem.toLowerCase() === 'pm';
    if (h === 12) {
      h = isPm ? 12 : 0;
    } else if (isPm) {
      h += 12;
    } else if (h > 12) {
      return { hour: h, minute: m };
    }
  }

  return { hour: h, minute: m };
}

/**
 * Parse wall-clock date/time from Health-style labels as UTC components.
 * Apple Health GPX names: `route_2024-03-15_7-32am`, `route_2024-07-17_10-30-00`.
 */
export function extractTimeFromLabel(label: string | undefined): string | undefined {
  if (!label) {
    return undefined;
  }

  const dateTimeMatch = label.match(NAME_DATETIME_RE);
  if (dateTimeMatch) {
    const [, year, month, day, hour, minute, second, meridiem] = dateTimeMatch;
    const parts = parseHourMinute(hour, minute, meridiem);
    if (parts) {
      const ss = second != null && second !== '' ? Number.parseInt(second, 10) : 0;
      const safeSecond = Number.isNaN(ss) ? 0 : Math.min(59, Math.max(0, ss));
      // Interpret filename clock as local wall time via Date constructor, then normalize to minute UTC.
      const local = new Date(
        Number.parseInt(year, 10),
        Number.parseInt(month, 10) - 1,
        Number.parseInt(day, 10),
        parts.hour,
        parts.minute,
        safeSecond,
      );
      if (!Number.isNaN(local.getTime())) {
        return roundToMinuteIso(local);
      }
    }
  }

  const dateMatch = label.match(NAME_DATE_RE);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    // Date-only: noon local — used for grouping, not strong dedup alone.
    const local = new Date(
      Number.parseInt(year, 10),
      Number.parseInt(month, 10) - 1,
      Number.parseInt(day, 10),
      12,
      0,
      0,
    );
    if (!Number.isNaN(local.getTime())) {
      return roundToMinuteIso(local);
    }
  }

  return undefined;
}

function firstTimeValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = firstTimeValue(item);
      if (nested) return nested;
    }
  }
  return undefined;
}

function hasClockInLabel(label: string | undefined): boolean {
  if (!label) return false;
  return NAME_DATETIME_RE.test(label);
}

/**
 * Best start instant for a route.
 * Prefer GPX/TCX track times and name clock; use createdAt when it encodes real activity time.
 */
export function getRouteStartInstant(route: RouteFeature): Date | undefined {
  const props = route.properties as unknown as Record<string, unknown>;

  const coordTimes = (props.coordinateProperties as { times?: unknown } | undefined)?.times;
  const firstCoordTime = firstTimeValue(coordTimes);
  if (firstCoordTime && !Number.isNaN(Date.parse(firstCoordTime))) {
    return new Date(firstCoordTime);
  }

  if (typeof props.time === 'string' && !Number.isNaN(Date.parse(props.time))) {
    return new Date(props.time);
  }

  const fromName = extractTimeFromLabel(route.properties.name);
  if (fromName && hasClockInLabel(route.properties.name)) {
    return new Date(fromName);
  }

  const createdAt = route.properties.createdAt;
  if (typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt))) {
    // If name has a clock that disagrees with createdAt by >36h, prefer name (import-time createdAt).
    if (fromName && hasClockInLabel(route.properties.name)) {
      const created = Date.parse(createdAt);
      const named = Date.parse(fromName);
      if (Math.abs(created - named) > 1000 * 60 * 60 * 36) {
        return new Date(fromName);
      }
    }
    return new Date(createdAt);
  }

  if (fromName) {
    return new Date(fromName);
  }

  return undefined;
}

/** Best-effort activity date from GeoJSON/GPX properties or name (for createdAt on import). */
export function extractImportedCreatedAt(
  properties: Record<string, unknown> | null | undefined,
  fallbackName?: string,
): string | undefined {
  if (properties) {
    const coordTimes = (properties.coordinateProperties as { times?: unknown } | undefined)?.times;
    const firstTime = firstTimeValue(coordTimes);
    if (firstTime && !Number.isNaN(Date.parse(firstTime))) {
      return new Date(firstTime).toISOString();
    }

    if (typeof properties.time === 'string' && !Number.isNaN(Date.parse(properties.time))) {
      return new Date(properties.time).toISOString();
    }

    if (
      typeof properties.createdAt === 'string' &&
      !Number.isNaN(Date.parse(properties.createdAt))
    ) {
      return new Date(properties.createdAt).toISOString();
    }
  }

  const name = typeof properties?.name === 'string' ? properties.name : undefined;
  const fromName = extractTimeFromLabel(name) ?? extractTimeFromLabel(fallbackName);
  if (fromName) {
    return fromName;
  }

  return undefined;
}

export function getRouteActivityDate(route: RouteFeature): Date {
  const start = getRouteStartInstant(route);
  if (start) {
    return start;
  }

  const fromName = route.properties.name.match(NAME_DATE_RE);
  if (fromName) {
    return new Date(
      Number.parseInt(fromName[1], 10),
      Number.parseInt(fromName[2], 10) - 1,
      Number.parseInt(fromName[3], 10),
      12,
      0,
      0,
    );
  }

  const parsed = Date.parse(route.properties.createdAt);
  return Number.isNaN(parsed) ? new Date() : new Date(parsed);
}

/** Activity start rounded to the minute (UTC), if known. */
export function getRouteTimeKey(route: RouteFeature): string | undefined {
  const start = getRouteStartInstant(route);
  if (!start) {
    return undefined;
  }
  return roundToMinuteIso(start);
}

/** Fallback: normalized name + distance bucket (~100 m). */
export function getRouteLooseDedupKey(route: RouteFeature): string {
  const name = route.properties.name.trim().toLowerCase().replace(/\s+/g, ' ');
  const dist = Math.round((route.properties.distanceMeters ?? 0) / 100);
  return `n:${name}|d${dist}`;
}

/** Geometry fingerprint: first/last point + length + distance. */
export function getRouteGeometryDedupKey(route: RouteFeature): string {
  const coords = route.geometry.coordinates;
  if (!coords || coords.length < 2) {
    return getRouteLooseDedupKey(route);
  }

  const first = coords[0];
  const last = coords[coords.length - 1];
  const dist = Math.round((route.properties.distanceMeters ?? 0) / 50);
  return `g:${first[0].toFixed(4)},${first[1].toFixed(4)}>${last[0].toFixed(4)},${last[1].toFixed(4)}|n${coords.length}|d${dist}`;
}

/** All keys used to detect duplicates (time preferred). */
export function getRouteDedupKeys(route: RouteFeature): string[] {
  const keys = new Set<string>();
  const props = route.properties as unknown as Record<string, unknown>;
  const hasTrackTime = Boolean(
    firstTimeValue((props.coordinateProperties as { times?: unknown } | undefined)?.times) ||
      (typeof props.time === 'string' && !Number.isNaN(Date.parse(props.time))),
  );

  // Prefer filename clock (Apple Health `route_YYYY-MM-DD_h-mmam`) as a stable key
  // independent of GPX timezone / import-time createdAt.
  if (hasClockInLabel(route.properties.name)) {
    const fromName = extractTimeFromLabel(route.properties.name);
    if (fromName) {
      keys.add(`t:${fromName}`);
    }
  }

  if (hasTrackTime) {
    const coordTimes = (props.coordinateProperties as { times?: unknown } | undefined)?.times;
    const firstTime = firstTimeValue(coordTimes);
    if (firstTime && !Number.isNaN(Date.parse(firstTime))) {
      keys.add(`t:${roundToMinuteIso(new Date(firstTime))}`);
    } else if (typeof props.time === 'string' && !Number.isNaN(Date.parse(props.time))) {
      keys.add(`t:${roundToMinuteIso(new Date(props.time))}`);
    }
  }

  if (keys.size === 0 && NAME_DATE_RE.test(route.properties.name)) {
    // Date-only: pair day with distance so same-day workouts don't collide.
    const dateOnly = extractTimeFromLabel(route.properties.name);
    if (dateOnly) {
      const dist = Math.round((route.properties.distanceMeters ?? 0) / 100);
      keys.add(`td:${dateOnly.slice(0, 10)}|d${dist}`);
    }
  }

  if (keys.size === 0) {
    const timeKey = getRouteTimeKey(route);
    if (timeKey) {
      keys.add(`t:${timeKey}`);
    }
  }

  keys.add(getRouteGeometryDedupKey(route));
  keys.add(getRouteLooseDedupKey(route));
  return [...keys];
}

export function findDuplicateRouteIds(routes: RouteFeature[]): string[] {
  const seen = new Map<string, string>();
  const duplicateIds: string[] = [];

  for (const route of routes) {
    const keys = getRouteDedupKeys(route);
    const matched = keys.find((key) => seen.has(key));
    if (matched) {
      duplicateIds.push(route.properties.id);
      continue;
    }

    for (const key of keys) {
      seen.set(key, route.properties.id);
    }
  }

  return duplicateIds;
}

/** Keep first occurrence of each dedup key; drop later duplicates. */
export function dedupeRoutes(routes: RouteFeature[]): {
  routes: RouteFeature[];
  removedIds: string[];
} {
  const seen = new Map<string, string>();
  const kept: RouteFeature[] = [];
  const removedIds: string[] = [];

  for (const route of routes) {
    const keys = getRouteDedupKeys(route);
    const matched = keys.find((key) => seen.has(key));
    if (matched) {
      removedIds.push(route.properties.id);
      continue;
    }

    kept.push(route);
    for (const key of keys) {
      seen.set(key, route.properties.id);
    }
  }

  return { routes: kept, removedIds };
}

/**
 * Find an existing route that matches incoming by id or dedup keys.
 */
export function findMatchingRoute(
  incoming: RouteFeature,
  existingById: Map<string, RouteFeature>,
  existingByKey: Map<string, RouteFeature>,
): RouteFeature | undefined {
  const byId = existingById.get(incoming.properties.id);
  if (byId) {
    return byId;
  }

  for (const key of getRouteDedupKeys(incoming)) {
    const match = existingByKey.get(key);
    if (match) {
      return match;
    }
  }

  return undefined;
}

export function indexRoutesForDedup(routes: RouteFeature[]): {
  byId: Map<string, RouteFeature>;
  byKey: Map<string, RouteFeature>;
} {
  const byId = new Map<string, RouteFeature>();
  const byKey = new Map<string, RouteFeature>();

  for (const route of routes) {
    byId.set(route.properties.id, route);
    for (const key of getRouteDedupKeys(route)) {
      if (!byKey.has(key)) {
        byKey.set(key, route);
      }
    }
  }

  return { byId, byKey };
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

export function filterRoutesByDateRange(
  routes: RouteFeature[],
  from: string | null,
  to: string | null,
): RouteFeature[] {
  if (!from && !to) {
    return routes;
  }

  const fromTime = from ? Date.parse(`${from}T00:00:00`) : Number.NEGATIVE_INFINITY;
  const toTime = to ? Date.parse(`${to}T23:59:59.999`) : Number.POSITIVE_INFINITY;

  return routes.filter((route) => {
    const time = getRouteActivityDate(route).getTime();
    return time >= fromTime && time <= toTime;
  });
}

export interface RouteGroup {
  key: string;
  label: string;
  routes: RouteFeature[];
}

function monthLabel(date: Date, locale = undefined): string {
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function groupRoutes(routes: RouteFeature[], groupBy: RouteGroupBy): RouteGroup[] {
  if (groupBy === 'none') {
    return [
      {
        key: 'all',
        label: 'All routes',
        routes: [...routes].sort(
          (a, b) => getRouteActivityDate(b).getTime() - getRouteActivityDate(a).getTime(),
        ),
      },
    ];
  }

  const buckets = new Map<string, RouteFeature[]>();

  for (const route of routes) {
    const date = getRouteActivityDate(route);
    const key =
      groupBy === 'year'
        ? String(date.getFullYear())
        : `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

    const list = buckets.get(key);
    if (list) {
      list.push(route);
    } else {
      buckets.set(key, [route]);
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, groupRoutesList]) => {
      const sample = getRouteActivityDate(groupRoutesList[0]);
      return {
        key,
        label: groupBy === 'year' ? key : monthLabel(sample),
        routes: groupRoutesList.sort(
          (a, b) => getRouteActivityDate(b).getTime() - getRouteActivityDate(a).getTime(),
        ),
      };
    });
}

export function groupKeyForRoute(route: RouteFeature, groupBy: RouteGroupBy): string {
  if (groupBy === 'none') return 'all';
  const date = getRouteActivityDate(route);
  if (groupBy === 'year') return String(date.getFullYear());
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}
