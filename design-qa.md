# Navy card-room design QA

- Source visual truth: `docs/design/approved-mobile.png` (852×1846; proportionally equivalent to 390×844 CSS px), selected by the user after reviewing the navy desktop direction.
- Implementation: browser-rendered Vite production preview at http://127.0.0.1:4173/, in-app browser tab 49. Screenshots are inline in the task transcript; this browser capture surface did not return a filesystem screenshot path.
- Viewports: 390×844, 375×667 and 1280×900 CSS px. No device chrome. Compare proportional app regions, not source raster pixel density.
- States: initial ten-card declaration, eighteen-card exchange, selected cards, post-exchange play, active turn, home and bottom combination guide.

## Findings and comparison history

- Fixed: initial implementation placed Small Tichu beside both main play actions. It now follows the two main actions on its own mobile row, matching the approved hierarchy.
- Fixed: text review caught a broad replacement corrupting 108/18 in Korean explanatory copy. Exact deck counts restored before release.
- Typography: native Korean-capable sans-serif; compact names and counts remain legible. The reference's large labels were reduced to accommodate actual eight-character nicknames, seat counts and phase guidance.
- Layout: six seats in two rows around compact slate playing area, six-column/three-row hand; at 375×667 all eighteen cards end at y=561 with scrollY=0, no horizontal overflow. At 390×844 hand and exchange controls fit. Desktop uses a compact rectangular playing area and one-row hand.
- Colors: navy #182d45, slate #2a435c, amber #f2b44f and blue team differentiation. No table gradient or decorative hero orbit.
- Images: existing user-approved suit/court/special assets reused. One central suit on numeric cards, illustrated J/Q/K, no printed special names, sparrow 1 retained. Generated draft inaccuracies are not copied.
- Content: 티츄, 라지 티츄/스몰 티츄, ten plus eight cards, localized combinations. Actual actions remain phase-aware and disabled when illegal.
- Intentional differences: footer guide is expanded for easy reference; history remains below play controls; existing language selector and back-to-lounge action retained. These support the user's functional requests rather than adding draft-only features (rankings, betting or IMPs).
- Full-view evidence: inline 390px mobile exchange/play captures and 1280px desktop exchange capture. Focused hand/controls were legible in the mobile captures, so no separate crop was necessary.

## Interaction checks

Practice start → ten cards → no Large call → eighteen cards → first/last card selection → exchange → active play. Bots labeled explicitly. No browser console errors. Unit/UI tests cover native control stability and localized selection semantics; real local Worker integration covers capacity, privacy, bots and reconnects.

## Follow-up limits

Actual iPhone Safari and touch hardware were not available; desktop viewport checks do not constitute real-device testing. Illustration scaling and type may be refined after user feedback.

final result: passed
