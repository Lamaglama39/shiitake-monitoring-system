#!/bin/bash
# docker-entrypoint.sh - Container entrypoint script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Shiitake Monitoring - KVS Container ===${NC}"
echo ""

# Auto-detect host IP based on OS
if [ -z "$TCP_HOST" ]; then
    if [ -f /proc/version ] && grep -qi linux /proc/version; then
        # On Linux, use Docker bridge IP
        TCP_HOST="172.17.0.1"
    else
        # On macOS/Windows, use host.docker.internal
        TCP_HOST="host.docker.internal"
    fi
fi

# Check AWS credentials
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo -e "${RED}Error: AWS credentials not set${NC}"
    echo ""
    echo "Please set the following environment variables:"
    echo "  AWS_ACCESS_KEY_ID"
    echo "  AWS_SECRET_ACCESS_KEY"
    echo "  AWS_DEFAULT_REGION (optional, default: ap-northeast-1)"
    echo ""
    echo "You can set them in the .env file or pass them via docker-compose"
    exit 1
fi

echo -e "${GREEN}✓ AWS credentials configured${NC}"
echo "  Region: $AWS_DEFAULT_REGION"
echo "  Access Key: ${AWS_ACCESS_KEY_ID:0:10}..."

# Verify GStreamer installation
echo ""
echo "Verifying GStreamer installation..."
if command -v gst-launch-1.0 &> /dev/null; then
    echo -e "${GREEN}✓ GStreamer found${NC}"
    gst-launch-1.0 --version | head -n 1
else
    echo -e "${RED}Error: GStreamer not found${NC}"
    exit 1
fi

# Verify kvssink plugin
if gst-inspect-1.0 kvssink &> /dev/null; then
    echo -e "${GREEN}✓ kvssink plugin found${NC}"
else
    echo -e "${RED}Error: kvssink plugin not found${NC}"
    exit 1
fi

# Display configuration
echo ""
echo "Configuration:"
echo "  Stream Name: $STREAM_NAME"
echo "  TCP Source: ${TCP_HOST}:${TCP_PORT}"
echo "  Region: $AWS_DEFAULT_REGION"
echo ""

# Handle different commands
case "$1" in
    kvs)
        echo -e "${YELLOW}Waiting for connection from host...${NC}"
        echo "Make sure to start the Python streaming script on the host side:"
        echo "  ./start_streaming.sh"
        echo ""
        echo -e "${GREEN}Starting KVS receiver...${NC}"
        echo "Pipeline: tcpclientsrc -> gdpdepay -> h264parse -> kvssink"
        echo ""

        # Start GStreamer pipeline
        exec gst-launch-1.0 -v \
            tcpclientsrc host=$TCP_HOST port=$TCP_PORT ! \
            gdpdepay ! \
            video/x-h264,format=avc,alignment=au ! \
            h264parse ! \
            kvssink stream-name=$STREAM_NAME
        ;;

    bash|sh)
        echo -e "${YELLOW}Starting interactive shell...${NC}"
        echo ""
        exec /bin/bash
        ;;

    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        echo "Available commands:"
        echo "  kvs   - Start KVS receiver (default)"
        echo "  bash  - Start interactive shell"
        exit 1
        ;;
esac
