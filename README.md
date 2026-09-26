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

## Verify changes

```bash
pnpm test
pnpm lint
```

Tests use controlled provider responses and do not require network access.

## Verify the production build

```bash
pnpm build
```

The project is ready for deployment on Vercel. It currently fetches live HOWOGE,
degewo, and GESOBAU listings on the server and exposes normalized data at
`/api/listings`. Additional housing providers and data storage on ALL-INKL will
be added in later phases.
