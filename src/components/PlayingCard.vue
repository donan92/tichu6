<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import { LABEL } from '../game.js';
import type { Card } from '../types';
import suitsUrl from '../assets/cards/suits.svg?no-inline';
const props = withDefaults(
  defineProps<{
    card: Card;
    interactive?: boolean;
    pick?: number;
    position?: number;
  }>(),
  { interactive: false, pick: -1, position: -1 },
);
const emit = defineEmits<{ select: [id: string] }>();
const { t } = useTranslation();
const suits = ['spade', 'club', 'diamond', 'heart'];
const suitHref = computed(() => `${suitsUrl}#${suits[props.card.suit]}`);
const isCourt = computed(
  () => !props.card.special && props.card.rank >= 11 && props.card.rank <= 13,
);
// Visible portrait bounds in the approved 1086×1448 atlas (rows are 350px apart).
// Crop only transparent padding; preserve a 3px antialias margin on every side.
const courtBounds = [
  [
    [72, 30, 265, 313],
    [41, 32, 267, 311],
    [13, 34, 279, 309],
  ],
  [
    [67, 30, 271, 310],
    [44, 29, 263, 311],
    [14, 21, 276, 319],
  ],
  [
    [72, 27, 272, 307],
    [40, 17, 271, 317],
    [12, 17, 283, 317],
  ],
  [
    [64, 16, 276, 321],
    [41, 11, 270, 326],
    [15, 11, 284, 326],
  ],
];
const courtStyle = computed(() => {
  const row = [0, 1, 3, 2][props.card.suit] ?? 0;
  const column = props.card.rank - 11;
  const [x, y, w, h] = courtBounds[row][column] ?? [0, 0, 362, 350];
  const width = w + 6,
    height = h + 6;
  return {
    aspectRatio: `${width} / ${height}`,
    backgroundSize: `${(1086 / width) * 100}% ${(1448 / height) * 100}%`,
    backgroundPosition: `${((column * 362 + x - 3) / (1086 - width)) * 100}% ${((row * 350 + y - 3) / (1448 - height)) * 100}%`,
  };
});
// Standard two-column pip layouts; lower-half symbols face the opposite way.
const pipLayouts: Record<number, [number, number][]> = {
  2: [
    [50, 44],
    [50, 120],
  ],
  3: [
    [50, 44],
    [50, 82],
    [50, 120],
  ],
  4: [
    [28, 44],
    [72, 44],
    [28, 120],
    [72, 120],
  ],
  5: [
    [28, 44],
    [72, 44],
    [50, 82],
    [28, 120],
    [72, 120],
  ],
  6: [
    [28, 44],
    [72, 44],
    [28, 82],
    [72, 82],
    [28, 120],
    [72, 120],
  ],
  7: [
    [28, 44],
    [72, 44],
    [50, 63],
    [28, 82],
    [72, 82],
    [28, 120],
    [72, 120],
  ],
  8: [
    [28, 44],
    [72, 44],
    [50, 63],
    [28, 82],
    [72, 82],
    [50, 101],
    [28, 120],
    [72, 120],
  ],
  9: [
    [28, 44],
    [72, 44],
    [50, 56.5],
    [28, 69],
    [72, 69],
    [28, 95],
    [72, 95],
    [28, 120],
    [72, 120],
  ],
  10: [
    [28, 44],
    [72, 44],
    [50, 56.5],
    [28, 69],
    [72, 69],
    [28, 95],
    [72, 95],
    [50, 107.5],
    [28, 120],
    [72, 120],
  ],
};
const pips = computed(() => pipLayouts[props.card.rank] ?? []);
const rank = computed(() => LABEL[props.card.rank] ?? props.card.rank);
const display = computed(() =>
  props.card.special
    ? props.card.special === 'mahjong'
      ? '1'
      : ''
    : rank.value,
);
const label = computed(() => {
  const card = props.card.special
    ? t(`card.${props.card.special}`)
    : t('card.label', {
        suit: t(`card.suit.${props.card.suit}`),
        rank: rank.value,
      });
  return props.position >= 0
    ? t('card.position', { card, position: props.position + 1 })
    : card;
});
</script>
<template>
  <component
    :is="interactive ? 'button' : 'div'"
    class="card"
    :class="[
      `suit-${card.suit}`,
      {
        special: card.special,
        court: isCourt,
        selected: interactive && pick >= 0,
      },
      card.special ? `special-${card.special}` : '',
    ]"
    :aria-label="label"
    :aria-pressed="interactive ? pick >= 0 : undefined"
    @click="interactive && emit('select', card.id)"
  >
    <span v-if="display" class="card-corner" aria-hidden="true">
      {{ display }}
      <svg v-if="isCourt" class="suit-icon"><use :href="suitHref" /></svg>
    </span>
    <span v-if="card.special" class="special-art" aria-hidden="true" />
    <template v-else>
      <span
        v-if="isCourt"
        class="court-art"
        :class="`court-${card.rank}`"
        :style="courtStyle"
        aria-hidden="true"
      />
      <svg
        v-else-if="pips.length"
        class="card-pips"
        viewBox="0 0 100 140"
        aria-hidden="true"
      >
        <use
          v-for="([x, y], index) in pips"
          :key="index"
          :href="suitHref"
          :x="x - 11"
          :y="y - 11"
          width="22"
          height="22"
          :transform="y > 82 ? `rotate(180 ${x} ${y})` : undefined"
        />
      </svg>
      <svg v-else class="card-emblem" aria-hidden="true">
        <use :href="suitHref" />
      </svg>
    </template>
    <span v-if="interactive && pick >= 0" class="pick" aria-hidden="true">{{
      pick + 1
    }}</span>
  </component>
</template>
