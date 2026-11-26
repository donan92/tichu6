<script setup lang="ts">
import { useText } from '../composables/useText';
import type { RoundView } from '../types';
defineProps<{ game: RoundView }>();
const { t, message } = useText();
</script>
<template>
  <details class="activity guide-panel">
    <summary>
      {{ t('play.currentTrick') }}
    </summary>
    <ol>
      <li v-for="(entry, index) in game.log" :key="index">
        {{ message(entry) }}
      </li>
    </ol>
    <p v-if="game.phase !== 'matchEnd'">{{ t('play.historyLocked') }}</p>
  </details>
  <section
    v-if="game.phase === 'matchEnd' && game.trickHistory?.length"
    class="match-history"
  >
    <h3>{{ t('play.matchHistory') }}</h3>
    <details
      v-for="trick in game.trickHistory"
      :key="`${trick.round}-${trick.trick}`"
      class="activity guide-panel"
    >
      <summary>
        {{ t('play.trickLabel', { round: trick.round, trick: trick.trick }) }}
      </summary>
      <ol>
        <li v-for="(entry, index) in trick.entries" :key="index">
          {{ message(entry) }}
        </li>
      </ol>
    </details>
  </section>
</template>
