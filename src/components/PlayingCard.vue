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
      { special: card.special, selected: interactive && pick >= 0 },
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
        aria-hidden="true"
      />
      <svg v-else class="card-emblem" aria-hidden="true">
        <use :href="suitHref" />
      </svg>
    </template>
    <span v-if="display" class="card-bottom" aria-hidden="true">{{
      display
    }}</span>
    <span v-if="interactive && pick >= 0" class="pick" aria-hidden="true">{{
      pick + 1
    }}</span>
  </component>
</template>
