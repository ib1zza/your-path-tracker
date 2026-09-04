export interface PlaceSearchResult {
  id: string;
  label: string;
  longitude: number;
  latitude: number;
  bbox?: [number, number, number, number];
}

export interface ReverseGeocodeResult {
  placeName: string;
  city?: string;
  country?: string;
}

const NOMINATIM_HEADERS = {
  Accept: 'application/json',
};

function formatPlace(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(', ');
}

export async function searchPlaces(query: string, limit = 5): Promise<PlaceSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', trimmed);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!response.ok) {
    throw new Error('Place search failed');
  }

  const data = (await response.json()) as Array<{
    place_id: number;
    display_name: string;
    lon: string;
    lat: string;
    boundingbox?: [string, string, string, string];
  }>;

  return data.map((item) => ({
    id: String(item.place_id),
    label: item.display_name,
    longitude: Number(item.lon),
    latitude: Number(item.lat),
    bbox: item.boundingbox
      ? [
          Number(item.boundingbox[2]),
          Number(item.boundingbox[0]),
          Number(item.boundingbox[3]),
          Number(item.boundingbox[1]),
        ]
      : undefined,
  }));
}

export async function reverseGeocode(
  longitude: number,
  latitude: number,
): Promise<ReverseGeocodeResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'json');
  url.searchParams.set('zoom', '10');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    address?: {
      city?: string;
      town?: string;
      village?: string;
      municipality?: string;
      state?: string;
      country?: string;
    };
  };

  const address = data.address;
  if (!address) {
    return null;
  }

  const city =
    address.city || address.town || address.village || address.municipality || address.state;
  const country = address.country;
  if (!city && !country) {
    return null;
  }

  return {
    placeName: formatPlace([city, country]),
    city: city || undefined,
    country: country || undefined,
  };
}

const placeCache = new Map<string, string>();

/** ~1.1 km cell — enough to share one reverse lookup across nearby routes. */
export function placeCellKey(longitude: number, latitude: number): string {
  return `${longitude.toFixed(2)},${latitude.toFixed(2)}`;
}

export async function resolveRoutePlaceName(
  longitude: number,
  latitude: number,
): Promise<string | undefined> {
  const key = placeCellKey(longitude, latitude);
  const cached = placeCache.get(key);
  if (cached) {
    return cached;
  }

  const result = await reverseGeocode(longitude, latitude);
  if (!result?.placeName) {
    return undefined;
  }

  placeCache.set(key, result.placeName);
  return result.placeName;
}

/** Seed cache without a network call (e.g. after loading routes that already have placeName). */
export function rememberPlaceName(longitude: number, latitude: number, placeName: string): void {
  placeCache.set(placeCellKey(longitude, latitude), placeName);
}
