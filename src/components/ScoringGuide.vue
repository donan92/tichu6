<script setup lang="ts">
import GuidePanel from './GuidePanel.vue';
import { useTranslation } from 'i18next-vue';
const { t } = useTranslation();
const sections = [
  {
    title: 'cardsTitle',
    items: ['five', 'tenKing', 'dragon', 'phoenix', 'others', 'total'],
  },
  {
    title: 'roundTitle',
    items: ['roundEnd', 'firstFour', 'fifth', 'sixth', 'dragonTrick'],
  },
  { title: 'bonusTitle', items: ['triple', 'small', 'large', 'caller'] },
  { title: 'matchTitle', items: ['matchEnd'] },
];
</script>
<template>
  <GuidePanel :title="t('scoringGuide.title')">
    <section v-for="section in sections" :key="section.title">
      <h3>{{ t(`scoringGuide.${section.title}`) }}</h3>
      <ul>
        <li v-for="item in section.items" :key="item">
          {{ t(`scoringGuide.${item}`) }}
        </li>
      </ul>
    </section>
  </GuidePanel>
</template>
