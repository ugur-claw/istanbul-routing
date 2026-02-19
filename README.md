# Istanbul Routing

A production-grade routing system for Istanbul using OSRM with FastAPI backend and React frontend.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Docker](https://img.shields.io/badge/Docker-ready-blue)
![License](https://img.shields.io/badge/License-MIT-green)

**[Click here for the Detailed Setup Guide (SETUP.md)](SETUP.md)**

## Features

### Interactive Map
- Click-to-set origin and destination
- Real-time route calculation
- Responsive design

### Turn-by-Turn Navigation
- Step-by-step directions in Turkish
- Distance to each maneuver
- Maneuver icons

### Address Search
- Geocoding via Nominatim (OpenStreetMap)
- Search for any address in Istanbul
- Auto-complete suggestions

### Alternative Routes & Modes
- Multiple route options with visual comparisons
- **Araba** (Car) - Driving routes
- **Yaya** (Pedestrian) - Foot paths
- **Bisiklet** (Bike) - Bike-friendly routes

## Quick Start

### Prerequisites
- Docker & Docker Compose
- 4GB+ RAM
- `Istanbul.osm.pbf` file in the project root directory

### Installation & Run

1. Process the map data for all routing profiles (takes ~10-15 mins):
```bash
chmod +x osrm/process-data.sh
./osrm/process-data.sh

```

2. Start the services:

```bash
docker compose up -d

```

> ⚠️ For more detailed installation instructions, troubleshooting, and manual setup steps, please refer to the **[SETUP.md](SETUP.md)** file.

### Access

* **Frontend**: http://localhost:3000
* **API**: http://localhost:8000
* **API Docs**: http://localhost:8000/docs

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    MapLibre GL JS                        │   │
│  │  - Interactive map                                       │   │
│  │  - Route visualization                                    │   │
│  │  - Turn-by-turn display                                  │   │
│  │  - Geocoding search                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  - Route calculation                                     │   │
│  │  - Turn-by-turn parsing                                  │   │
│  │  - Geocoding proxy                                       │   │
│  │  - Multi-profile routing                                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP (OSRM Protocol)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OSRM (3 Instances)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│  │   Car    │  │   Walk   │  │   Bike   │                     │
│  │ Port 5000│  │ Port 5001│  │ Port 5002│                     │
│  └──────────┘  └──────────┘  └──────────┘                     │
└─────────────────────────────────────────────────────────────────┘

```

## Technology Stack

* **Frontend**: React 18, Vite, TypeScript, MapLibre GL JS
* **Backend**: Python 3.11, FastAPI, httpx
* **Routing**: OSRM (Open Source Routing Machine)
* **Geocoding**: Nominatim (OpenStreetMap)
* **Maps**: OpenStreetMap tiles

## License

MIT License
