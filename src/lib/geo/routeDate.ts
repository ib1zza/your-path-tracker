import type { RouteFeature } from '../../types/route';

export type RouteGroupBy = 'none' | 'month' | 'year';

const NAME_DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;
const NAME_DATETIME_RE = /(\d{4})-(\d{2})-(\d{2})[_T ](\d{2})-(\d{2})-(\d{2})/;

function roundToMinuteIso(date: Date): string {
  const copy = new Date(date);
  copy.setSeconds(0, 0);
  return copy.toISOString();
}

function extractTimeFromLabel(label: string | undefined): string | undefined {
  if (!label) {
    return undefined;
  }

  const dateTimeMatch = label.match(NAME_DATETIME_RE);
  if (dateTimeMatch) {
    const [, year, month, day, hour, minute, second] = dateTimeMatch;
    const parsed = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    if (!Number.isNaN(parsed)) {
      return roundToMinuteIso(new Date(parsed));
    }
  }

  const dateMatch = label.match(NAME_DATE_RE);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    return roundToMinuteIso(new Date(`${year}-${month}-${day}T12:00:00`));
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

/** Best-effort activity date from GeoJSON/GPX properties or name. */
export function extractImportedCreatedAt(
  properties: Record<string, unknown> | null | undefined,
  fallbackName?: string,
): string | undefined {
  if (properties) {
    if (typeof properties.createdAt === 'string' && !Number.isNaN(Date.parse(properties.createdAt))) {
      return new Date(properties.createdAt).toISOString();
    }
    if (typeof properties.time === 'string' && !Number.isNaN(Date.parse(properties.time))) {
      return new Date(properties.time).toISOString();
    }

    const coordTimes = (properties.coordinateProperties as { times?: unknown } | undefined)?.times;
    const firstTime = firstTimeValue(coordTimes);
    if (firstTime && !Number.isNaN(Date.parse(firstTime))) {
      return new Date(firstTime).toISOString();
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
  const fromName = route.properties.name.match(NAME_DATE_RE);
  if (fromName) {
    return new Date(`${fromName[1]}-${fromName[2]}-${fromName[3]}T12:00:00`);
  }

  const parsed = Date.parse(route.properties.createdAt);
  return Number.isNaN(parsed) ? new Date() : new Date(parsed);
}

/** Start-time key (minute precision) for Apple Health import dedup. */
export function getRouteTimeKey(route: RouteFeature): string {
  const fromName = extractTimeFromLabel(route.properties.name);
  if (fromName) {
    return fromName;
  }

  const parsed = Date.parse(route.properties.createdAt);
  if (!Number.isNaN(parsed)) {
    return roundToMinuteIso(new Date(parsed));
  }

  return toDateInputValue(getRouteActivityDate(route));
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
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

export function groupRoutes(
  routes: RouteFeature[],
  groupBy: RouteGroupBy,
): RouteGroup[] {
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
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
