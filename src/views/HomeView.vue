<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import { useSessionStore } from '../stores/session';
import NicknameInput from '../components/NicknameInput.vue';
import PlayingCard from '../components/PlayingCard.vue';
import GameRules from '../components/GameRules.vue';
import { version } from '../../package.json';
import type { Card } from '../types';
const { t } = useTranslation();
const session = useSessionStore();
const samples: Card[] = [
  { id: 'hero-a', rank: 14, suit: 0 },
  { id: 'hero-p', rank: 15, suit: -1, special: 'phoenix' },
  { id: 'hero-d', rank: 16, suit: -1, special: 'dragon' },
];
</script>
<template>
  <main class="landing">
    <section class="hero">
      <div>
        <span class="eyebrow">{{ t('home.eyebrow') }}</span>
        <h1>{{ t('home.headline') }}</h1>
        <p class="hero-copy">{{ t('home.description') }}</p>
        <div class="hero-tags">
          <span v-for="key in ['teams', 'public', 'install']" :key="key">{{
            t(`home.${key}`)
          }}</span>
        </div>
      </div>
      <div class="hero-cards" aria-hidden="true">
        <PlayingCard v-for="card in samples" :key="card.id" :card="card" /><span
          class="orbit"
          >A · B · A · B · A · B</span
        >
      </div>
    </section>
    <section class="entry">
      <div class="entry-title">
        <h2>{{ t('home.seat') }}</h2>
      </div>
      <form class="entry-form" @submit.prevent="session.enterHall">
        <NicknameInput v-model="session.nickname" label="home.nickname" />
        <div class="entry-actions">
          <button class="primary" type="submit" :disabled="session.busy">
            {{
              t(session.busy ? 'connection.connecting' : 'home.enter')
            }}</button><button
            class="quiet"
            type="button"
            @click="session.startPractice"
          >
            {{ t('home.practice') }}
          </button>
        </div>
        <p class="muted">{{ t('home.capacity') }}</p>
      </form>
    </section>
    <GameRules />
    <footer>6T · v{{ version }} · {{ t('app.footer') }}</footer>
  </main>
</template>
