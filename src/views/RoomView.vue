<script setup lang="ts">
import { useText } from '../composables/useText';
import { useSessionStore } from '../stores/session';
import { team } from '../game.js';
import GameRules from '../components/GameRules.vue';
const session = useSessionStore();
const { t, title, message } = useText();
</script>
<template>
  <main v-if="session.game" class="lobby">
    <div class="page-heading">
      <div>
        <span class="eyebrow">{{
          t(session.game.spectator ? 'room.spectating' : 'room.yours')
        }}</span>
        <h1>{{ title(session.game.title) || t('connection.connecting') }}</h1>
        <p>
          {{ t(session.game.spectator ? 'room.watchHint' : 'room.startHint') }}
        </p>
      </div>
      <span class="counter"
        >{{ session.online.filter(Boolean).length }}<small> / 6</small></span
      >
    </div>
    <p v-if="session.connectionError" class="warning" role="alert">
      {{ message(session.connectionError) }}
    </p>
    <section class="panel">
      <h2>{{ t('room.seats') }}</h2>
      <div class="roster">
        <div v-for="(_, index) in 6" :key="index" class="roster-row">
          <span class="avatar" :class="`team-${team(index)}`">{{
            index + 1
          }}</span>
          <div>
            <b>{{ session.game.names[index] || t('common.empty') }}</b><small
              >{{ t('common.team', { team: team(index) ? 'B' : 'A' })
              }}<template v-if="index === session.game.leader">
                · {{ t('common.coordinator') }}</template
              ><template v-if="index === session.seat">
                · {{ t('common.you') }}</template
              ></small
            >
          </div>
          <span class="seat-status">{{
            t(session.online[index] ? 'common.online' : 'common.waiting')
          }}</span>
        </div>
      </div>
      <button
        v-if="!session.game.spectator && session.seat === session.game.leader"
        class="primary wide"
        :disabled="
          !session.online.every(Boolean) ||
          !session.connected ||
          session.pending
        "
        @click="session.submit({ type: 'start' })"
      >
        {{ t('room.start') }}
      </button>
    </section>
    <GameRules />
  </main>
</template>
