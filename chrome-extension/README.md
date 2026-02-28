# La Lista — Chrome Extension

Assign PR reviewers using round-robin directly from GitHub pull request pages. This extension connects to the same Convex backend as the La Lista web app.

## Features

- **Auto-detect PR**: Automatically extracts PR URL, title, and author from the current GitHub tab
- **Round-robin assignment**: Assigns the next reviewer based on the team's round-robin algorithm
- **Tag-based filtering**: Filter reviewers by tag (e.g., frontend, backend) before assigning
- **Force-assign**: Manually assign to any available reviewer
- **Duplicate detection**: Warns if a PR has already been assigned
- **Google Chat notifications**: Optionally send a notification to Google Chat after assignment
- **Multi-team support**: Switch between teams via dropdown

## Setup

### 1. Install dependencies

```bash
cd chrome-extension
pnpm install
```

### 2. Build the extension

```bash
# From the chrome-extension directory
pnpm build

# Or from the root project
pnpm ext:build
```

For development with hot-rebuild:

```bash
pnpm dev

# Or from root
pnpm ext:dev
```

### 3. Load in Chrome

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `chrome-extension/dist` folder

### 4. Usage

1. Navigate to any GitHub Pull Request page
2. Click the **La Lista** extension icon (shows a green "PR" badge when on a PR page)
3. Sign in with your Clerk account
4. Select your team
5. Click **Assign** to assign the next reviewer via round-robin, or expand **Force assign to...** to pick a specific reviewer

## Project Structure

```
chrome-extension/
├── public/
│   ├── manifest.json          # Chrome extension manifest (V3)
│   └── icons/                 # Extension icons
├── src/
│   ├── background.ts          # Service worker (badge management)
│   ├── content.ts             # Content script (PR data extraction)
│   ├── styles.css             # Tailwind CSS entry point
│   ├── types.ts               # TypeScript type definitions
│   ├── popup/
│   │   └── index.tsx          # Popup entry point
│   ├── providers/
│   │   └── Providers.tsx      # Clerk + Convex providers
│   ├── hooks/
│   │   ├── useAssignment.ts   # Main assignment logic
│   │   ├── useCheckPR.ts      # Duplicate PR detection
│   │   ├── usePRDetection.ts  # PR data from active tab
│   │   ├── useTeamStorage.ts  # Team selection persistence
│   │   └── useChatToggle.ts   # Chat notification toggle
│   └── components/
│       ├── App.tsx             # Main app component
│       ├── Header.tsx          # Header with auth
│       ├── SignInView.tsx      # Sign-in screen
│       ├── TeamSelector.tsx    # Team dropdown
│       ├── PRBanner.tsx        # PR detection status
│       ├── NextReviewerCard.tsx# Next reviewer + assign button
│       ├── TagFilter.tsx       # Tag filter pills
│       ├── ForceAssignPanel.tsx# Force-assign reviewer list
│       ├── ChatToggle.tsx      # Google Chat toggle
│       ├── AlreadyAssignedWarning.tsx
│       └── ErrorMessage.tsx
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Notes

- The extension shares the Convex backend with the web app — assignments made here appear in real-time on the web app
- Authentication uses the same Clerk instance as the web app
- Icons are basic placeholders — replace with proper branded PNGs for production
