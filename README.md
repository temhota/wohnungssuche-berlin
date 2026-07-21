# Kiezfinder

Web application for finding apartments offered by Berlin's state-owned housing
companies: WBM, HOWOGE, degewo, Gewobag, GESOBAU, and STADT UND LAND.

## Run locally

Node.js 20.9 or later is required.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Verify the production build

```bash
pnpm build
```

The project is ready for deployment on Vercel. The current version uses demo
listings; live data sources and data storage on ALL-INKL will be added in the
next phase.
