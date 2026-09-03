export type GeoPermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported' | 'unknown';

export async function queryGeoPermission(): Promise<GeoPermissionState> {
  if (!('geolocation' in navigator)) {
    return 'unsupported';
  }

  if (!('permissions' in navigator) || !navigator.permissions?.query) {
    return 'unknown';
  }

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    if (status.state === 'granted' || status.state === 'prompt' || status.state === 'denied') {
      return status.state;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function requestGeoPermission(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported in this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  });
}

export function permissionErrorMessage(error: GeolocationPositionError | Error): string {
  if ('code' in error) {
    if (error.code === error.PERMISSION_DENIED) {
      return 'Location access denied. Allow it in browser settings and try again.';
    }
    if (error.code === error.POSITION_UNAVAILABLE) {
      return 'GPS signal unavailable. Move outdoors or wait a moment.';
    }
    if (error.code === error.TIMEOUT) {
      return 'GPS timed out. Check that location is enabled on the device.';
    }
  }
  return error.message || 'Failed to access location';
}

export async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  if (!('wakeLock' in navigator)) {
    return null;
  }
  try {
    return await navigator.wakeLock.request('screen');
  } catch {
    return null;
  }
}
