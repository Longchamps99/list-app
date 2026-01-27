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
