<script setup lang="ts">
import { onMounted, watchEffect } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useSessionStore } from './stores/session';
import { savedRoom } from './server-room';
import { useText } from './composables/useText';
import AppHeader from './components/AppHeader.vue';
import LeaveDialog from './components/LeaveDialog.vue';
import HomeView from './views/HomeView.vue';
import HallView from './views/HallView.vue';
import RoomView from './views/RoomView.vue';
import GameView from './views/GameView.vue';
import TrainingConsent from './components/TrainingConsent.vue';
const session = useSessionStore();
const { t, i18next } = useTranslation();
const { message } = useText();
watchEffect(() => {
  document.title = t('app.title');
  document.documentElement.lang = i18next.resolvedLanguage ?? 'en';
});
onMounted(() => {
  if (session.restorePractice()) return;
  const saved = savedRoom();
  if (saved && !saved.idle && session.nickname) void session.enterHall(false);
});
</script>
<template>
  <AppHeader />
  <TrainingConsent />
  <HomeView v-if="session.mode === 'home'" />
  <HallView v-else-if="session.mode === 'hall'" />
  <GameView v-else-if="session.round" :game="session.round" />
  <RoomView v-else />
  <LeaveDialog v-if="session.leaving" />
  <div
    id="notice"
    role="status"
    aria-live="polite"
    :class="{ show: session.notice }"
  >
    {{ message(session.notice) }}
  </div>
</template>
