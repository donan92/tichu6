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
  <section class="combination-guide" aria-labelledby="combinations-title">
    <h2 id="combinations-title">{{ t('combinations.title') }}</h2>
    <ul>
      <li
        v-for="kind in [
          'single',
          'pair',
          'triple',
          'fullhouse',
          'straight',
          'pairs',
          'bomb',
        ]"
        :key="kind"
      >
        {{ t(`combinations.${kind}`) }}
      </li>
    </ul>
    <p>{{ t('combinations.compare') }}</p>
  </section>
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

<style scoped>
.combination-guide {
  margin: 24px 0;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}
.combination-guide h2 {
  font-size: 18px;
}
.combination-guide ul {
  padding-left: 20px;
  line-height: 1.8;
}
.combination-guide p {
  line-height: 1.6;
}
</style>
