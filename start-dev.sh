#!/bin/bash

# YouTube Automation Tool - Development Server Startup Script

echo "🚀 Starting YouTube Automation Tool..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}"

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo -e "${BLUE}🛑 Stopping servers...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Start backend
echo ""
echo -e "${BLUE}🔧 Starting Backend Server (with auto-reload)...${NC}"
npx nodemon src/server.js &
BACKEND_PID=$!

# Wait for backend to start
echo "Waiting for backend to be ready..."
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Backend failed to start. Check for errors above.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend running on http://localhost:3000${NC}"

# Start frontend if directory exists
if [ -d "frontend" ]; then
    echo ""
    echo -e "${BLUE}🎨 Starting Frontend Server...${NC}"
    cd frontend
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "Installing frontend dependencies..."
        npm install
    fi
    
    npm run dev &
    FRONTEND_PID=$!
    cd ..
    
    # Wait for frontend to start
    sleep 3
    
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${RED}❌ Frontend failed to start. Check for errors above.${NC}"
    else
        echo -e "${GREEN}✅ Frontend running on http://localhost:3001${NC}"
    fi
else
    echo -e "${BLUE}ℹ️  Frontend directory not found, running backend only${NC}"
fi

# Display info
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ YouTube Automation Tool is running!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}📊 Backend API:${NC}  http://localhost:3000"
if [ -d "frontend" ]; then
    echo -e "${BLUE}🎨 Frontend UI:${NC}  http://localhost:3001"
fi
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "   - README.md"
echo "   - WATCH_VIDEO_API.md"
echo "   - ANTI_DETECTION_GUIDE.md"
echo "   - frontend/API_REFERENCE.md"
echo ""
echo -e "${RED}Press Ctrl+C to stop all servers${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Wait for user to stop
wait
