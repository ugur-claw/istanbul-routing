#!/bin/bash
# OSRM Data Processing Script (CH Version) - Multi Profile
set -e

OSM_FILE="Istanbul.osm.pbf"

echo "=== Istanbul OSRM Data Processing (CH) ==="
echo "OSM File: $OSM_FILE"

# Check if OSM file exists
if [ ! -f "$OSM_FILE" ]; then
    echo "Error: $OSM_FILE not found in the current directory!"
    echo "Please run this script from the project root directory where $OSM_FILE is located."
    exit 1
fi

# Profiller ve karşılık gelen OSRM lua dosyaları
PROFILES=("car" "walk" "bike")
LUA_FILES=("/opt/car.lua" "/opt/foot.lua" "/opt/bicycle.lua")

for i in "${!PROFILES[@]}"; do
    PROFILE="${PROFILES[$i]}"
    LUA_FILE="${LUA_FILES[$i]}"
    DATA_DIR="./osrm-data-${PROFILE}"

    echo ""
    echo "================================================="
    echo "=== Processing Profile: $PROFILE"
    echo "=== Output Directory: $DATA_DIR"
    echo "=== Profile Lua: $LUA_FILE"
    echo "================================================="

    mkdir -p "$DATA_DIR"

    echo ""
    echo "--- Step 1: Extracting road network ($PROFILE) ---"
    docker run -t --rm \
        -v "$(pwd)/$OSM_FILE:/data/istanbul.osm.pbf" \
        -v "$(pwd)/$DATA_DIR:/data" \
        osrm/osrm-backend \
        osrm-extract \
        -p "$LUA_FILE" \
        --threads 8 \
        /data/istanbul.osm.pbf

    echo ""
    echo "--- Step 2: Contracting (CH - $PROFILE) ---"
    docker run -t --rm \
        -v "$(pwd)/$DATA_DIR:/data" \
        osrm/osrm-backend \
        osrm-contract \
        --threads 8 \
        /data/istanbul.osrm
        
    echo "=== Completed Profile: $PROFILE ==="
done

echo ""
echo "=== All Processing Complete! ==="
echo "Files created successfully in osrm-data-car, osrm-data-walk, and osrm-data-bike directories."
echo "You can now start the services with: docker compose up -d"
