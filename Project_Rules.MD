# Project Deployment Rules (IMMUTABLE)

These rules are critical for the successful deployment of the `list-app` to Google Cloud Run. Any deviation will likely lead to build crashes or startup failures.

## 1. Container Infrastructure
- **Base Image**: Always use `node:20-bullseye-slim`. 
    - *Rationale*: Debian Bullseye provides the correct OpenSSL 1.1 libraries required by Prisma 5.22.0. Alpine and newer Debian versions (Bookworm) cause "missing shared library" errors.
- **Port**: The application must listen on port `8080`.
    - *Rationale*: This is the default port for Google Cloud Run.
- **User Permissions**: The application user (`nextjs`) must own the `/app` directory.
    - *Rationale*: Critical for SQLite. Without `chown -R nextjs:nodejs /app`, Prisma will fail with "unable to open database file".

## 2. Prisma Configuration
- **Prisma Version**: Pin to `5.22.0`.
    - *Rationale*: This is the stable project baseline. Avoid upgrading to version 7 unless the entire initialization flow (Next.js build environment) is refactored.
- **CLI Usage**: Always use the local binary: `./node_modules/.bin/prisma`.
    - *Rationale*: Prevents `npx` from downloading a newer Prisma version, which causes a "P1012" version mismatch error.
- **Binary Targets**: The `schema.prisma` must include `["native", "debian-openssl-1.1.x"]`.

## 3. Google Cloud Build
- **Logging**: The `cloudbuild.yaml` must include the following global options:
    ```yaml
    options:
      logging: CLOUD_LOGGING_ONLY
      defaultLogsBucketBehavior: REGIONAL_USER_OWNED_BUCKET
    ```
    - *Rationale*: Required by the project's custom service account to avoid "invalid argument" logging errors.
- **Region**: Deploy to `europe-west1`.
- **Registry**: Use Artifact Registry (`europe-west1-docker.pkg.dev`) rather than the legacy Container Registry (gcr.io).

## 4. Next.js Configuration
- **Output Mode**: `output: "standalone"` must be enabled in `next.config.ts`.
- **Startup**: Start the application using `node server.js` from the standalone output.
## 5. Infrastructure Details
- **Cloud SQL Instance**: `gen-lang-client-0994401151:us-east4:vaulted-faves`
- **Container Image URL**: `europe-west1-docker.pkg.dev/gen-lang-client-0994401151/cloud-run-source-deploy/list-app/list-app`

## 6. Local Development Startup Sequence

Start these in order:

### Step 1: Cloud SQL Proxy (Terminal 1)
```bash
cd /Users/philreed/.gemini/antigravity/scratch/list-app
cloud-sql-proxy gen-lang-client-0994401151:us-east4:vaulted-faves --port=5432
```

### Step 2: Dev Server (Terminal 2)
```bash
cd /Users/philreed/.gemini/antigravity/scratch/list-app
npm run dev
```

The app will be available at `http://localhost:3000`.

## 7. Swiss Design System

The application uses a Swiss Design aesthetic with CSS variables defined in `app/globals.css`:

### Core Colors
- `--swiss-black`: Primary text and buttons
- `--swiss-white`: Backgrounds
- `--swiss-off-white`: Secondary backgrounds
- `--swiss-cream`: Hover states
- `--swiss-green` / `--swiss-green-light`: Success states, tags
- `--swiss-red` / `--swiss-red-light`: Danger states

### Button Classes (in `app/components/styles.ts`)
- `primaryButtonClass`: Black pill button with white text
- `secondaryButtonClass`: White pill button with border
- `tagPillClass`: Green tag pills

### Key UI Patterns
- **Toggle buttons**: Use contrasting active states (dark green `#0d5c0a` for Experienced, dark amber `#b45309` for Want to Go)
- **Drag handles**: Horizontal lines icon for reorderable items
- **Tags**: Neutral gray style on item details, green on filter bars

## 8. Recent Changes (2026-02-02)

### Styling Fixes
- Fixed button contrast: "New Item" button now has `stroke-white` on SVG and `text-white` on text
- Updated "Invite" and "Share" buttons to use secondary pill style with `rounded-full`
- Improved status toggle contrast with darker amber for "Want to Go" selected state
- Fixed button nesting: tags now use `<span>` wrapper with separate internal buttons

### Drag-Drop Ranking
- Fixed Smart List ranking: sort now compares ranks using `localeCompare` instead of returning 0
- Added drag-drop support to Smart List list view (previously only grid view)

### Bug Fixes
- Fixed `item.tags` undefined error by adding `(item.tags || [])` safety check
- Fixed PATCH API to include `tags` and `shares` relations in response
