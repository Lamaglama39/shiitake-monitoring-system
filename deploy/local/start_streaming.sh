#!/bin/bash
# start_streaming.sh - Start YOLO camera streaming to KVS

set -e

# Configuration
MODEL_PATH="${MODEL_PATH:-../../model/best.pt}"
CAMERA_INDEX="${CAMERA_INDEX:-0}"
WIDTH="${WIDTH:-1280}"
HEIGHT="${HEIGHT:-720}"
CONF_THRESHOLD="${CONF_THRESHOLD:-0.5}"
TCP_HOST="${TCP_HOST:-0.0.0.0}"
TCP_PORT="${TCP_PORT:-5000}"
YOLO_INTERVAL="${YOLO_INTERVAL:-3}"  # Process YOLO every N frames (higher = faster FPS)
BITRATE="${BITRATE:-1500}"  # Video bitrate in kbps (720p: 1500-3000, 1080p: 3000-5000)
KEYFRAME_INTERVAL="${KEYFRAME_INTERVAL:-90}"  # Keyframe interval in frames (90 = 3sec at 30fps)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Shiitake Monitoring - YOLO Streaming ===${NC}"
echo ""

# Check if model exists
if [ ! -f "$MODEL_PATH" ]; then
    echo -e "${RED}Error: Model file not found: $MODEL_PATH${NC}"
    echo "Please train the model first or specify MODEL_PATH environment variable"
    exit 1
fi

echo -e "${GREEN}✓ Model found: $MODEL_PATH${NC}"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: python3 not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Python 3 found${NC}"

echo -e "${GREEN}✓ GStreamer found${NC}"

# Display configuration
echo ""
echo "Configuration:"
echo "  Model: $MODEL_PATH"
echo "  Camera: $CAMERA_INDEX"
echo "  Resolution: ${WIDTH}x${HEIGHT}"
echo "  Confidence: $CONF_THRESHOLD"
echo "  YOLO Interval: Every $YOLO_INTERVAL frames"
echo "  Bitrate: ${BITRATE} kbps"
echo "  Keyframe Interval: ${KEYFRAME_INTERVAL} frames (~$((KEYFRAME_INTERVAL / 30)) sec)"
echo "  TCP Target: ${TCP_HOST}:${TCP_PORT}"
echo ""

# Check if Docker is running and KVS receiver is ready
echo -e "${YELLOW}Note: Make sure Docker container is running and waiting for connection${NC}"
echo "Docker command should be:"
echo "  gst-launch-1.0 -v tcpclientsrc host=host.docker.internal port=${TCP_PORT} ! gdpdepay ! video/x-h264,format=avc,alignment=au ! h264parse ! kvssink stream-name=dockerStream"
echo ""

read -r -p "Press Enter to start streaming (Ctrl+C to stop)..."

# Start streaming
echo -e "${GREEN}Starting YOLO streaming...${NC}"
python stream_to_kvs.py \
    --model "$MODEL_PATH" \
    --camera "$CAMERA_INDEX" \
    --width "$WIDTH" \
    --height "$HEIGHT" \
    --conf "$CONF_THRESHOLD" \
    --host "$TCP_HOST" \
    --port "$TCP_PORT" \
    --yolo-interval "$YOLO_INTERVAL" \
    --bitrate "$BITRATE" \
    --keyframe-interval "$KEYFRAME_INTERVAL"
