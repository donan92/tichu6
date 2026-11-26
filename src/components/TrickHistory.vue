<script setup lang="ts">
import GuidePanel from './GuidePanel.vue';
import { useText } from '../composables/useText';
import type { RoundView } from '../types';
defineProps<{ game: RoundView }>();
const { t, message } = useText();
</script>
<template>
  <GuidePanel :title="t('play.currentTrick')">
    <ol>
      <li v-for="(entry, index) in game.log" :key="index">
        {{ message(entry) }}
      </li>
    </ol>
    <p v-if="game.phase !== 'matchEnd'">{{ t('play.historyLocked') }}</p>
  </GuidePanel>
  <section
    v-if="game.phase === 'matchEnd' && game.trickHistory?.length"
    class="match-history"
  >
    <h3>{{ t('play.matchHistory') }}</h3>
    <GuidePanel
      v-for="trick in game.trickHistory"
      :key="`${trick.round}-${trick.trick}`"
      :title="t('play.trickLabel', { round: trick.round, trick: trick.trick })"
    >
      <ol>
        <li v-for="(entry, index) in trick.entries" :key="index">
          {{ message(entry) }}
        </li>
      </ol>
    </GuidePanel>
  </section>
</template>
