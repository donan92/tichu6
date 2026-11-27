<script setup lang="ts">
import { onMounted, watchEffect, ref } from 'vue';
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
import ConnectionLoading from './components/ConnectionLoading.vue';
import TrainingConsent from './components/TrainingConsent.vue';
import { useGameAudio } from './composables/useGameAudio';
import PrivateInvite from './components/PrivateInvite.vue';
const sharing = ref(false);
useGameAudio();
const session = useSessionStore();
const { t, i18next } = useTranslation();
const { message } = useText();
watchEffect(() => {
  document.title = t('app.title');
  document.documentElement.lang = i18next.resolvedLanguage ?? 'en';
});
onMounted(() => {
  if (!session.pendingInvite && session.restorePractice()) return;
  const saved = savedRoom();
  if (saved && !saved.idle && session.nickname) void session.enterHall(false);
});
</script>
<template>
  <ConnectionLoading v-if="session.restoring" />
  <template v-else>
    <AppHeader />
    <div
      v-if="session.game?.inviteCode && !session.game.spectator"
      class="private-share"
    >
      <button @click="sharing = true">{{ t('private.copyLink') }}</button>
      <PrivateInvite
        v-if="sharing"
        :code="session.game.inviteCode"
        @close="sharing = false"
      />
    </div>
    <TrainingConsent v-if="session.mode === 'hall'" />
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
</template>
