# Frontend API Reference

## Overview

The frontend provides a modern web interface for managing YouTube automation campaigns, built with Next.js 14, TypeScript, and TailwindCSS.

## Pages

### Dashboard (`/`)
- Overview of all campaigns and statistics
- Real-time metrics (total views, active accounts, campaigns)
- Recent campaigns list
- Quick action buttons

### Watch Video (`/watch`)
- Start new watch campaigns
- Configure watch parameters
- Support for both logged-in and anonymous viewing
- Auto-comment and auto-like features
- Real-time progress tracking

### Accounts (`/accounts`)
- Upload and manage YouTube accounts
- View account status (active, inactive, 2FA required)
- Account statistics (videos watched, comments posted)
- Export accounts to CSV

### Comments Library (`/comments`)
- Manage comment templates
- Add, edit, and delete comments
- Organize by categories
- Export to JSON

### Campaign History (`/history`)
- View all past and current campaigns
- Filter by status (running, completed, failed)
- Detailed metrics for each campaign
- Error logs

### Settings (`/settings`)
- Configure API endpoint
- Anti-detection features
- Browser settings
- Automation preferences

## API Client

The frontend uses a TypeScript API client located at `/frontend/lib/api.ts`.

### Watch API

```typescript
import { watchAPI } from '@/lib/api';

// Watch video with config
const response = await watchAPI.watchVideo({
  videoUrl: 'https://www.youtube.com/watch?v=VIDEO_ID',
  watchTimeSeconds: 180,
  useAccounts: true,
  anonymousCount: 5,
  autoComment: true,
  autoLike: true,
  autoSubscribe: false,
});
```

### Accounts API

```typescript
import { accountsAPI } from '@/lib/api';

// Upload accounts CSV
const formData = new FormData();
formData.append('file', file);
await accountsAPI.uploadAccounts(formData);

// Get all accounts
const { accounts } = await accountsAPI.getAccounts();

// Delete account
await accountsAPI.deleteAccount('email@example.com');
```

### Comments API

```typescript
import { commentsAPI } from '@/lib/api';

// Get all comments
const { comments } = await commentsAPI.getComments();

// Save comments
await commentsAPI.saveComments([
  { text: 'Great video!', category: 'general' },
  { text: 'Very informative!', category: 'educational' },
]);
```

### Campaign API

```typescript
import { campaignAPI } from '@/lib/api';

// Get campaign history
const { campaigns } = await campaignAPI.getHistory();

// Get single campaign
const { campaign } = await campaignAPI.getCampaign('campaign-id');
```

### Stats API

```typescript
import { statsAPI } from '@/lib/api';

// Get dashboard stats
const stats = await statsAPI.getStats();
// Returns: { totalCampaigns, totalViews, activeAccounts, totalWatchTime }
```

## Environment Variables

Create a `.env.local` file in the `/frontend` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Development

### Install Dependencies

```bash
cd frontend
npm install
```

### Run Development Server

```bash
npm run dev
```

The frontend will be available at `http://localhost:3001`.

### Build for Production

```bash
npm run build
npm start
```

## Components

### Sidebar
- Main navigation component
- Active link highlighting
- Responsive design

### StatsCard
- Reusable stats display component
- Icon support
- Trend indicators

## Features

### Real-time Updates
- Campaigns are polled every 5 seconds on the history page
- Live progress bars for running campaigns

### Form Validation
- Client-side validation for all forms
- Error messages and hints
- Required field indicators

### Responsive Design
- Mobile-friendly interface
- Adaptive layouts for all screen sizes
- Touch-friendly controls

### Loading States
- Spinner animations during API calls
- Disabled buttons during loading
- Progress indicators

### Error Handling
- User-friendly error messages
- Retry mechanisms
- Error boundaries for fault tolerance

## Styling

The frontend uses TailwindCSS for styling:

- **Color Palette**: Blue primary, gray neutrals
- **Typography**: Sans-serif system fonts
- **Spacing**: 8px grid system
- **Borders**: Rounded corners (lg, xl)
- **Shadows**: Subtle depth (sm, md)

## Future Enhancements

- [ ] Add authentication/login system
- [ ] Implement dark mode
- [ ] Add real-time WebSocket updates
- [ ] Create mobile app version
- [ ] Add analytics charts (Chart.js or Recharts)
- [ ] Implement campaign scheduling
- [ ] Add proxy management UI
- [ ] Create API testing playground
- [ ] Add export/import for settings
- [ ] Implement user roles and permissions

## Troubleshooting

### API Connection Issues

If the frontend cannot connect to the backend:

1. Check that the backend is running on port 3000
2. Verify `NEXT_PUBLIC_API_URL` in `.env.local`
3. Check CORS settings in the backend
4. Inspect browser console for errors

### Build Errors

If you encounter build errors:

```bash
# Clear cache and reinstall
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

### TypeScript Errors

If you see TypeScript errors:

```bash
# Check types
npm run type-check

# Or use the TypeScript language server
npm run lint
```

## Support

For issues or questions:
- Check the main README.md
- Review backend API documentation
- Inspect browser console for errors
- Check backend logs for API issues
