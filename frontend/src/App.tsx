import { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchRoute, geocodeAddress, MAP_STYLES, GeocodingResult, RouteFeature, RouteResponse } from './api/routes';

// Constants
const ISTANBUL_CENTER: [number, number] = [28.9784, 41.0082];
const DEFAULT_ZOOM = 12;

type Profile = 'driving' | 'foot' | 'bike';

interface Point {
  coords: [number, number];
  address?: string;
}

const PROFILES: { id: Profile; label: string; value: string }[] = [
  { id: 'driving', label: 'Drive', value: 'car' },
  { id: 'foot', label: 'Walk', value: 'foot' },
  { id: 'bike', label: 'Bike', value: 'bike' },
];

// Icons as SVG components
const LocationIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

const CarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" />
    <circle cx="17" cy="17" r="2" />
  </svg>
);

const FootIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 11 3.8 11 8c0 1.25-.38 2-1 2.72V16a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2z" />
    <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 13 7.8 13 12c0 1.25.38 2 1 2.72V20a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2z" />
  </svg>
);

const BikeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 11h4" />
    <path d="M15 11h4" />
    <path d="M5 11c-1.1 0-2-.9-2-2s.9-2 2-2h4" />
    <path d="M17 14l3-3-3-3" />
    <circle cx="17" cy="14" r="3" />
    <circle cx="7" cy="14" r="3" />
  </svg>
);

const RouteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h4l3-9 4 18 3-9h4" />
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="spinner-icon">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const originRef = useRef<[number, number] | null>(null);
  const destinationRef = useRef<[number, number] | null>(null);
  const isClickingRef = useRef(false);

  // UI State
  const [darkMode, setDarkMode] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);

  // Data State
  const [origin, setOrigin] = useState<Point | null>(null);
  const [destination, setDestination] = useState<Point | null>(null);
  const [originMarker, setOriginMarker] = useState<maplibregl.Marker | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<maplibregl.Marker | null>(null);
  const [directionMarkers, setDirectionMarkers] = useState<maplibregl.Marker[]>([]);
  const [routes, setRoutes] = useState<RouteFeature[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeInput, setActiveInput] = useState<'origin' | 'destination' | null>(null);

  // Sync refs
  useEffect(() => {
    originRef.current = origin?.coords || null;
  }, [origin]);

  useEffect(() => {
    destinationRef.current = destination?.coords || null;
  }, [destination]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: darkMode ? MAP_STYLES.dark : MAP_STYLES.light,
      center: ISTANBUL_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: true,
    });

    map.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update map style
  useEffect(() => {
    if (!map.current) return;

    const currentRoutes = routes;
    const currentActiveIndex = activeRouteIndex;

    map.current.setStyle(darkMode ? MAP_STYLES.dark : MAP_STYLES.light, { diff: false });

    map.current.once('style.load', () => {
      if (currentRoutes.length > 0) {
        drawRoutes(currentRoutes, currentActiveIndex);
      }
    });
  }, [darkMode]);

  // Search with debounce
  useEffect(() => {
    const searchAddress = async () => {
      if (searchQuery.length < 3 || !activeInput) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await geocodeAddress(searchQuery);
        setSearchResults(results);
        setShowSearchResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchAddress, 400);
    return () => clearTimeout(debounce);
  }, [searchQuery, activeInput]);

  const handleMapClick = useCallback(async (e: maplibregl.MapMouseEvent) => {
    if (isClickingRef.current || isCalculating) return;
    isClickingRef.current = true;

    const { lng, lat } = e.lngLat;
    const coords: [number, number] = [lng, lat];

    try {
      // If both points are already selected, reset and start new
      if (originRef.current && destinationRef.current) {
        clearRoute();
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      if (!originRef.current) {
        // Set origin (A)
        originRef.current = coords;
        setOrigin({ coords, address: 'Selected on map' });
        createMarker(coords, 'origin');
        setStatusMessage('Select destination point');
      } else if (!destinationRef.current) {
        // Set destination (B) - don't calculate yet, wait for profile selection
        destinationRef.current = coords;
        setDestination({ coords, address: 'Selected on map' });
        createMarker(coords, 'destination');
        setStatusMessage('Select a travel mode to calculate route');
      }
    } finally {
      isClickingRef.current = false;
    }
  }, [profile, isCalculating]);

  // Add click handler after map is loaded
  useEffect(() => {
    if (!map.current) return;

    const handleStyleLoad = () => {
      map.current?.on('click', handleMapClick);
    };

    if (map.current.loaded()) {
      handleStyleLoad();
    } else {
      map.current.on('load', handleStyleLoad);
    }

    return () => {
      map.current?.off('click', handleMapClick);
    };
  }, [handleMapClick]);

  const createMarker = (coords: [number, number], type: 'origin' | 'destination') => {
    if (!map.current) return;

    const el = document.createElement('div');
    el.className = `custom-marker ${type}`;

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(coords)
      .addTo(map.current);

    if (type === 'origin') {
      originMarker?.remove();
      setOriginMarker(marker);
    } else {
      destinationMarker?.remove();
      setDestinationMarker(marker);
    }
  };

  const calculateRoute = async () => {
    if (!origin || !destination) return;

    const activeProfile = profile || 'driving';
    setIsCalculating(true);
    setStatusMessage('Calculating route...');

    try {
      const fromStr = `${origin.coords[0]},${origin.coords[1]}`;
      const toStr = `${destination.coords[0]},${destination.coords[1]}`;

      const data: RouteResponse = await fetchRoute(fromStr, toStr, activeProfile);

      setRoutes(data.routes);
      setActiveRouteIndex(data.active_route_index);
      drawRoutes(data.routes, data.active_route_index);

      const activeRoute = data.routes[data.active_route_index];
      setStatusMessage(`${formatDistance(activeRoute.properties.distance)} - ${formatDuration(activeRoute.properties.duration)}`);
      setShowRoutePanel(true);

      fitMapToRoute(activeRoute.geometry.coordinates);
    } catch (error) {
      console.error('Route error:', error);
      setStatusMessage(error instanceof Error ? error.message : 'Route calculation failed');
    } finally {
      setIsCalculating(false);
    }
  };

  const drawRoutes = (routes: RouteFeature[], activeIndex: number) => {
    if (!map.current) return;

    // Clear existing routes
    for (let i = 0; i < 10; i++) {
      if (map.current.getLayer(`route-${i}`)) map.current.removeLayer(`route-${i}`);
      if (map.current.getSource(`route-${i}`)) map.current.removeSource(`route-${i}`);
    }

    // Clear existing direction markers
    directionMarkers.forEach(marker => marker.remove());
    setDirectionMarkers([]);

    routes.forEach((route, index) => {
      const isActive = index === activeIndex;
      const color = isActive ? '#FF6B35' : 'rgba(128, 128, 128, 0.5)';
      const width = isActive ? 6 : 4;
      const opacity = isActive ? 1 : 0.5;

      map.current?.addSource(`route-${index}`, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: route.geometry,
        },
      });

      map.current?.addLayer({
        id: `route-${index}`,
        type: 'line',
        source: `route-${index}`,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': color,
          'line-width': width,
          'line-opacity': opacity,
        },
      });

      // Add direction markers for active route
      if (isActive && route.properties.legs) {
        route.properties.legs.forEach(leg => {
          leg.steps.forEach((step, stepIndex) => {
            if (step.location && step.location.length === 2) {
              const el = document.createElement('div');
              el.className = 'direction-marker';
              el.title = step.instruction;

              const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat(step.location as [number, number])
                .addTo(map.current!);

              setDirectionMarkers(prev => [...prev, marker]);
            }
          });
        });
      }
    });
  };

  const selectAlternativeRoute = (index: number) => {
    setActiveRouteIndex(index);
    if (routes.length > 0) {
      drawRoutes(routes, index);
      fitMapToRoute(routes[index].geometry.coordinates);
    }
  };

  const fitMapToRoute = (coordinates: number[][]) => {
    if (!map.current || coordinates.length === 0) return;

    const bounds = coordinates.reduce(
      (bounds, coord) => bounds.extend(coord as [number, number]),
      new maplibregl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number])
    );

    map.current.fitBounds(bounds, { padding: 100, maxZoom: 15, duration: 1000 });
  };

  const clearRoute = () => {
    originMarker?.remove();
    destinationMarker?.remove();
    setOriginMarker(null);
    setDestinationMarker(null);

    // Clear direction markers
    directionMarkers.forEach(marker => marker.remove());
    setDirectionMarkers([]);

    if (map.current) {
      for (let i = 0; i < 10; i++) {
        if (map.current.getLayer(`route-${i}`)) map.current.removeLayer(`route-${i}`);
        if (map.current.getSource(`route-${i}`)) map.current.removeSource(`route-${i}`);
      }
    }

    setOrigin(null);
    setDestination(null);
    setRoutes([]);
    setActiveRouteIndex(0);
    originRef.current = null;
    destinationRef.current = null;
    setStatusMessage('');
    setShowRoutePanel(false);
    setPanelExpanded(false);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setActiveInput(null);
  };

  const handleSearchSelect = async (result: GeocodingResult) => {
    const coords: [number, number] = [result.lon, result.lat];
    const address = result.display_name.split(',').slice(0, 3).join(',');

    if (!origin) {
      setOrigin({ coords, address });
      createMarker(coords, 'origin');
      setStatusMessage('Select destination point');
      map.current?.flyTo({ center: coords, zoom: 14, duration: 800 });
    } else if (!destination) {
      setDestination({ coords, address });
      createMarker(coords, 'destination');
      setStatusMessage('Select a travel mode to calculate route');
    } else {
      clearRoute();
      setOrigin({ coords, address });
      createMarker(coords, 'origin');
      setStatusMessage('Select destination point');
      map.current?.flyTo({ center: coords, zoom: 14, duration: 800 });
    }

    setSearchQuery('');
    setShowSearchResults(false);
    setSearchResults([]);
    setActiveInput(null);
  };

  const handleProfileChange = async (newProfile: Profile) => {
    setProfile(newProfile);
    if (origin && destination) {
      await calculateRoute();
    }
  };

  // Auto-select default profile and calculate route when both points are selected
  useEffect(() => {
    if (origin && destination && !profile) {
      setProfile('driving');
      calculateRoute();
    }
  }, [origin, destination]);

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getProfileIcon = (id: Profile | null) => {
    switch (id) {
      case 'driving': return <CarIcon />;
      case 'foot': return <FootIcon />;
      case 'bike': return <BikeIcon />;
      default: return <CarIcon />;
    }
  };

  const activeRoute = routes[activeRouteIndex];
  const activeLeg = activeRoute?.properties.legs?.[0];
  const mainRoute = routes[0];

  // Calculate differences for alternatives
  const getRouteDiff = (route: RouteFeature, index: number) => {
    if (index === 0 || !mainRoute) return null;
    const distanceDiff = route.properties.distance - mainRoute.properties.distance;
    const durationDiff = route.properties.duration - mainRoute.properties.duration;
    return { distanceDiff, durationDiff };
  };

  return (
    <div className={`app-container ${darkMode ? 'dark' : ''}`}>
      {/* Top Search Bar */}
      <div className={`search-bar ${showRoutePanel && window.innerWidth >= 768 ? 'with-panel' : ''}`}>
        {/* Left: Profile Selector */}
        <div className="search-bar-left">
          <div className="profile-selector-horizontal">
            {PROFILES.map((p) => (
              <button
                key={p.id}
                className={`profile-btn-horizontal ${profile === p.id ? 'active' : ''} ${origin && destination ? '' : 'disabled'}`}
                onClick={() => handleProfileChange(p.id)}
                title={p.label}
                disabled={!origin || !destination}
              >
                {getProfileIcon(p.id)}
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Center: Origin & Destination Inputs */}
        <div className="search-bar-center">
          <div className="search-bar-inner">
            {/* Origin Input */}
            <div
              className={`search-input-group origin ${origin ? 'has-value' : ''} ${activeInput === 'origin' ? 'active' : ''}`}
              onClick={() => setActiveInput('origin')}
            >
              <div className="input-line origin-line" />
              <div className="input-icon">
                <div className="dot origin-dot" />
              </div>
              <input
                type="text"
                placeholder="Starting point"
                value={activeInput === 'origin' ? searchQuery : (origin?.address || '')}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveInput('origin');
                }}
                onFocus={() => setActiveInput('origin')}
                readOnly={activeInput !== 'origin'}
              />
              {isSearching && activeInput === 'origin' && (
                <div className="input-spinner">
                  <SpinnerIcon />
                </div>
              )}
              {origin && (
                <button className="clear-input" onClick={(e) => { e.stopPropagation(); setOrigin(null); originMarker?.remove(); setOriginMarker(null); originRef.current = null; setStatusMessage('Select destination point'); }}>
                  <CloseIcon />
                </button>
              )}
            </div>

            {/* Destination Input */}
            <div
              className={`search-input-group destination ${destination ? 'has-value' : ''} ${activeInput === 'destination' ? 'active' : ''}`}
              onClick={() => setActiveInput('destination')}
            >
              <div className="input-line destination-line" />
              <div className="input-icon">
                <div className="dot destination-dot" />
              </div>
              <input
                type="text"
                placeholder="Destination"
                value={activeInput === 'destination' ? searchQuery : (destination?.address || '')}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveInput('destination');
                }}
                onFocus={() => setActiveInput('destination')}
                readOnly={activeInput !== 'destination'}
              />
              {isSearching && activeInput === 'destination' && (
                <div className="input-spinner">
                  <SpinnerIcon />
                </div>
              )}
              {destination && (
                <button className="clear-input" onClick={(e) => { e.stopPropagation(); setDestination(null); destinationMarker?.remove(); setDestinationMarker(null); destinationRef.current = null; setStatusMessage('Select destination point'); }}>
                  <CloseIcon />
                </button>
              )}
            </div>
          </div>

          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="search-results-dropdown">
              {searchResults.map((result) => (
                <div
                  key={result.place_id}
                  className="search-result-item"
                  onClick={() => handleSearchSelect(result)}
                >
                  <LocationIcon />
                  <span>{result.display_name.split(',').slice(0, 3).join(',')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Theme Toggle - Fixed Top Right */}
      <button
        className="theme-toggle-fixed"
        onClick={() => setDarkMode(!darkMode)}
        title={darkMode ? 'Light mode' : 'Dark mode'}
      >
        {darkMode ? <SunIcon /> : <MoonIcon />}
      </button>

      {/* Status Message */}
      {statusMessage && (
        <div className={`status-toast ${isCalculating ? 'calculating' : ''}`}>
          {isCalculating && <SpinnerIcon />}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Route Panel */}
      {showRoutePanel && activeRoute && (
        <div className={`route-panel ${panelExpanded ? 'expanded' : ''}`}>
          <div
            className="panel-handle"
            onClick={() => setPanelExpanded(!panelExpanded)}
          >
            <div className="handle-bar" />
          </div>

          <div className="panel-content">
            {/* Route Summary */}
            <div className="route-summary">
              <div className="summary-item">
                <RouteIcon />
                <span className="summary-value">{formatDistance(activeRoute.properties.distance)}</span>
              </div>
              <div className="summary-divider" />
              <div className="summary-item">
                <ClockIcon />
                <span className="summary-value">{formatDuration(activeRoute.properties.duration)}</span>
              </div>
            </div>

            {/* Alternative Routes */}
            {routes.length > 1 && (
              <div className="alternatives-section">
                <div className="alternatives-header">
                  <span>{routes.length} routes available</span>
                </div>
                <div className="alternatives-list">
                  {routes.map((route, index) => {
                    const diff = getRouteDiff(route, index);
                    return (
                      <button
                        key={index}
                        className={`alternative-card ${index === activeRouteIndex ? 'active' : ''}`}
                        onClick={() => selectAlternativeRoute(index)}
                      >
                        <div className="alt-info">
                          <span className="alt-index">{index === 0 ? 'Fastest Route' : `Alternative ${index}`}</span>
                          <span className="alt-details">
                            {formatDistance(route.properties.distance)} - {formatDuration(route.properties.duration)}
                            {diff && diff.distanceDiff > 0 && (
                              <span className="alt-diff">
                                (+{formatDistance(diff.distanceDiff)}, +{formatDuration(diff.durationDiff)})
                              </span>
                            )}
                          </span>
                        </div>
                        {index === activeRouteIndex && <div className="active-indicator" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Turn by Turn */}
            {panelExpanded && activeLeg && activeLeg.steps.length > 0 && (
              <div className="directions-section">
                <h3>Directions</h3>
                <div className="directions-list">
                  {activeLeg.steps.map((step, index) => (
                    <div key={index} className="direction-item">
                      <div className="direction-line">
                        <div className="direction-dot" />
                        {index < activeLeg.steps.length - 1 && <div className="direction-connector" />}
                      </div>
                      <div className="direction-content">
                        <p className="direction-instruction">{step.instruction}</p>
                        <p className="direction-meta">
                          {step.name && <span className="direction-street">{step.name}</span>}
                          <span className="direction-distance">{formatDistance(step.distance)}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expand/Collapse Button */}
            {!panelExpanded && activeLeg && activeLeg.steps.length > 0 && (
              <button
                className="expand-btn"
                onClick={() => setPanelExpanded(true)}
              >
                Show directions
                <ArrowRightIcon />
              </button>
            )}
          </div>

          {/* Clear Route Button */}
          <button className="clear-route-btn" onClick={clearRoute}>
            Clear route
          </button>
        </div>
      )}

      {/* Map */}
      <div className="map-wrapper">
        <div ref={mapContainer} id="map" />
      </div>

      {/* Instructions Overlay */}
      {!origin && (
        <div className="instructions-overlay">
          <p>Click on map to set starting point</p>
        </div>
      )}
      {origin && !destination && (
        <div className="instructions-overlay">
          <p>Click to set destination point</p>
        </div>
      )}
    </div>
  );
}

export default App;
