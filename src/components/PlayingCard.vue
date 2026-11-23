<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import { LABEL } from '../game.js';
import type { Card } from '../types';
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
const suits = ['◆', '♠', '●', '✦'];
const icons = { mahjong: '雀', dog: '犬', phoenix: '鳳', dragon: '龍' };
const rank = computed(() => LABEL[props.card.rank] ?? props.card.rank);
const display = computed(() =>
  props.card.special ? t(`card.short.${props.card.special}`) : rank.value,
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
    ]"
    :aria-label="label"
    :aria-pressed="interactive ? pick >= 0 : undefined"
    @click="interactive && emit('select', card.id)"
  >
    <span class="card-corner"
      >{{ display
      }}<small>{{ card.special ? '6T' : suits[card.suit] }}</small></span
    >
    <span class="card-symbol">{{
      card.special ? icons[card.special] : suits[card.suit]
    }}</span>
    <span class="card-bottom">{{ display }}</span><span
      v-if="interactive && pick >= 0"
      class="pick"
      >{{ pick + 1 }}</span
    >
  </component>
</template>
