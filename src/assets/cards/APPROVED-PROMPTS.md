# Approved court and special artwork (2026-11-24)

Built-in image generation produced these original sprites using the user-approved
mobile mock and court sheet in `docs/design/approved-courts-*.png` as visual
references. No runtime image service or external assets are required.

## Court atlas

Source `source/courts-approved.png`, 1086×1448 RGBA. Columns J/Q/K;
rows spade/club/heart/diamond. Visible rows are spaced 350px apart, with 362px
view windows; the renderer compensates for generated spacing rather than allowing
the following row to bleed into a card. Persisted suit IDs remain unchanged.

Prompt:

> Use case: background-extraction. Production web-game sprite asset. Edit the supplied approved court design sheet into ONE transparent PNG illustration atlas. Preserve exactly these twelve original court characters' faces, poses, costumes, colors, strong dark outlines and flat geometric heraldic style. Remove all white card rectangles, navy background, rounded card corners, rank letters and corner suit index symbols. Retain suit motifs integrated into clothing/crowns. Layout: exactly THREE columns and FOUR rows of equally sized square invisible cells, no gutters, no outer margins; total canvas aspect 3:4, ideally 1200x1600. Columns left-to-right JACK, QUEEN, KING. Rows top-to-bottom SPADES (navy/gold, sword), CLUBS (green/gold, staff), HEARTS (red/gold, rose), DIAMONDS (rust/gold, jewel). Within EACH equal cell center the single upright half-body portrait, full hat/crown and held object visible, no inverted reflected figures. Portrait silhouette must occupy about 88% of cell width and 88% of cell height, with consistent 6% transparent safety space on all four sides, aligned to a common baseline. No overlap between cells. Preserve opaque white areas INSIDE figures, e.g. faces, hair and white fabric; only background outside silhouettes is alpha transparent. No text, letters, labels, index symbols, card frames, grid lines, drop shadows, gradients, numbers, watermark or new objects. This sprite will be shown using CSS background-size 300% 400%, so all cell boundaries must be regular. Transparent background required.

## Special atlas

Source `source/specials-approved.png`, 1254×1254 RGBA, four equal cells.
Delivered WebP 768×768. Dragon/phoenix top row; dog/sparrow bottom row.

Prompt:

> Use case: background-extraction and game sprite production. Use the attached approved mobile game image as the exact visual reference for FOUR special-card illustrations in the hand's bottom row. Produce ONE transparent PNG SPRITE SHEET, square canvas, exact 2 columns by 2 rows of equal square cells: TOP LEFT green curled Chinese dragon; TOP RIGHT red-orange phoenix with wings lifted and curling tail; BOTTOM LEFT cream-colored friendly sitting dog; BOTTOM RIGHT brown sparrow perched on a short leafy twig. Faithfully preserve the reference's clean outlined illustrated style, simple flat warm colors, elegant shapes, readable silhouette and facial character. Simplify no further and do not substitute generic icons. Recreate only these four animals, removing all card backgrounds and all other game UI. Entire background must be genuine alpha transparency, not white, not checkerboard. Each figure centered inside its own equal quadrant, fills about 78% of its cell width/height, with at least 10% transparent padding on all sides; no part crosses a quadrant boundary. All four have similar visual weight. No text, no numbers, no card frames, no shadows, no gradients, no halos, no suit symbols, no extra elements beyond the sparrow twig. Keep complete limbs, tails and wings. The sprite is a production game asset to be split into four equally sized cells.
