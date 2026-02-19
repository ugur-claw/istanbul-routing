const API_BASE = import.meta.env.VITE_API_URL || '';

export interface GeocodingResult {
  place_id: number;
  lat: number;
  lon: number;
  display_name: string;
  type: string;
  address: Record<string, string>;
}

export interface RouteStep {
  type: string;
  modifier: string | null;
  instruction: string;
  distance: number;
  duration: number;
  name: string;
  location: number[];
}

export interface RouteLeg {
  distance: number;
  duration: number;
  summary: string;
  steps: RouteStep[];
}

export interface RouteProperties {
  distance: number;
  duration: number;
  legs: RouteLeg[] | null;
}

export interface RouteFeature {
  type: string;
  properties: RouteProperties;
  geometry: {
    type: string;
    coordinates: number[][];
  };
}

export interface RouteResponse {
  routes: RouteFeature[];
  active_route_index: number;
}

export interface HealthStatus {
  status: string;
  osrm_services: Record<string, string>;
}

export async function fetchRoute(
  fromCoords: string,
  toCoords: string,
  profile: string = 'driving'
): Promise<RouteResponse> {
  const response = await fetch(
    `${API_BASE}/route?from_coords=${fromCoords}&to_coords=${toCoords}&profile=${profile}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Route calculation failed');
  }

  return response.json();
}

export async function geocodeAddress(query: string): Promise<GeocodingResult[]> {
  const response = await fetch(
    `${API_BASE}/geocode?q=${encodeURIComponent(query)}`
  );

  if (!response.ok) {
    throw new Error('Geocoding failed');
  }

  const data = await response.json();
  return data.results;
}

export async function checkHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE}/health`);

  if (!response.ok) {
    throw new Error('Health check failed');
  }

  return response.json();
}

// Map tile URLs - Carto
export const MAP_STYLES = {
  light: {
    version: 8,
    sources: {
      'carto-tiles': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }
    },
    layers: [
      {
        id: 'carto-tiles-layer',
        type: 'raster',
        source: 'carto-tiles',
        minzoom: 0,
        maxzoom: 19
      }
    ]
  },
  dark: {
    version: 8,
    sources: {
      'carto-tiles': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }
    },
    layers: [
      {
        id: 'carto-tiles-layer',
        type: 'raster',
        source: 'carto-tiles',
        minzoom: 0,
        maxzoom: 19
      }
    ]
  }
};
