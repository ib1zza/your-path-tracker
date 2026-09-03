import * as maplibregl from 'maplibre-gl';
import maplibreWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

maplibregl.setWorkerUrl(maplibreWorker);
