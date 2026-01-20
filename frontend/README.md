# Cornerstone Frontend (React + Vite)

## Setup

```bash
npm install
```

## Environment Variables

Create a `.env` file (copy from `.env.example`):

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_API_URL=http://localhost:3000
```

**Note:** If `VITE_CLERK_PUBLISHABLE_KEY` is not set, the app runs without authentication (dev mode).

## Run Development Server

```bash
npm run dev  # Runs on port 5173
```

## Build for Production

```bash
npm run build
```

## Key Files

- `src/main.tsx` - App entry with Clerk provider
- `src/contexts/AuthContext.tsx` - Authentication context
- `src/components/auth/` - Protected route components
- `src/lib/api.ts` - API client with auth token handling
- `src/pages/intake/IntakeForm.tsx` - Client intake form
- `src/pages/admin/` - Admin dashboard pages
