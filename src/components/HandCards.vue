<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import { useTranslation } from 'i18next-vue';
import { sortCards } from '../game.js';
import { useSessionStore } from '../stores/session';
import type { Card } from '../types';
import PlayingCard from './PlayingCard.vue';
const props = defineProps<{
  hand: Card[];
  roundKey: string;
  spectator?: boolean;
}>();
const session = useSessionStore();
const { t } = useTranslation();
const order = ref<string[] | null>(null);
const dragging = ref(false);
let suppressClickUntil = 0;
const cards = computed({
  get() {
    const sorted = sortCards(props.hand);
    if (!order.value) return sorted;
    const byId = new Map(sorted.map((card) => [card.id, card]));
    return [
      ...order.value.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
      ...sorted.filter((card) => !order.value!.includes(card.id)),
    ];
  },
  set(value: Card[]) {
    order.value = value.map((card) => card.id);
  },
});
watch(
  () => props.roundKey,
  () => {
    order.value = null;
  },
);
watch(
  () => props.hand.map((card) => card.id).join(','),
  () => {
    if (order.value)
      order.value = order.value.filter((id) =>
        props.hand.some((card) => card.id === id),
      );
  },
);
function endDrag() {
  dragging.value = false;
  suppressClickUntil = Date.now() + 250;
}
function select(id: string) {
  if (!dragging.value && Date.now() >= suppressClickUntil)
    session.toggleCard(id);
}
function move(id: string, offset: number) {
  if (props.spectator || session.pending) return;
  const list = [...cards.value];
  const from = list.findIndex((card) => card.id === id),
    to = from + offset;
  if (from < 0 || to < 0 || to >= list.length) return;
  [list[from], list[to]] = [list[to], list[from]];
  cards.value = list;
}
</script>
<template>
  <div v-if="!spectator && hand.length" class="hand-tools">
    <button
      class="quiet"
      :disabled="!session.selected.length"
      @click="session.selected = []"
    >
      {{ t('play.clear') }}
    </button>
    <button
      class="quiet"
      :disabled="order === null || dragging"
      @click="order = null"
    >
      {{ t('play.resetSort') }}
    </button>
  </div>
  <VueDraggable
    v-model="cards"
    class="hand"
    :animation="120"
    :delay="220"
    :delay-on-touch-only="true"
    :touch-start-threshold="5"
    :fallback-tolerance="5"
    :disabled="spectator || session.pending || hand.length < 2"
    draggable=".card"
    ghost-class="hand-drag-ghost"
    @start="dragging = true"
    @end="endDrag"
  >
    <PlayingCard
      v-for="(card, index) in cards"
      :key="card.id"
      :card="card"
      :interactive="!spectator"
      :position="index"
      :pick="session.selected.indexOf(card.id)"
      :title="t('play.dragHandHint')"
      @select="select"
      @keydown.alt.left.prevent="move(card.id, -1)"
      @keydown.alt.right.prevent="move(card.id, 1)"
    />
    <p v-if="!hand.length" class="empty-hand">
      {{ t(spectator ? 'play.private' : 'play.finished') }}
    </p>
  </VueDraggable>
</template>
<style scoped>
.hand-tools {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}
.hand-tools button {
  min-height: 36px;
  padding: 6px 10px;
  font-size: 12px;
}
.hand :deep(.card) {
  -webkit-touch-callout: none;
}
.hand :deep(.hand-drag-ghost) {
  opacity: 0.35;
  outline: 2px dashed var(--lime);
}
</style>
