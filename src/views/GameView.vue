<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useText } from '../composables/useText';
import { useSessionStore } from '../stores/session';
import { LABEL, team } from '../game.js';
import type { RoundView } from '../types';
import { combinationMessage, sortCombinationCards } from '../combinations';
import ExchangeReview from '../components/ExchangeReview.vue';
import PlayingCard from '../components/PlayingCard.vue';
import HandCards from '../components/HandCards.vue';
import PassAction from '../components/PassAction.vue';
import DeclarationNotice from '../components/DeclarationNotice.vue';
import GameControls from '../components/GameControls.vue';
import TurnClock from '../components/TurnClock.vue';
import TrickHistory from '../components/TrickHistory.vue';
import GameRules from '../components/GameRules.vue';
const props = defineProps<{ game: RoundView }>();
const session = useSessionStore();
const { t, message, title } = useText();
const dragonRecipient = ref<number | null>(null);
let dragonTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => JSON.stringify(props.game.dragonTransfer),
  (value, previous) => {
    if (value === previous) return;
    clearTimeout(dragonTimer);
    const transfer = props.game.dragonTransfer;
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
      <div class="score">
        <span class="team-a"
          >{{ t('common.team', { team: 'A' }) }}
          <b>{{ game.scores[0] }}</b></span
        ><i>:</i
        ><span class="team-b"
          ><b>{{ game.scores[1] }}</b>
          {{ t('common.team', { team: 'B' }) }}</span
        >
      </div>
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
    <TurnClock
      :deadline="game.deadline"
      :phase="game.phase"
      :reconnect-until="game.reconnectUntil"
      :duration="game.deadlineDuration"
      :can-extend="
        !game.spectator &&
        game.turn === session.seat &&
        !game.extensionUsed &&
        game.dogPending == null &&
        !session.pending &&
        !game.paused
      "
      @extend="session.submit({ type: 'extendTime' })"
    />
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
        <div class="avatar" :class="`team-${team(index)}`">
          {{
            game.finish.includes(index)
              ? t('play.finish', { place: game.finish.indexOf(index) + 1 })
              : team(index)
                ? 'B'
                : 'A'
          }}
        </div>
        <div>
          <b :class="{ 'dragon-recipient': dragonRecipient === index }"
            >{{ name || t('common.empty') }}
            <span v-if="!game.spectator && index === seat" class="you">{{
              t('common.you')
            }}</span><template v-if="game.bots?.[index]">
              · {{ t('common.bot') }}</template
            ><template v-else-if="game.offline?.[index]">
              · {{ t('play.offline') }}</template
            ></b
          ><small
            >{{ t('common.team', { team: team(index) ? 'B' : 'A' }) }}
            <span class="pass-slot"
              ><span v-if="game.passed.includes(index)" class="pass-badge">{{
                t('play.passed')
              }}</span></span
            >
            · {{ t('play.cardCount', { count: game.counts[index] })
            }}<template v-if="game.calls[index]">
              ·
              {{
                t(game.calls[index] === 200 ? 'play.grand' : 'play.tichuShort')
              }}</template
            ></small
          >
          <span
            v-if="dragonRecipient === index"
            class="dragon-received"
            role="status"
            >{{ t('play.dragonReceived') }}</span
          >
          <span
            v-if="game.phase === 'play' && game.turn === index"
            class="turn-indicator"
            >{{ t('play.currentTurn') }}</span
          >
        </div>
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
      <PassAction
        v-if="
          !game.spectator && game.phase === 'play' && game.turn === session.seat
        "
        :game="game"
      />
      <div v-else class="hand-heading">
        <div>
          <b
            >{{ t(game.spectator ? 'play.spectatorView' : 'play.hand') }}
            <span
              >{{ t('play.cardCount', { count: game.hand.length })
              }}<template v-if="game.phase === 'grand'">
                / {{ t('play.initialHand') }}</template
              ></span
            ></b
          >
        </div>
      </div>
      <HandCards
        :hand="game.hand"
        :spectator="game.spectator"
        :round-key="`${game.roomId ?? 'practice'}:${game.round}`"
      />
      <div class="controls"><GameControls :game="game" /></div>
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
  </main>
</template>
