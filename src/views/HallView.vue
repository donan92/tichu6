<script setup lang="ts">
import { useText } from '../composables/useText';
import { useSessionStore } from '../stores/session';
import NicknameInput from '../components/NicknameInput.vue';
import GameRules from '../components/GameRules.vue';
const { t, title, message } = useText();
const session = useSessionStore();
</script>
<template>
  <main class="lobby">
    <div class="page-heading">
      <div>
        <span class="eyebrow">{{ t('lounge.label') }}</span>
        <h1>{{ t('lounge.title') }}</h1>
        <p>{{ t('lounge.capacity') }}</p>
      </div>
      <span class="counter"
        >{{ session.directory.count }}<small> / 30</small></span
      >
    </div>
    <p v-if="session.connectionError" class="warning" role="alert">
      {{ message(session.connectionError) }}
    </p>
    <section class="panel hall-tools">
      <NicknameInput
        v-model="session.nickname"
        label="lounge.nickname"
      /><button
        class="primary"
        :disabled="!session.connected || session.directory.rooms.length >= 5"
        @click="session.createRoom"
      >
        {{ t('lounge.createRoom') }}</button
      ><span>{{
        t('lounge.roomCount', { count: session.directory.rooms.length })
      }}</span>
    </section>
    <section class="panel practice-entry" aria-labelledby="practice-title">
      <div>
        <h2 id="practice-title">{{ t('practice.title') }}</h2>
        <p class="muted">{{ t('practice.description') }}</p>
      </div>
      <button type="button" @click="session.startPractice">
        {{ t('home.practice') }}
      </button>
    </section>
    <div class="room-list">
      <article
        v-for="room in session.directory.rooms"
        :key="room.id"
        class="panel room-tile"
      >
        <span class="eyebrow"
          >{{ t(`phase.${room.phase}`) }} ·
          {{ t('common.round', { round: room.round }) }}</span
        >
        <h2>{{ title(room.title) }}</h2>
        <p>
          {{
            t('lounge.roomMembers', {
              players: room.players,
              online: room.online,
              spectators: room.spectators,
            })
          }}
        </p>
        <p>
          {{ t('common.team', { team: 'A' }) }} {{ room.scores[0] }} :
          {{ room.scores[1] }} {{ t('common.team', { team: 'B' }) }}
        </p>
        <div class="entry-actions">
          <button
            class="primary"
            :disabled="
              !session.connected ||
              (!room.mine && (room.phase !== 'lobby' || room.players >= 6))
            "
            @click="session.joinRoom(room.id)"
          >
            {{ t(room.mine ? 'lounge.rejoin' : 'lounge.join') }}</button><button
            :disabled="!session.connected"
            @click="session.joinRoom(room.id, true)"
          >
            {{ t('lounge.watch') }}
          </button>
        </div>
      </article>
      <section v-if="!session.directory.rooms.length" class="panel empty-rooms">
        <h2>{{ t('lounge.emptyTitle') }}</h2>
        <p>{{ t('lounge.emptyDescription') }}</p>
      </section>
    </div>
    <p class="muted">{{ t('lounge.hint') }}</p>
    <GameRules />
  </main>
</template>
