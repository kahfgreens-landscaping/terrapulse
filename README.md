# TerraPulse — Live Landscape Project & Client Portal

> React + Capacitor + Firebase cross-platform app for landscape project management

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Firebase
Copy `.env.example` to `.env.local` and fill in your Firebase project credentials:
```bash
copy .env.example .env.local
```

Get your credentials from [Firebase Console](https://console.firebase.google.com) → Project Settings → Your Apps.

### 3. Run web dev server
```bash
npm run dev
```

### 4. Build for production
```bash
npm run build
```

### 5. Add mobile platforms
```bash
npx cap add android
npx cap add ios
npx cap sync
```

### 6. Open in Android Studio / Xcode
```bash
npx cap open android
npx cap open ios
```

---

## Tech Stack

- **React 18 + TypeScript** — UI framework
- **Capacitor 6** — Native iOS & Android wrapper
- **Firebase** — Auth, Firestore, Storage, Functions, FCM
- **Tailwind CSS** — Styling
- **Framer Motion** — Animations
- **Zustand** — State management
- **React Query** — Server state caching
- **Recharts** — Analytics charts
- **React Hook Form + Zod** — Form validation

## Project Structure

```
src/
├── app/               # Route-level page components
│   ├── auth/          # Login, Onboarding
│   ├── dashboard/     # Client home
│   ├── projects/      # Timeline + detail
│   ├── designs/       # Mockup approvals
│   ├── gallery/       # Before/After photos
│   ├── messages/      # Real-time chat
│   ├── documents/     # Invoices + files
│   ├── maintenance/   # Schedule
│   ├── feedback/      # Reviews + NPS
│   └── admin/         # PM/Admin panel
├── components/
│   ├── ui/            # Reusable UI components
│   ├── layout/        # Sidebar, Topbar, AppLayout
│   └── auth/          # ProtectedRoute
├── hooks/             # useAuth, useFirestore
├── lib/               # firebase.ts, utils.ts
├── store/             # Zustand stores
└── types/             # TypeScript interfaces
```

## Firebase Collections

| Collection | Purpose |
|---|---|
| `users` | User profiles + roles |
| `projects` | Project records + phases |
| `designs` | Mockup files + approval status |
| `photos` | Before/After/Progress images |
| `projects/{id}/messages` | Per-project chat |
| `invoices` | Invoice records |
| `documents` | Contracts, permits, etc. |
| `maintenance` | Recurring service schedule |
| `reviews` | NPS + star ratings |

## User Roles

| Role | Permissions |
|---|---|
| `client` | View own projects, approve designs, send messages, pay invoices |
| `pm` | View/edit assigned projects, upload photos/designs |
| `admin` | Full access + admin dashboard |
| `crew` | Check-in, upload photos |

## Environment Variables

See `.env.example` for all required environment variables.
