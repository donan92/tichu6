<script setup lang="ts">
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
  <details class="scoring-guide">
    <summary>{{ t('scoringGuide.title') }}</summary>
    <section v-for="section in sections" :key="section.title">
      <h3>{{ t(`scoringGuide.${section.title}`) }}</h3>
      <ul>
        <li v-for="item in section.items" :key="item">
          {{ t(`scoringGuide.${item}`) }}
        </li>
      </ul>
    </section>
  </details>
</template>
<style scoped>
.scoring-guide {
  margin-top: 24px;
  padding: 16px 0;
  border-top: 1px solid var(--line);
  overflow-wrap: anywhere;
}
summary {
  font-size: 18px;
}
h3 {
  margin: 20px 0 8px;
  font-size: 16px;
}
ul {
  margin: 0;
  padding-left: 20px;
  line-height: 1.7;
}
li + li {
  margin-top: 6px;
}
</style>
