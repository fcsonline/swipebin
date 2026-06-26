# 🗑️ SwipeBin

A Tinder-style photo culling app. Mount a folder of pictures, then **swipe right to keep** and **swipe left to delete** — one image at a time, on your phone or desktop.

- **Reversible deletes** — "deleted" images are moved into a `.trash/` folder inside your photo directory, never destroyed. An **Undo** button (or the `Z` key) restores the last one.
- **Reads everything** — JPEG, PNG, WebP, GIF, TIFF, HEIC/HEIF, AVIF **and RAW** (CR2, CR3, NEF, ARW, RAF, ORF, RW2, DNG, PEF, SRW, and more). RAW files are previewed by extracting their embedded JPEG with `dcraw`, so it's fast.
- **Remembers your decisions** — reviewed images don't come back, even after a restart.
- **Runs anywhere** — one Docker container, one mounted volume.

## Screenshots

<p align="center">
  <img src="docs/screenshot-swipe.png" width="250" alt="Swipe a photo left to delete or right to keep" />
  <img src="docs/screenshot-done.png" width="250" alt="End screen with kept/deleted stats" />
  <img src="docs/screenshot-trash.png" width="250" alt="Empty trash confirmation dialog" />
</p>

On startup the container prints the URL **and a QR code** — scan it to open the deck on your phone:

<p align="center">
  <img src="docs/screenshot-terminal.png" width="600" alt="Startup banner showing the URL and a scannable QR code" />
</p>

## Quick start (Docker)

1. Put the photos you want to triage in a `./photos` folder next to `docker-compose.yml` (subfolders are scanned recursively):

   ```bash
   mkdir -p photos
   cp /path/to/your/pictures/* photos/
   ```

2. Build and run:

   ```bash
   docker compose up --build
   ```

3. The container prints a banner with the URL **and a QR code** — open it:

   ```
   SwipeBin ready — 1,284 images found, 0 reviewed
     ➜ Local:   http://localhost:3000
     ➜ Network: http://192.168.1.42:3000

   📱 Scan to open on your phone:
     █▀▀▀▀▀█ ▀▄█ ▄ █▀▀▀▀▀█
     █ ███ █ ▀█▀▀▄ █ ███ █
     █ ▀▀▀ █ █▀ ▀▀ █ ▀▀▀ █
     ▀▀▀▀▀▀▀ █ ▀ █ ▀▀▀▀▀▀▀
     ... (full QR) ...
   ```

   Open `http://localhost:3000` on this machine, or **scan the QR code** (or open the `Network` URL) from your phone on the same Wi-Fi, and start swiping.

   > **Phone access:** inside Docker the auto-detected IP is the *container's*, which phones can't reach. For a scannable address, pass your computer's LAN IP:
   >
   > ```bash
   > PUBLIC_HOST=192.168.1.42 docker compose up --build
   > ```
   >
   > (find it with `ipconfig getifaddr en0` on macOS, or `hostname -I` on Linux). The QR and Network URL then point at the host.

### What happens on swipe

| Gesture | Action | Effect on disk |
| --- | --- | --- |
| Swipe **right** / Keep / `→` | Keep | File stays put, marked reviewed (won't reappear) |
| Swipe **left** / Delete / `←` | Delete | File moved to `photos/.trash/<same path>` |
| Undo button / `Z` | Undo last | Restores the last delete; un-reviews a keep |

To permanently free space, delete the `photos/.trash/` folder yourself once you're happy. To recover something, it's all sitting in `.trash/`.

## Configuration

Set via environment variables (see `docker-compose.yml`):

| Var | Default | Meaning |
| --- | --- | --- |
| `IMAGES_DIR` | `/data/images` | Folder of images to triage (mount your photos here) |
| `APP_DIR` | `/data/app` | Where `state.json` and the preview cache live |
| `PORT` | `3000` | HTTP port |
| `PREVIEW_WIDTH` | `1080` | Max width (px) of generated previews |
| `PUBLIC_HOST` | _(auto)_ | Host/IP used for the Network URL + QR code (set to your LAN IP in Docker) |
| `PUBLIC_URL` | _(auto)_ | Full external URL for the Network line + QR (overrides `PUBLIC_HOST`) |

State and the preview cache persist in the `swipebin-data` named volume, so your progress and generated previews survive restarts.

## Local development

Requires Node 20+ and `dcraw` on your PATH (`brew install dcraw` / `apt-get install dcraw`) for RAW support.

```bash
npm install
mkdir -p photos && cp /some/pictures/* photos/   # IMAGES_DIR defaults to ./photos in dev
npm run dev
```

- API + static server: http://localhost:3000
- Vite dev server (hot reload, proxies `/api`): http://localhost:5173

## How it works

```
photos volume ──► /data/images   (source images + .trash)
data volume   ──► /data/app       (state.json + preview cache)
                       ▲
   browser ◄─ React SPA ┤ Express :3000 ── sharp (standard) / dcraw (RAW)
```

- **Backend** — Node + Express (TypeScript). Recursively scans `IMAGES_DIR`, serves a review queue, generates web-safe JPEG previews on demand (cached), and records keep/delete decisions in an atomic JSON store.
- **Frontend** — React + Vite (TypeScript) with `framer-motion` drag gestures for the swipe deck.
- **RAW** — `dcraw -e` extracts the embedded preview (fast); falls back to a full `dcraw` demosaic only when no embedded preview exists. The result is piped through `sharp` for resizing and orientation.

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/queue?limit=20` | Next undecided images |
| `GET` | `/api/images/:id/preview?w=1080` | Web-safe JPEG preview (cached) |
| `POST` | `/api/images/:id/decision` | Body `{ "action": "keep" \| "delete" }` |
| `POST` | `/api/undo` | Revert the last decision |
| `GET` | `/api/stats` | `{ total, reviewed, kept, deleted, remaining }` |

## License

MIT
