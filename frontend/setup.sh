#!/bin/bash

echo "🚀 YouTube Manager Frontend - Setup Script"
echo "=========================================="
echo ""

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Please run this script from the frontend directory"
  echo "   cd frontend && bash setup.sh"
  exit 1
fi

echo "📦 Installing dependencies..."
echo ""

# Install dependencies
npm install

if [ $? -ne 0 ]; then
  echo "❌ Failed to install dependencies"
  exit 1
fi

echo ""
echo "✅ Dependencies installed successfully!"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
  echo "📝 Creating .env.local file..."
  cat > .env.local <<EOF
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3006
EOF
  echo "✅ .env.local created"
else
  echo "ℹ️  .env.local already exists"
fi

echo ""
echo "=========================================="
echo "✅ Setup completed successfully!"
echo "=========================================="
echo ""
echo "📖 Next steps:"
echo ""
echo "1. Start the backend server (in root directory):"
echo "   cd .. && npm run dev:backend"
echo ""
echo "2. Start the frontend (in this directory):"
echo "   npm run dev"
echo ""
echo "3. Open your browser:"
echo "   http://localhost:3000"
echo ""
echo "=========================================="
