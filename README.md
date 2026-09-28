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
pnpm format:check
```

Tests use controlled provider responses and do not require network access.

## Format code

```bash
pnpm format
```

Prettier uses the project configuration in `.prettierrc.json`. Generated output
and package-manager lockfiles are excluded by `.prettierignore`.

## Verify the production build

```bash
pnpm build
```

The project is ready for deployment on Vercel. It currently fetches live HOWOGE,
degewo, and GESOBAU listings on the server and exposes normalized data at
`/api/listings`. Additional housing providers and data storage on ALL-INKL will
be added in later phases.

## Listing cache and filtering

Successful provider snapshots are stored in the Next.js Data Cache for 120 seconds.
Each snapshot includes every provider page and its actual fetch timestamp. Stale
snapshots are served while Next.js refreshes them in the background; a failed
refresh does not replace a successful cached snapshot.

The browser filters and paginates its loaded listings locally, preserving query
parameters and browser history without requesting another server-rendered page.
Selecting a provider that has not been loaded requests it through
`/api/listings?provider=HOWOGE` (the parameter may be repeated). While the tab is
visible, it checks every 15 seconds whether a selected snapshot needs refreshing.
These checks only request missing or expired data. Existing results and local
controls remain available during refreshes, and stale data is labelled.

The first uncached request still depends on provider response times. Cache
persistence and sharing across server instances depend on the deployment's
Next.js Data Cache support; a self-hosted multi-instance deployment needs a shared
cache handler. The API response itself is not CDN-cached, so its provider status
and timestamps remain current.
