# Airscope

Live flight-tracking platform built with Next.js, MongoDB, and AirLabs.

## Features

- Login and account creation backed by MongoDB
- Protected dashboard at `/`
- Protected NASA dashboard at `/nasa`
- Protected world monitor dashboard at `/world-monitor`
- World map with live aircraft positions
- Click a plane to inspect flight number, airline, speed, altitude, and route
- Departure and arrival airport lookup with route line overlay
- Search by flight code, airline, route, or aircraft type
- NASA mission data page with APOD, asteroid activity, and archive highlights
- World monitor page with earthquakes, natural events, weather alerts, and global market clocks

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Leaflet + React Leaflet
- MongoDB Atlas + Mongoose
- JWT session cookies with `jose`

## Environment Variables

Create `.env.local` with:

```env
AIRLABS_API_KEY=your_airlabs_key
NASA_API_KEY=your_nasa_key
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=airscope
SESSION_SECRET=replace_with_a_long_random_secret
```

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Create an account on `/login`, then the app redirects to the live radar dashboard. Use the header buttons to open the `NASA data` and `World monitor` pages.

## Useful Commands

```bash
npm run lint
npm run build
npm run start
```

## Notes

- The AirLabs key is used only on the server through `/api/flights` and `/api/flight-context`.
- The NASA key is used only on the server through the NASA dashboard data loader.
- The current auto-refresh interval is `30s` to avoid exhausting low free-tier API quotas too quickly.
- MongoDB uses `MONGODB_DB_NAME` so the Atlas connection string does not need an inline database name.
