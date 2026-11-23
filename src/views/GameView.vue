<script setup lang="ts">
import { computed } from 'vue';
import { useText } from '../composables/useText';
import { useSessionStore } from '../stores/session';
import { LABEL, team } from '../game.js';
import type { RoundView } from '../types';
import PlayingCard from '../components/PlayingCard.vue';
import GameControls from '../components/GameControls.vue';
import GameRules from '../components/GameRules.vue';
const props = defineProps<{ game: RoundView }>();
const session = useSessionStore();
const { t, message, title } = useText();
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
    <section class="table" :aria-label="t('play.tableLabel')">
      <div
        v-for="(name, index) in game.names"
        :key="index"
        class="player"
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
          <b
            >{{ name || t('common.empty') }}
            <span v-if="!game.spectator && index === seat" class="you">{{
              t('common.you')
            }}</span><template v-if="game.bots?.[index]">
              · {{ t('common.bot') }}</template
            ><template v-else-if="game.offline?.[index]">
              · {{ t('play.offline') }}</template
            ></b
          ><small
            >{{ t('common.team', { team: team(index) ? 'B' : 'A' }) }} ·
            {{ t('play.cardCount', { count: game.counts[index] })
            }}<template v-if="game.calls[index]">
              ·
              {{
                t(game.calls[index] === 200 ? 'play.grand' : 'play.tichuShort')
              }}</template
            ></small
          >
        </div>
      </div>
      <div class="table-center">
        <template v-if="game.top"
          ><span class="eyebrow"
            >{{ game.names[game.last ?? 0] }} ·
            {{ t(`kind.${game.top.kind}`) }}</span
          >
          <div class="played-cards">
            <PlayingCard
              v-for="card in game.top.cards"
              :key="card.id"
              :card="card"
            />
          </div>
          <span class="table-note">{{
            game.phase === 'trick'
              ? t('play.collectWaiting')
              : t('play.passes', { count: game.passed.length })
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
      <div class="hand-heading">
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
        <button
          class="quiet"
          :disabled="!session.selected.length"
          @click="session.selected = []"
        >
          {{ t('play.clear') }}
        </button>
      </div>
      <div class="hand">
        <PlayingCard
          v-for="(card, index) in game.hand"
          :key="card.id"
          :card="card"
          :interactive="!game.spectator"
          :position="index"
          :pick="session.selected.indexOf(card.id)"
          @select="session.toggleCard"
        />
        <p v-if="!game.hand.length" class="empty-hand">
          {{ t(game.spectator ? 'play.private' : 'play.finished') }}
        </p>
      </div>
      <div class="controls"><GameControls :game="game" /></div>
    </section>
    <GameRules />
    <details class="activity">
      <summary>
        {{ t('play.history') }}
        <span>{{ message(game.log.at(-1) ?? '') }}</span>
      </summary>
      <ol>
        <li v-for="(entry, index) in game.log.slice().reverse()" :key="index">
          {{ message(entry) }}
        </li>
      </ol>
    </details>
  </main>
</template>
