# Istanbul Routing - Setup Guide

## Overview

Istanbul Routing is a production-grade routing system using OSRM with Istanbul road network data. This guide covers setup for all features including turn-by-turn navigation, geocoding, alternative routes, and multiple transport modes.

## Prerequisites

- Docker & Docker Compose
- 4GB+ RAM available
- `Istanbul.osm.pbf` in the project root directory
- Node.js 18+ (for frontend development)

## Quick Start (First Time Setup)

Follow these steps carefully to process the map data and start the application.

### 1. Process OSRM Data
First, you need to extract and contract the map data for all three profiles (car, walk, bike). This step is mandatory before starting the containers.

```bash
# Make the script executable
chmod +x osrm/process-data.sh

# Run the data processing script (This may take 10-15 minutes depending on your hardware)
./osrm/process-data.sh

```

### 2. Start All Services

Once the script completes successfully and creates the `osrm-data-car`, `osrm-data-walk`, and `osrm-data-bike` folders, you can start the system:

```bash
docker compose up -d

```

This starts:

* **OSRM (Car)**: Port 5000
* **OSRM (Walking)**: Port 5001
* **OSRM (Bike)**: Port 5002
* **Backend API**: Port 8000
* **Frontend**: Port 3000

### 3. Access the Application

* **Frontend**: http://localhost:3000
* **API**: http://localhost:8000
* **API Docs**: http://localhost:8000/docs

---

## Features

### Turn-by-Turn Navigation

Routes include step-by-step directions displayed in the sidebar:

* Maneuver icons
* Distance to each maneuver
* Turkish instructions

### Geocoding (Address Search)

Search for addresses using OpenStreetMap's Nominatim:

* Click the search bar
* Type an address (e.g., "Taksim", "Kadıköy", "Beşiktaş")
* Select from the dropdown
* Click on map to set points manually

### Alternative Routes

OSRM returns multiple route options:

* Main route shown in blue
* Alternatives shown in gray
* Click to select an alternative route

### Transport Modes

Three profiles available:

* **Araba** (Car) - Standard driving routes
* **Yaya** (Pedestrian) - Foot paths and sidewalks
* **Bisiklet** (Bicycle) - Bike-friendly routes

### Dark Mode

Toggle between light and dark map themes using the 🌙 button.

---

## Local Development

### Backend Development

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

```

### Frontend Development

```bash
cd frontend
npm install
npm run dev

```

## Troubleshooting

### API Returns 502 or Containers Failing

* Ensure `./osrm/process-data.sh` finished without errors and folders (`osrm-data-car`, etc.) are not empty.
* Check OSRM logs: `docker logs istanbul-osrm-car`
* Check API health: `curl http://localhost:5000/health`
* Check backend logs: `docker logs istanbul-routing-api`

### Frontend Not Loading

* Check container: `docker logs istanbul-routing-frontend`
* Check if port 3000 is in use: `lsof -i :3000`
* Rebuild after changes: `docker compose up --build -d frontend`

## Project Structure

```
istanbul-routing/
├── backend/
│   ├── app/
│   │   └── main.py          # FastAPI application
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main React component
│   │   ├── api/             # API functions
│   │   └── index.css       # Styles
│   ├── package.json
│   ├── vite.config.ts
│   ├── nginx.conf
│   └── Dockerfile
├── osrm/
│   └── profiles/           # OSRM profiles
├── osrm-data-car/          # Car routing data
├── osrm-data-walk/         # Foot routing data
├── osrm-data-bike/         # Bike routing data
├── docker-compose.yml
├── osrm-docker-compose.yml
├── Istanbul.osm.pbf
├── SETUP.md
└── README.md
```
