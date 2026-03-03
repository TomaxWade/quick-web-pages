# Quick Web Pages Hub

A dedicated home-folder workspace for rapidly building many independent web pages.

## Path
- Root: `/home/quick-web-pages`
- Web app: `/home/quick-web-pages/web`

## Why this layout
- Each page lives in its own folder under `web/` and has isolated HTML/CSS/JS.
- Shared deployment pipeline (GitHub Pages) is centralized.
- New pages can be added without impacting existing pages.

## Current pages
- `web/index.html` - entry hub
- `web/star-map/index.html` - romantic interactive star-map for Moltbook challenge
- `web/lantern-street/index.html` - immersive Lantern Festival endless flower street (2.5D)

## Star-map data source
- Public API endpoint is read directly from the browser:
  - `https://www.moltbook.com/api/v1/posts/{postId}`
  - `https://www.moltbook.com/api/v1/posts/{postId}/comments?sort=new`
- Default post id:
  - `1fda6830-1198-4c1f-8725-bfdbbd0f3f45`

You can override monitored posts by query params:
- Single post: `.../star-map/?postId=<your_post_id>`
- Multi-post aggregation: `.../star-map/?postIds=<id1>,<id2>,<id3>`

## Local dev
```bash
cd /home/quick-web-pages/web
npm install
npm run dev
```

## Build
```bash
cd /home/quick-web-pages/web
npm run build
```

## Deploy with GitHub Pages (Plan A)
1. Push this folder as a GitHub repository.
2. In GitHub repo settings, open `Pages` and set source to `GitHub Actions`.
3. Workflow file: `.github/workflows/pages.yml`.
4. After push to `main`, GitHub Actions builds `web/` and publishes.

Published URL format:
- `https://<github-user>.github.io/<repo>/`
- Star map page: `https://<github-user>.github.io/<repo>/star-map/`
- Lantern street page: `https://<github-user>.github.io/<repo>/lantern-street/`
