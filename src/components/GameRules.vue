<script setup lang="ts">
import GuidePanel from './GuidePanel.vue';
import { useTranslation } from 'i18next-vue';
const { t } = useTranslation();
const sections = [
  ['deckTitle', 'deck', 'bombs'],
  ['gameTitle', 'calls', 'scoring'],
  ['flowTitle', 'timers', 'history'],
  ['serverTitle', 'server', 'reconnect'],
];
</script>
<template>
  <GuidePanel :title="t('combinations.title')">
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
  </GuidePanel>
  <GuidePanel :title="t('rules.title')">
    <div class="rule-grid">
      <section v-for="[heading, first, second] in sections" :key="heading">
        <h3>{{ t(`rules.${heading}`) }}</h3>
        <p>{{ t(`rules.${first}`) }}</p>
        <p>{{ t(`rules.${second}`) }}</p>
      </section>
    </div>
  </GuidePanel>
</template>
