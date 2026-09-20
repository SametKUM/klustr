# syntax=docker/dockerfile:1

# The build context is the repository root (see compose.yaml): the site renders
# the user guides from docs/guide, which sits beside site/ in the checkout, so
# the layout inside the image mirrors it and the guide loader needs no override.
FROM node:25-alpine AS build
WORKDIR /repo/site

COPY site/package.json site/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY docs/guide/ /repo/docs/guide/
COPY site/ ./

# The changelog page and the version label come from the GitHub Releases API.
# A token lifts the anonymous rate limit; without one the build still succeeds
# and those pages fall back to linking GitHub.
RUN --mount=type=secret,id=github_token \
    GITHUB_TOKEN="$(cat /run/secrets/github_token 2>/dev/null || true)" npm run build

FROM joseluisq/static-web-server:2.44.0-alpine AS serve
COPY --from=build /repo/site/dist/ /public/

ENV SERVER_PORT=8080 \
    SERVER_ROOT=/public \
    SERVER_ERROR_PAGE_404=/public/404.html \
    SERVER_COMPRESSION=true \
    SERVER_CACHE_CONTROL_HEADERS=true \
    SERVER_DIRECTORY_LISTING=false \
    SERVER_REDIRECT_TRAILING_SLASH=true \
    SERVER_HEALTH=true \
    SERVER_LOG_LEVEL=warn

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:8080/health || exit 1
