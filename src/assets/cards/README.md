# Card artwork

Original playing-card-inspired artwork; no scans or assets from a commercial Tichu deck.

- `source/*.png`: transparent original illustrations generated with built-in OpenAI image generation on 2026-11-23. No external account or runtime image service required.
- `specials.webp`: 768×768 transparent 2×2 sprite (dragon, phoenix / dog, mahjong). Only this compressed asset ships to browsers; source PNGs remain editable source material.
- `suits.svg`: standard spade, club, diamond and heart vector symbols (stable suit IDs 0–3). Loaded as an external SVG with Vite `?no-inline` so fragment references work.
- Rendering: `src/components/PlayingCard.vue` and `src/styles/cards.css`. Identity/rank/accessible labels remain text, localized independently from artwork.

Court cards use separate generated jack/queen/king WebP illustrations; [exact prompts](COURT-PROMPTS.md). Special cards display no name or letter, while mahjong shows 1. Accessible localized names remain available.

## Rebuild

Replace the relevant transparent source PNG, then run `npm run assets:cards`. Sharp resizes each source into a 384px transparent cell and assembles the WebP. Commit source and generated sprite together. Run the usual checks and inspect normal/special cards at desktop and mobile sizes. Do not insert words into artwork; keep language packs authoritative.

## Generation prompts

Each of the four images used this complete template, substituting the name and subject below:

> Use case: stylized-concept. Asset type: original illustration for the {name} special playing card in a digital Tichu game. Subject: {subject} Style: elegant traditional playing-card engraving meets polished storybook gouache, crisp dark outlines, flat jewel colors, subtle gold decorative accents. Composition: ONE isolated full subject centered in a square, generous transparent margins, silhouette legible at 40px. No card frame, no letters, no numbers, no text, no watermark, no scene or solid background. Genuine transparent background. All details contained within center 80% of canvas.

- **dragon:** A majestic emerald-green East Asian dragon coiled into a compact elegant S curve, gold horns, warm ivory highlights, clearly readable dragon head.
- **phoenix:** A graceful vermilion and golden phoenix with raised wings and flowing turquoise tail feathers, compact balanced silhouette.
- **dog:** A friendly dignified cream Shiba-like dog sitting upright, warm ochre fur and a small deep-green collar, compact clear silhouette.
- **mahjong:** A charming small jade-green and warm brown sparrow perched on a short flowering branch, wings slightly lifted, compact clear silhouette.
