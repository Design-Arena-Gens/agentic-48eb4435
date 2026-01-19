# Rep & Set Tracker

A polished Next.js dashboard for logging workouts, tracking sets and reps, and keeping an eye on training volume over time. Sessions are stored locally in the browser so you can pick up right where you left off.

## Features

- Plan and log strength sessions with notes for the day and each exercise
- Add as many exercises and sets as you need with quick duplication controls
- Automatic training analytics: total sets, total volume, and per-exercise insights
- Fast search across past sessions to find specific movements instantly
- Data persists in the browser via `localStorage`, so no account setup is required

## Getting Started

Install dependencies and start the local development server:

```bash
npm install
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Build

To verify production readiness locally:

```bash
npm run lint
npm run build
```

## Deployment

This project is optimized for Vercel. After building locally, deploy with:

```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-48eb4435
```

Once the deployment finishes, verify the production URL:

```bash
curl https://agentic-48eb4435.vercel.app
```

