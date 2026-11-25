<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useText } from '../composables/useText';
import { useSessionStore } from '../stores/session';
import { team } from '../game.js';
import GameRules from '../components/GameRules.vue';
const session = useSessionStore();
const { t, title, message } = useText();
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval>;
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 250);
});
onUnmounted(() => clearInterval(timer));
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
          {{
            t(
              session.game.spectator
                ? 'room.watchHint'
                : session.game.teamMode === 'manual'
                  ? 'room.manualHint'
                  : 'room.startHint',
            )
          }}
        </p>
      </div>
      <span class="counter"
        >{{
          session.game.participantCount ??
          session.online.filter(Boolean).length
        }}<small> / 6</small></span
      >
    </div>
    <p v-if="session.connectionError" class="warning" role="alert">
      {{ message(session.connectionError) }}
    </p>
    <section class="panel">
      <h2>{{ t('room.teamMode') }}</h2>
      <div class="mode-buttons">
        <button
          v-for="mode in ['random', 'manual'] as const"
          :key="mode"
          :aria-pressed="session.game.teamMode === mode"
          :disabled="
            !session.game.isHost || session.pending || !session.connected
          "
          @click="session.submit({ type: 'teamMode', mode })"
        >
          {{ t(mode === 'random' ? 'room.randomMode' : 'room.manualMode') }}
        </button>
      </div>
      <p v-if="session.game.autoStartAt" role="status">
        {{
          t('room.autoStarting', {
            seconds: Math.max(
              0,
              Math.ceil((session.game.autoStartAt - now) / 1000),
            ),
          })
        }}
      </p>
      <template v-if="session.game.teamMode === 'manual'">
        <h2>{{ t('room.waitingSeats') }}</h2>
        <p v-for="(player, index) in session.game.waitingPlayers" :key="index">
          {{ player.name }} <span v-if="player.own">{{ t('common.you') }}</span>
        </p>
        <button
          v-if="!session.game.spectator"
          :disabled="
            session.pending ||
            !session.connected ||
            session.game.assignedSeat === -1
          "
          @click="session.submit({ type: 'chooseSeat', target: -1 })"
        >
          {{ t('room.moveToWaiting') }}
        </button>
      </template>
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
              ><template
                v-if="index === (session.game.assignedSeat ?? session.seat)"
              >
                · {{ t('common.you') }}</template
              ></small
            >
          </div>
          <button
            v-if="session.game.teamMode === 'manual' && !session.game.spectator"
            :disabled="
              !!session.game.names[index] ||
              session.pending ||
              !session.connected
            "
            @click="session.submit({ type: 'chooseSeat', target: index })"
          >
            {{ t('room.takeSeat') }}
          </button>
          <span class="seat-status">{{
            t(session.online[index] ? 'common.online' : 'common.waiting')
          }}</span>
        </div>
      </div>
      <button
        v-if="
          session.game.isHost &&
          session.game.teamMode !== 'manual' &&
          !session.game.autoStartAt
        "
        class="primary wide"
        :disabled="!session.connected || session.pending"
        @click="session.submit({ type: 'start' })"
      >
        {{ t('room.start') }}
      </button>
    </section>
    <GameRules />
  </main>
</template>

<style scoped>
.counter {
  flex-shrink: 0;
  white-space: nowrap;
}
.page-heading > div {
  min-width: 0;
}
.mode-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.mode-buttons button[aria-pressed='true'] {
  border-color: #efb64e;
  color: #efb64e;
}
</style>
