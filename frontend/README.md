# YouTube Manager Frontend

Modern web interface for YouTube Account Manager & View Booster.

## 🚀 Features

- 📊 **Dashboard** - Overview of views, subscribers, comments, engagement
- 🎬 **Boost Views** - Generate views, likes, comments, subscribers
- 👥 **Account Management** - Upload and manage YouTube accounts
- 💬 **Comment System** - Auto-comment with 100+ templates
- ⚙️ **Settings** - Configure proxies, comments, and more
- 🎨 **Modern UI** - Built with Next.js 14, TypeScript, TailwindCSS

## 📦 Installation

```bash
# Install dependencies
npm install

# Or using yarn
yarn install
```

## 🔧 Configuration

Create `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3006
```

## 🏃 Development

```bash
# Start development server
npm run dev

# Open browser at http://localhost:3000
```

## 🏗️ Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 📁 Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Dashboard
│   ├── watch/page.tsx     # Boost Views
│   ├── accounts/page.tsx  # Account Management
│   ├── settings/page.tsx  # Settings
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── Sidebar.tsx       # Navigation sidebar
│   └── StatsCard.tsx     # Stats display card
├── lib/                   # Utilities
│   └── api.ts            # API client
└── public/               # Static assets
```

## 🎯 Usage

### 1. Start Backend Server

```bash
cd ..
npm run dev:backend
# Backend running on http://localhost:3006
```

### 2. Start Frontend

```bash
cd frontend
npm run dev
# Frontend running on http://localhost:3000
```

### 3. Access Dashboard

Open browser: `http://localhost:3000`

## 📖 API Integration

The frontend connects to backend API at `http://localhost:3006/api/v1`

### Available Endpoints:

- `POST /watch/batch` - Boost views
- `POST /watch/batch-accounts` - Boost with accounts
- `GET /youtube/accounts` - Get accounts
- `POST /youtube/accounts/upload` - Upload accounts
- `POST /youtube/create-channels-batch` - Create channels

## 🎨 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **Icons:** Lucide React
- **HTTP Client:** Axios
- **UI:** Custom components

## 🛠️ Development Tips

### Hot Reload
Changes to components/pages will hot-reload automatically.

### TypeScript
All components are typed. Check `lib/api.ts` for API types.

### Styling
Use TailwindCSS utility classes. See `tailwind.config.js` for theme.

## 📝 Todo

- [ ] Add authentication/login
- [ ] Add real-time progress tracking
- [ ] Add campaign history
- [ ] Add analytics charts
- [ ] Add dark mode toggle
- [ ] Add mobile responsive menu

## 🆘 Troubleshooting

### Port 3000 already in use?

```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
npm run dev -- -p 3001
```

### API connection failed?

1. Check backend is running on port 3006
2. Check `.env.local` has correct API URL
3. Check CORS is enabled in backend

### Build errors?

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## 📄 License

MIT License - See root project LICENSE file
