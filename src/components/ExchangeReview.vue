<script setup lang="ts">
import { useText } from '../composables/useText';
import { LABEL } from '../game.js';
import type { Card, ExchangeReview } from '../types';
defineProps<{ entries: ExchangeReview[]; names: string[] }>();
const { t } = useText();
function cardName(card: Card) {
  return card.special
    ? t(`card.${card.special}`)
    : t('card.label', {
        suit: t(`card.suit.${card.suit}`),
        rank: LABEL[card.rank] ?? card.rank,
      });
}
</script>
<template>
  <aside class="exchange-review" :aria-label="t('exchange.reviewTitle')">
    <b>{{ t('exchange.reviewTitle') }}</b>
    <div class="exchange-review-partners">
      <div
        v-for="entry in entries"
        :key="entry.partner"
        class="exchange-review-partner"
      >
        <strong>{{ names[entry.partner] }}</strong>
        <span
          >{{ t('exchange.sent') }}:
          {{ entry.sent ? cardName(entry.sent) : t('exchange.waiting') }}</span
        >
        <span
          >{{ t('exchange.received') }}:
          {{
            entry.received ? cardName(entry.received) : t('exchange.waiting')
          }}</span
        >
      </div>
    </div>
    <small>{{ t('exchange.reviewHint') }}</small>
  </aside>
</template>
