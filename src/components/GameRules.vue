<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
const { t } = useTranslation();
const sections = [
  ['deckTitle', 'deck', 'bombs'],
  ['gameTitle', 'calls', 'scoring'],
  ['serverTitle', 'server', 'reconnect'],
];
</script>
<template>
  <details class="rules">
    <summary>{{ t('rules.title') }}</summary>
    <div class="rule-grid">
      <section v-for="[heading, first, second] in sections" :key="heading">
        <h3>{{ t(`rules.${heading}`) }}</h3>
        <p>{{ t(`rules.${first}`) }}</p>
        <p>{{ t(`rules.${second}`) }}</p>
      </section>
    </div>
  </details>
</template>
