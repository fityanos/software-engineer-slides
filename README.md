# Animated Slides from Text

Turn any text into animated slides with live preview and exports to PNG (ZIP) and PPTX.

## Quick start

```bash
npm install
# Run frontend only:
npm run dev

# Or run backend proxy and frontend together (recommended):
cp .env.example .env   # then set OPENAI_API_KEY
npm run dev:full
```

Open the printed localhost URL (usually http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview
```

## Notes

- If PPTX fonts don't look like Montserrat on another machine, PowerPoint may substitute. Change `fontFace` in `App.jsx` to a built-in font like `Arial` for guaranteed availability.
- For clean PNG exports, stop autoplay or increase the delay in `exportPNGs()`.
- To enable OpenAI-backed generation, run the proxy server (see above) and configure `OPENAI_API_KEY` in `.env`. The frontend will call `POST /api/story` on `http://localhost:8787`.
