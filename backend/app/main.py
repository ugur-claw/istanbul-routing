from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Istanbul Routing API",
    description="Production-grade routing API using OSRM",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration - Support multiple OSRM profiles
OSRM_URL_DRIVING = os.getenv("OSRM_URL_DRIVING", "http://localhost:5000")
OSRM_URL_FOOT = os.getenv("OSRM_URL_FOOT", "http://localhost:5001")
OSRM_URL_BIKE = os.getenv("OSRM_URL_BIKE", "http://localhost:5002")

PROFILE_URLS = {
    "driving": OSRM_URL_DRIVING,
    "foot": OSRM_URL_FOOT,
    "bike": OSRM_URL_BIKE
}

def get_osrm_url(profile: str = "driving") -> str:
    """Get OSRM URL based on profile"""
    return PROFILE_URLS.get(profile, OSRM_URL_DRIVING)

# Models for turn-by-turn navigation
class Maneuver(BaseModel):
    type: str
    modifier: Optional[str] = None
    instruction: str
    location: List[float]
    distance: float
    duration: float


class Leg(BaseModel):
    distance: float
    duration: float
    summary: str
    steps: List[Dict[str, Any]]


# GeoJSON response models
class RouteProperties(BaseModel):
    distance: float  # meters
    duration: float  # seconds
    legs: Optional[List[Leg]] = None


class Geometry(BaseModel):
    type: str = "LineString"
    coordinates: list


class RouteFeature(BaseModel):
    type: str = "Feature"
    properties: RouteProperties
    geometry: Geometry


class RouteResponse(BaseModel):
    routes: List[RouteFeature]
    active_route_index: int = 0


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    results = {}
    for profile, url in PROFILE_URLS.items():
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{url}/health", timeout=5.0)
                results[profile] = "healthy" if response.status_code == 200 else "unhealthy"
        except Exception as e:
            results[profile] = f"unavailable: {str(e)}"
    
    all_healthy = all(v == "healthy" for v in results.values())
    return {
        "status": "healthy" if all_healthy else "degraded",
        "osrm_services": results
    }


def parse_maneuver_type(maneuver: Dict, step_name: str = "") -> str:
    """Parse maneuver type to Turkish instruction"""
    maneuver_type = maneuver.get("type", "")
    modifier = maneuver.get("modifier", "")
    name = step_name  # Use step name which contains the actual road name

    # Turkish instructions based on maneuver type
    instructions = {
        "depart": "Başla",
        "arrive": "Varış noktasına ulaştınız",
        "turn": {
            "right": f"{name} yoluna sağa dön" if name else "sağa dön",
            "left": f"{name} yoluna sola dön" if name else "sola dön",
            "slight right": f"{name} yoluna hafif sağa dön" if name else "hafif sağa dön",
            "slight left": f"{name} yoluna hafif sola dön" if name else "hafif sola dön",
            "sharp right": f"{name} yoluna keskin sağa dön" if name else "keskin sağa dön",
            "sharp left": f"{name} yoluna keskin sola dön" if name else "keskin sola dön",
            "uturn": "U dönüşü yap"
        },
        "new name": f"{name} yoluna devam et" if name else "yola devam et",
        "depart": "Başla",
        "merge": f"{name} yoluna katıl" if name else "yola katıl",
        "on ramp": {
            "right": f"{name} rampasına sağ gir" if name else "rampaya sağ gir",
            "left": f"{name} rampasına sol gir" if name else "rampaya sol gir"
        },
        "off ramp": {
            "right": f"{name} çıkışından sağ çık" if name else "çıkışından sağ çık",
            "left": f"{name} çıkışından sol çık" if name else "çıkışından sol çık"
        },
        "fork": {
            "right": f"{name} yoluna sağ" if name else "sağa",
            "left": f"{name} yoluna sol" if name else "sola",
            "slight right": f"{name} yoluna hafif sağ" if name else "hafif sağa",
            "slight left": f"{name} yoluna hafif sol" if name else "hafif sola"
        },
        "end of road": {
            "right": f"{name} yoluna sağ" if name else "sağa",
            "left": f"{name} yoluna sol" if name else "sola"
        },
        "roundabout": "Döner kavşağa gir",
        "rotary": "Rotary'ye gir",
        "roundabout turn": {
            "right": "Döner kavşaktan sağ çık",
            "left": "Döner kavşaktan sol çık"
        },
        "notification": {
            "warning": f"{name} dikkat" if name else "dikkat",
            "info": f"{name}"
        }
    }
    
    if maneuver_type == "turn" and modifier:
        return instructions.get("turn", {}).get(modifier, f"{modifier} yönünde dön")
    elif maneuver_type == "on ramp" and modifier:
        return instructions.get("on ramp", {}).get(modifier, "Rampaya gir")
    elif maneuver_type == "off ramp" and modifier:
        return instructions.get("off ramp", {}).get(modifier, "Rampadan çık")
    elif maneuver_type == "fork" and modifier:
        return instructions.get("fork", {}).get(modifier, "Yol ayrımında")
    elif maneuver_type == "end of road" and modifier:
        return instructions.get("end of road", {}).get(modifier, "Yolun sonunda")
    elif maneuver_type == "roundabout turn" and modifier:
        return instructions.get("roundabout turn", {}).get(modifier, "Döner kavşaktan çık")
    elif maneuver_type in instructions:
        if isinstance(instructions[maneuver_type], dict):
            return instructions[maneuver_type].get("info", instructions[maneuver_type].get("warning", maneuver_type))
        return instructions[maneuver_type]
    
    return f"{maneuver_type}: {name}" if name else maneuver_type


def parse_osrm_route(osrm_route: Dict, include_steps: bool = True) -> RouteFeature:
    """Parse OSRM route response to our format"""
    distance = osrm_route["distance"]
    duration = osrm_route["duration"]
    geometry = osrm_route["geometry"]
    
    legs_data = []
    if include_steps and "legs" in osrm_route:
        for leg in osrm_route["legs"]:
            steps = []
            for step in leg.get("steps", []):
                maneuver = step.get("maneuver", {})
                step_name = step.get("name", "")
                instruction = parse_maneuver_type(maneuver, step_name)
                
                step_info = {
                    "type": maneuver.get("type", ""),
                    "modifier": maneuver.get("modifier"),
                    "instruction": instruction,
                    "distance": step.get("distance", 0),
                    "duration": step.get("duration", 0),
                    "name": step.get("name", ""),
                    "location": maneuver.get("location", [])
                }
                steps.append(step_info)
            
            legs_data.append({
                "distance": leg.get("distance", 0),
                "duration": leg.get("duration", 0),
                "summary": leg.get("summary", ""),
                "steps": steps
            })
    
    return RouteFeature(
        properties=RouteProperties(
            distance=distance,
            duration=duration,
            legs=legs_data if include_steps else None
        ),
        geometry=Geometry(
            type=geometry["type"],
            coordinates=geometry["coordinates"]
        )
    )


@app.get("/route", response_model=RouteResponse)
async def get_route(
    from_coords: str = Query(..., description="Origin coordinates as 'lon,lat'"),
    to_coords: str = Query(..., description="Destination coordinates as 'lon,lat'"),
    profile: str = Query("driving", description="Route profile: driving, foot, bike")
):
    """
    Calculate route between two points with multiple profiles support.
    
    Args:
        from_coords: Origin in format "lon,lat"
        to_coords: Destination in format "lon,lat"
        profile: Route profile (driving, foot, bike)
    
    Returns:
        GeoJSON FeatureCollection with routes, distance, duration, and turn-by-turn instructions
    """
    # Validate profile
    if profile not in PROFILE_URLS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid profile. Use: {', '.join(PROFILE_URLS.keys())}"
        )
    
    # Parse coordinates
    try:
        from_lon, from_lat = map(float, from_coords.split(','))
        to_lon, to_lat = map(float, to_coords.split(','))
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid coordinates. Use format 'lon,lat' (e.g., '29.0,41.0')"
        )
    
    # Validate coordinate ranges (Istanbul area)
    if not (28.0 <= from_lon <= 30.0 and 40.0 <= from_lat <= 42.0):
        raise HTTPException(
            status_code=400,
            detail="Origin coordinates outside Istanbul area"
        )
    if not (28.0 <= to_lon <= 30.0 and 40.0 <= to_lat <= 42.0):
        raise HTTPException(
            status_code=400,
            detail="Destination coordinates outside Istanbul area"
        )
    
    # Get OSRM URL for profile
    osrm_url = get_osrm_url(profile)
    
    # OSRM profile mapping
    osrm_profile = {
        "driving": "driving",
        "foot": "foot",
        "bike": "bike"
    }.get(profile, "driving")
    
    # Call OSRM API with steps and alternatives
    osrm_route_url = f"{osrm_url}/route/v1/{osrm_profile}/{from_lon},{from_lat};{to_lon},{to_lat}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "true",  # Enable turn-by-turn directions
        "annotations": "false",
        "alternatives": "true",  # Get alternative routes
        "continue_straight": "true"
    }
    
    logger.info(f"Fetching route ({profile}): {from_lon},{from_lat} -> {to_lon},{to_lat}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(osrm_route_url, params=params)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as e:
        logger.error(f"OSRM request failed: {e}")
        raise HTTPException(status_code=502, detail=f"Routing service error: {str(e)}")
    
    # Parse OSRM response
    routes = data.get("routes", [])
    if not routes:
        raise HTTPException(status_code=404, detail="No route found between points")
    
    # Convert all routes
    route_features = [parse_osrm_route(route, include_steps=True) for route in routes]
    
    logger.info(f"Found {len(route_features)} route(s) for profile {profile}")
    
    return RouteResponse(
        routes=route_features,
        active_route_index=0
    )


@app.get("/geocode")
async def geocode(
    q: str = Query(..., description="Address query")
):
    """
    Geocode address to coordinates using Nominatim.

    Args:
        q: Address query string

    Returns:
        List of matching locations with coordinates
    """
    nominatim_url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": f"{q}, İstanbul",
        "format": "json",
        "limit": 5,
        "addressdetails": 1,
        "accept-language": "tr",
        "countrycodes": "tr",
        "viewbox": "28.2,41.6,30.0,40.5",  # Istanbul bounding box
        "bounded": 1
    }

    headers = {
        "User-Agent": "IstanbulRouting/2.0"
    }

    logger.info(f"Geocoding: {q}")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(nominatim_url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as e:
        logger.error(f"Nominatim request failed: {e}")
        raise HTTPException(status_code=502, detail="Geocoding service error")
    
    # Format results
    results = []
    for item in data:
        results.append({
            "place_id": item.get("place_id"),
            "lat": float(item.get("lat", 0)),
            "lon": float(item.get("lon", 0)),
            "display_name": item.get("display_name"),
            "type": item.get("type"),
            "address": item.get("address", {})
        })
    
    return {"results": results}


@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "name": "Istanbul Routing API",
        "version": "2.0.0",
        "docs": "/docs",
        "endpoints": {
            "route": "/route?from_coords=lon,lat&to_coords=lon,lat&profile=driving",
            "geocode": "/geocode?q=address",
            "health": "/health"
        },
        "profiles": list(PROFILE_URLS.keys())
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
