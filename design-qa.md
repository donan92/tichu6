# Approved card design QA — v0.8.1

final result: passed

## Evidence and state

- Source: `docs/design/approved-courts-mobile.png` (852×1846), plus `approved-courts-sheet.png` for all twelve portraits.
- Implementation: `docs/design/implemented-courts-mobile.jpg`, 390px-wide full-page capture from a 390×844 CSS viewport. Browser screenshots at device scale 1. Reference normalized to 390px width.
- Combined full-view and readable card-region evidence: `docs/design/courts-comparison.png`. Opened the combined image after final capture, not judged from code alone.
- Desktop: `docs/design/implemented-courts-desktop.jpg`, 1280×900, real practice exchange with 18 cards. Home screenshot: `implemented-home-desktop.jpg`.
- Mobile comparison used a temporary local fixture with the exact reference hand, score, selection and trick, rendered with production Vue components/styles. Fixture removed before build; never shipped. Reference card selection is an invalid combination, so the real Play button is correctly disabled.

## Comparison history

1. P2: Court portraits too small at narrow card widths. Enlarged art to 125% width inside clipped cards; retained text/suit indices separately.
2. P2: Generated atlas rows were not exactly evenly spaced; next-row crowns appeared at desktop card bottoms. Calibrated 350px row spacing with 362px view windows; post-fix desktop capture shows only intended portraits.
3. P2: Score row wasted mobile vertical space; team badge selectors targeted nonexistent classes. Flattened mobile score labels and used actual numeric team classes with A/B labels. Centered bordered hand heading, simplified flat cards and relocated collapsible combinations below controls.
4. Re-captured mobile and desktop, then opened normalized comparison. No remaining actionable P0/P1/P2 findings in the approved card redesign scope.

## Required fidelity surfaces

- Typography: simple sans-serif corner ranks, one top-left index, no lower inverted rank. Readable localized UI; court letters and symbols inherit identical ink. Existing application font retained.
- Layout: mobile six columns/three rows, portrait cards; compact 375×667 fallback preserves all 18 cards within document y≈591 at play. Desktop retains one centered row. No horizontal document overflow at tested mobile widths.
- Colors: flat off-white #faf9f5, blue-black #172535 for spades/clubs and red #c92e4b for hearts/diamonds, navy surfaces and amber selection. Verified computed corner colors, including heart J. Disabled primary action intentionally dims.
- Images: twelve original upright heraldic court illustrations plus four newly generated clean special illustrations. Local WebP sprites; no runtime third-party image service. No frame, yellow gradient or reversed portrait. Sparrow keeps numeric 1.
- Content: localized combinations, Small Tichu 100, Korean Play label shortened to 내기. Existing live-game status, bot/you labels, pass counts, clear-selection control, ordered exchange badges, native language picker and lounge exit retained rather than erased to mimic a static mock. Counterclockwise seat mapping retained, so reference player order differs intentionally.

## Interaction verification

- Real local practice: 10-card declaration → 18-card exchange → play with five bots.
- First/last hand-card selection, repeated deselection, ordered exchange submission.
- Combinations open by click and close with keyboard Enter; native focus retained.
- English switch and translated cards/controls; browser console errors: none.
- 390×844, 375×667 and 1280×900 browser viewports checked. Not a real iPhone Safari test.

## Follow-up polish

- The production UI includes essential turn/help text and history absent from the mock; lower guide may require scrolling on short devices. The full hand remains visible without a horizontal hand scroller.
- Generated illustrations retain minor line-detail differences from the preview; suit-specific costume, shape and color direction are preserved.
