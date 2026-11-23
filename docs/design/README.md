# Approved card-room direction

User selected the second desktop concept, requested a mobile counterpart, and approved `approved-mobile.png` on 2026-11-24. `selected-desktop.png` is the earlier palette/layout direction. These are design references, not authoritative card rules: generated text, ranks and example plays can be inaccurate.

Built-in OpenAI image generation was used, with the user's old screen photo as desktop context and the selected blue concept as the mobile reference. No subscription, external runtime or credential is needed.

## Applied guidance

- Official Anthropic frontend-design: https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md (read 2026-11-24). Subject-specific visual hierarchy, quiet typography, fewer decorative wrappers and no generic marketing hero.
- Bundled Product Design ideate and image-to-code skills: three directions, explicit user selection, mobile feedback, then implementation and visual QA.

## Implementation contract

Navy #182d45, slate #2a435c, amber #f2b44f actions/turn focus; six seats with readable counts, 18 individually selectable cards in a six-column mobile grid, two primary gameplay actions and a separate Small Tichu action. Reuse approved card artwork. Keep native language/choice controls stable and retain localized accessible labels. Desktop uses the same palette and compact rectangular table. No new account, betting or ranking system.

## Mobile generation prompt

Create ONE MOBILE redesign concept for Korean six-player Tichu card game, based ONLY on attached image's navy/slate blue and amber art direction. Portrait 390x844 aspect ratio, app content only, no phone bezel, browser bar or OS chrome. This is NOT poker, bridge or go-stop: no betting, no levels, no IMPs, no compass names, no tournament metadata. Header exact text '6T 티츄', small language icon. Compact score row 'A팀 120' 'B팀 80' '라운드 2'. Compact six player labels in two rows of three around a small slate blue trick area, alternating teams A B A B A B, two labeled 봇. Central trick has ONE card: 7 with ONE centered red heart. Keep trick area short. Then '내 카드 18장' and EXACTLY eighteen separate cards in a strict SIX COLUMNS by THREE ROWS grid with full touch targets and no overlapping cards. Each numeric card has one corner rank and exactly ONE central suit, no repeated pips anywhere. Spades/clubs blue-black, diamonds/hearts red with slight pink tint. J/Q/K have traditional human court portraits. One sparrow card with 1, dragon/phoenix/dog illustrated without text. Show clear selection border on two cards. BELOW hand: secondary '패스' and primary amber '내기' buttons. Small secondary action '스몰 티츄 100'. Bottom collapsed row '조합 안내'. Everything including all18 cards and action buttons fits within844px without scrolling. Top labels simple readable Korean sans serif. Deep navy #182d45, slate blue #2a435c, warm white cards, amber #f2b44f for turn and primary action only. Flat restrained UI, no gradient glow, no extra panels, no fake decorations. Keep card grid the largest focus. Correct Korean term 티츄, not 티추. Single polished screen, not multiple options.
