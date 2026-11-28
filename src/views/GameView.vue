<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useText } from '../composables/useText';
import { useSessionStore } from '../stores/session';
import { LABEL, team } from '../game.js';
import type { RoundView } from '../types';
import { combinationMessage, sortCombinationCards } from '../combinations';
import ExchangeReview from '../components/ExchangeReview.vue';
import PlayingCard from '../components/PlayingCard.vue';
import ScoreHistory from '../components/ScoreHistory.vue';
import HandCards from '../components/HandCards.vue';
import DeclarationNotice from '../components/DeclarationNotice.vue';
import GameControls from '../components/GameControls.vue';
import TrickHistory from '../components/TrickHistory.vue';
import GameRules from '../components/GameRules.vue';
import ScoringGuide from '../components/ScoringGuide.vue';
const smallCallTarget = ref<HTMLElement | null>(null);
const props = defineProps<{ game: RoundView }>();
const session = useSessionStore();
const { t, message, title } = useText();
const dragonRecipient = ref<number | null>(null);
const receivedKind = ref<'dragon' | 'dog'>('dragon');
let dragonTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => [
    JSON.stringify(props.game.dragonTransfer),
    JSON.stringify(props.game.dogTransfer),
  ],
  (value, previous) => {
    if (value[0] === previous[0] && value[1] === previous[1]) return;
    clearTimeout(dragonTimer);
    receivedKind.value = value[1] !== previous[1] ? 'dog' : 'dragon';
    const transfer =
      receivedKind.value === 'dog'
        ? props.game.dogTransfer
        : props.game.dragonTransfer;
    dragonRecipient.value =
      transfer?.round === props.game.round ? transfer.recipient : null;
    dragonTimer = setTimeout(() => {
      dragonRecipient.value = null;
    }, 5000);
  },
);
watch(
  () => props.game.round,
  () => {
    clearTimeout(dragonTimer);
    dragonRecipient.value = null;
  },
);
onBeforeUnmount(() => clearTimeout(dragonTimer));
const seat = computed(() => Math.max(0, session.seat));
const trickStarter = computed(() =>
  props.game.top && ['play', 'trick'].includes(props.game.phase)
    ? props.game.trickStarter
    : null,
);
const tableNote = computed(() =>
  props.game.phase === 'grand'
    ? 'play.goodLuck'
    : props.game.phase === 'exchange'
      ? 'play.share'
      : ['roundEnd', 'matchEnd'].includes(props.game.phase)
        ? 'play.waitRound'
        : 'play.lead',
);
</script>
<template>
  <main class="game">
    <DeclarationNotice :game="game" />
    <div class="game-bar">
      <div>
        <span class="eyebrow">{{
          session.mode === 'demo'
            ? t('connection.practice')
            : game.spectator
              ? t('room.spectating')
              : title(game.title)
        }}</span>
        <h2>
          {{ t('common.round', { round: game.round }) }}
          <span>{{ t('play.target') }}</span>
        </h2>
      </div>
      <ScoreHistory :game="game" />
    </div>
    <div v-if="game.paused" class="warning" role="alert">
      {{ t('connection.restoring') }}
    </div>
    <div
      v-if="game.calls.some(Boolean)"
      class="declarations"
      aria-live="polite"
    >
      <span v-for="(call, index) in game.calls" :key="index">
        <strong
          v-if="call"
          :class="team(index) ? 'played-team-b' : 'played-team-a'"
        >
          {{ game.names[index] }} ·
          {{ t(call === 200 ? 'play.grand' : 'play.tichuShort') }}
        </strong>
      </span>
    </div>
    <section class="table" :aria-label="t('play.tableLabel')">
      <div
        v-for="(name, index) in game.names"
        :key="index"
        class="player"
        :aria-current="
          game.phase === 'play' && game.turn === index ? 'true' : undefined
        "
        :class="[
          `pos-${(seat - index + 6) % 6}`,
          { active: game.phase === 'play' && game.turn === index },
        ]"
      >
        <div
          class="avatar"
          :class="`team-${team(index)}`"
          :aria-label="t('common.team', { team: team(index) ? 'B' : 'A' })"
        >
          {{
            game.finish.includes(index)
              ? t('play.finish', { place: game.finish.indexOf(index) + 1 })
              : team(index)
                ? 'B'
                : 'A'
          }}
        </div>
        <div class="player-identity">
          <b
            :title="name || t('common.empty')"
            :class="{ 'dragon-recipient': dragonRecipient === index }"
          >
            {{ name || t('common.empty') }}
            <span v-if="!game.spectator && index === seat" class="you">{{
              t('common.you')
            }}</span>
          </b>
          <span v-if="game.passed.includes(index)" class="pass-badge">{{
            t('play.passed')
          }}</span>
        </div>
        <div class="player-counts">
          <span class="player-hand-count" :title="t('play.handCountLabel')">
            <span>{{ t('play.handCountShort') }}</span><strong>{{
              game.counts[index]
            }}</strong>
          </span>
          <span
            class="player-captured-count"
            :title="t('play.capturedCountLabel')"
          >
            <span>{{ t('play.capturedCountShort') }}</span><strong>{{
              game.capturedCounts?.[index] ?? t('play.countUnavailable')
            }}</strong>
          </span>
        </div>
        <small
          v-if="
            game.bots?.[index] ||
            game.offline?.[index] ||
            game.calls[index] ||
            trickStarter === index
          "
          class="player-meta"
        >
          <span v-if="game.bots?.[index]">{{ t('common.bot') }}</span>
          <span v-else-if="game.offline?.[index]">{{ t('play.offline') }}</span>
          <span
            v-if="trickStarter === index"
            class="trick-starter-badge"
            :title="t('play.trickStarterDescription')"
            >{{ t('play.trickStarter') }}</span
          >
          <span v-if="game.calls[index]">{{
            t(game.calls[index] === 200 ? 'play.grand' : 'play.tichuShort')
          }}</span>
        </small>
        <span
          v-if="dragonRecipient === index"
          class="dragon-received"
          role="status"
        >
          {{
            t(
              receivedKind === 'dog'
                ? 'play.dogReceived'
                : 'play.dragonReceived',
            )
          }}
        </span>
        <span
          v-if="game.phase === 'play' && game.turn === index"
          class="turn-indicator"
          >{{ t('play.currentTurn') }}</span
        >
      </div>
      <div class="table-center">
        <template v-if="game.top"
          ><span
            class="eyebrow played-by"
            :class="team(game.last ?? 0) ? 'played-team-b' : 'played-team-a'"
            >{{
              t('play.playedBy', {
                name: game.names[game.last ?? 0],
                team: team(game.last ?? 0) ? 'B' : 'A',
              })
            }}
            ·
            {{
              message(
                combinationMessage(
                  game.top,
                  game.top.cards.length === 1
                    ? game.top.cards[0]?.special
                    : undefined,
                ),
              )
            }}</span
          >
          <div
            class="played-cards"
            :style="{
              '--played-columns': Math.min(9, game.top.cards.length),
              '--played-rows': Math.ceil(game.top.cards.length / 9),
              '--played-mobile-columns': Math.min(6, game.top.cards.length),
            }"
          >
            <PlayingCard
              v-for="card in sortCombinationCards(game.top)"
              :key="card.id"
              :card="card"
            />
          </div>
          <span class="table-note">{{
            game.phase === 'trick'
              ? t('play.collectWaiting')
              : t('play.turn', { name: game.names[game.turn ?? 0] })
          }}</span></template
        ><template v-else
          ><div class="table-mark">6T</div>
          <p class="table-note">{{ t(tableNote) }}</p></template
        ><span v-if="game.wish" class="wish-badge">{{
          t('play.wishRank', { rank: LABEL[game.wish] || game.wish })
        }}</span>
      </div>
    </section>
    <section class="hand-panel">
      <div class="controls hand-controls">
        <GameControls :game="game" :small-call-target="smallCallTarget" />
      </div>
      <HandCards
        :hand="game.hand"
        :spectator="game.spectator"
        :round-key="`${game.roomId ?? 'practice'}:${game.round}`"
      />
      <div ref="smallCallTarget" class="hand-secondary-actions" />
    </section>
    <ExchangeReview
      v-if="!game.spectator && game.exchangeReview?.length"
      :entries="game.exchangeReview"
      :names="game.names"
    />
    <GameRules />
    <section v-if="game.callResults?.length" class="call-results">
      <h3>{{ t('play.callResults') }}</h3>
      <p v-for="result in game.callResults" :key="result.seat">
        {{ game.names[result.seat] }} ·
        {{ t(result.call === 200 ? 'play.grand' : 'play.tichuShort') }} ·
        {{ t(result.success ? 'play.callSuccess' : 'play.callFailure') }}
        <strong>{{ result.delta > 0 ? '+' : '' }}{{ result.delta }}</strong>
      </p>
    </section>
    <TrickHistory :game="game" />
    <ScoringGuide />
  </main>
</template>
