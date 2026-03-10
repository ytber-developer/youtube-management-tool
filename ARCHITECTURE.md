# 📊 Project Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE (Frontend)                 │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Dashboard │  │  Watch   │  │ Accounts │  │ Comments │   │
│  │  Page    │  │   Page   │  │   Page   │  │   Page   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  ┌──────────┐  ┌──────────┐                                │
│  │ History  │  │ Settings │                                │
│  │  Page    │  │   Page   │                                │
│  └──────────┘  └──────────┘                                │
│                                                              │
│                   Next.js 14 + TypeScript + TailwindCSS     │
└─────────────────────────────────────────────────────────────┘
                              ↕ HTTP/REST API
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API (Node.js)                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Express.js REST API                       │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │ │
│  │  │  Watch   │  │ Accounts │  │ Comments │            │ │
│  │  │Controller│  │Controller│  │Controller│            │ │
│  │  └──────────┘  └──────────┘  └──────────┘            │ │
│  └────────────────────────────────────────────────────────┘ │
│                              ↕                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Business Logic Layer                      │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │         Playwright Services                      │ │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │ │ │
│  │  │  │ Browser  │  │  Google  │  │  Watch   │      │ │ │
│  │  │  │ Service  │  │   Auth   │  │ Service  │      │ │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘      │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │           Helper Functions                       │ │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │ │ │
│  │  │  │Anti-Det. │  │ Comment  │  │  Proxy   │      │ │ │
│  │  │  │  Helper  │  │  Helper  │  │  Helper  │      │ │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘      │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                    AUTOMATION LAYER                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Playwright (Firefox) Browsers                │ │
│  │                                                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │ │
│  │  │ Browser  │  │ Browser  │  │ Browser  │            │ │
│  │  │ Instance │  │ Instance │  │ Instance │    ...     │ │
│  │  │    #1    │  │    #2    │  │    #3    │            │ │
│  │  └──────────┘  └──────────┘  └──────────┘            │ │
│  │       ↕              ↕              ↕                  │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │ │
│  │  │  Proxy   │  │  Proxy   │  │  Proxy   │            │ │
│  │  │    #1    │  │    #2    │  │    #3    │            │ │
│  │  └──────────┘  └──────────┘  └──────────┘            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                        YOUTUBE                               │
│                                                              │
│              https://www.youtube.com                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Watch Video Campaign

```
User Input (Frontend)
  ↓
Watch Page Form
  ↓
API Client (TypeScript)
  ↓
POST /api/youtube/watch
  ↓
Watch Controller
  ↓
Watch Service (Playwright)
  ↓
┌─────────────────────────────────────┐
│ For Each Account/Anonymous Session  │
│  ↓                                   │
│ Browser Service                      │
│  ↓                                   │
│ Create Browser Context (with proxy) │
│  ↓                                   │
│ Google Auth Service (if account)    │
│  ↓                                   │
│ Watch Service                        │
│  ↓                                   │
│ Navigate to YouTube                 │
│  ↓                                   │
│ Play Video                           │
│  ↓                                   │
│ Human Behavior Simulation            │
│  ↓                                   │
│ Auto-Comment (if enabled)            │
│  ↓                                   │
│ Auto-Like (if enabled)               │
│  ↓                                   │
│ Auto-Subscribe (if enabled)          │
│  ↓                                   │
│ Wait for Watch Time                  │
│  ↓                                   │
│ Close Browser                        │
└─────────────────────────────────────┘
  ↓
Aggregate Results
  ↓
Return Response to Frontend
  ↓
Display Results to User
```

### 2. Account Upload

```
User Uploads CSV (Frontend)
  ↓
Accounts Page
  ↓
File Upload API
  ↓
POST /api/accounts/upload
  ↓
Accounts Controller
  ↓
Parse CSV
  ↓
Validate Data
  ↓
Save to Database/Storage
  ↓
Return Success Response
  ↓
Refresh Accounts List (Frontend)
```

### 3. Comment Management

```
User Adds Comment (Frontend)
  ↓
Comments Page
  ↓
API Client
  ↓
POST /api/comments
  ↓
Comments Controller
  ↓
Update comments.json
  ↓
Return Success Response
  ↓
Update UI (Frontend)
```

## Component Interaction

### Frontend Components

```
App Layout (layout.tsx)
├── Sidebar (Sidebar.tsx)
│   ├── Dashboard Link
│   ├── Watch Link
│   ├── Accounts Link
│   ├── Comments Link
│   ├── History Link
│   └── Settings Link
│
└── Page Content
    ├── Dashboard (page.tsx)
    │   ├── StatsCard × 4
    │   ├── Recent Campaigns List
    │   └── Quick Actions
    │
    ├── Watch (watch/page.tsx)
    │   ├── Video URL Input
    │   ├── Configuration Form
    │   ├── Mode Selection
    │   └── Campaign Results
    │
    ├── Accounts (accounts/page.tsx)
    │   ├── Upload Section
    │   ├── Accounts Table
    │   └── Stats Summary
    │
    ├── Comments (comments/page.tsx)
    │   ├── Add Comment Form
    │   ├── Comments List
    │   └── Stats Cards
    │
    ├── History (history/page.tsx)
    │   ├── Filter Controls
    │   ├── Summary Stats
    │   └── Campaigns List
    │
    └── Settings (settings/page.tsx)
        ├── API Configuration
        ├── Automation Settings
        ├── Anti-Detection Features
        └── General Settings
```

### Backend Services

```
Express Server (server.js)
├── Routes
│   ├── /api/youtube/*
│   │   └── Watch Controller
│   ├── /api/accounts/*
│   │   └── Accounts Controller
│   ├── /api/comments/*
│   │   └── Comments Controller
│   ├── /api/campaigns/*
│   │   └── Campaigns Controller
│   └── /api/stats
│       └── Stats Controller
│
├── Services
│   ├── Playwright
│   │   ├── Browser Service
│   │   ├── Google Auth Service
│   │   ├── Watch Service
│   │   └── Authenticator Service
│   └── Puppeteer (legacy)
│
├── Helpers
│   ├── Anti-Detection Helper
│   ├── Comment Helper
│   ├── Proxy Helper
│   └── Utility Functions
│
└── Models
    ├── Account Model
    ├── Campaign Model
    └── Comment Model
```

## File System Structure

```
project-root/
│
├── src/                          # Backend source
│   ├── controllers/              # API endpoints
│   ├── services/                 # Business logic
│   │   └── playwright/           # Playwright automation
│   ├── helpers/                  # Utilities
│   ├── models/                   # Data models
│   ├── routes/                   # Express routes
│   ├── middlewares/              # Express middleware
│   └── database/                 # Database scripts
│
├── frontend/                     # Next.js frontend
│   ├── app/                      # App router pages
│   │   ├── accounts/
│   │   ├── comments/
│   │   ├── history/
│   │   ├── settings/
│   │   ├── watch/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   └── globals.css
│   ├── components/               # React components
│   │   ├── Sidebar.tsx
│   │   └── StatsCard.tsx
│   ├── lib/                      # Utilities
│   │   └── api.ts                # API client
│   ├── public/                   # Static assets
│   │   └── templates/
│   ├── .env.local                # Environment vars
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── next.config.js
│   └── README.md
│
├── uploads/                      # Uploaded files
├── config/                       # Configuration
├── avatars/                      # Avatar images
│
├── comments.json                 # Comment templates
├── proxies.txt                   # Proxy list
│
├── server.js                     # Main entry point
├── package.json                  # Backend deps
├── start-dev.sh                  # Dev startup
├── build-prod.sh                 # Build script
│
└── Documentation/
    ├── README.md                 # Main documentation
    ├── WATCH_VIDEO_API.md        # API reference
    ├── ANTI_DETECTION_GUIDE.md   # Anti-detection
    ├── PROXY_SETUP.md            # Proxy setup
    ├── COMMENT_LIKE_FEATURE.md   # Comment/like feature
    ├── FRONTEND_SETUP.md         # Frontend setup
    ├── FRONTEND_COMPLETE.md      # Frontend summary
    └── frontend/
        └── API_REFERENCE.md      # Frontend API docs
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.x
- **Styling**: TailwindCSS 3.x
- **Icons**: Lucide React
- **HTTP Client**: Fetch API
- **State Management**: React Hooks

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Automation**: Playwright (Firefox)
- **Legacy**: Puppeteer (Chrome)
- **HTTP**: cors, morgan, multer
- **Utilities**: dotenv, node-cron

### DevOps
- **Package Manager**: npm
- **Process Manager**: nodemon (dev)
- **Build Tools**: Next.js build
- **Scripts**: Bash scripts

## Security Layers

```
┌─────────────────────────────────────────────┐
│            User/Client                      │
└─────────────────────────────────────────────┘
                   ↓ HTTPS (Production)
┌─────────────────────────────────────────────┐
│         Frontend (Public)                   │
│  • Input Validation                         │
│  • XSS Prevention                           │
│  • CSRF Token (TODO)                        │
└─────────────────────────────────────────────┘
                   ↓ API Calls
┌─────────────────────────────────────────────┐
│         Backend API                         │
│  • Authentication (TODO)                    │
│  • Rate Limiting (TODO)                     │
│  • Input Sanitization                       │
│  • CORS Configuration                       │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│         Automation Layer                    │
│  • Proxy Rotation                           │
│  • Browser Fingerprinting                   │
│  • Human Behavior Simulation                │
│  • Anti-Detection Measures                  │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│         External Services                   │
│  • YouTube                                  │
│  • Google Auth                              │
│  • Proxy Servers                            │
└─────────────────────────────────────────────┘
```

---

**This architecture provides a scalable, maintainable, and secure foundation for YouTube automation at scale.**
