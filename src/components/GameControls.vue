<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ChoicePicker from './ChoicePicker.vue';
import { useTranslation } from 'i18next-vue';
import { beats, classify, LABEL, partners, team } from '../game.js';
import { useSessionStore } from '../stores/session';
import { combinationMessage } from '../combinations';
import { useText } from '../composables/useText';
import type { RoundView } from '../types';
const props = defineProps<{ game: RoundView }>();
const session = useSessionStore();
const { t } = useTranslation();
const { message } = useText();
const wish = ref(''),
  target = ref(''),
  phoenixRank = ref('');
const ranks = Array.from({ length: 13 }, (_, index) => index + 2);
const chosen = computed(() =>
  props.game.hand.filter((card) => session.selected.includes(card.id)),
);
const combo = computed(() =>
  classify(chosen.value, props.game.top, Number(phoenixRank.value) || null),
);
const locked = computed(() => session.pending || props.game.paused === true);
const dragon = computed(() => props.game.top?.cards[0]?.special === 'dragon');
const collecting = computed(
  () => props.game.phase === 'trick' && props.game.last === session.seat,
);
const hasMahjong = computed(() =>
  chosen.value.some((card) => card.special === 'mahjong'),
);
const hasDog = computed(() =>
  chosen.value.some((card) => card.special === 'dog'),
);
const hasPhoenix = computed(
  () =>
    chosen.value.length > 1 &&
    chosen.value.some((card) => card.special === 'phoenix'),
);
const recipients = computed(() =>
  props.game.names
    .map((name, seat) => ({ name, seat }))
    .filter(({ seat }) =>
      collecting.value && dragon.value
        ? team(seat) !== team(session.seat)
        : partners(session.seat).includes(seat),
    ),
);
watch(
  recipients,
  (values) => {
    if (!values.some((value) => String(value.seat) === target.value))
      target.value = String(values[0]?.seat ?? '');
  },
  { immediate: true },
);
watch(
  () => props.game.round,
  () => {
    wish.value = '';
    phoenixRank.value = '';
  },
);
watch(hasPhoenix, (shown) => {
  if (!shown) phoenixRank.value = '';
});
const ended = computed(() =>
  ['roundEnd', 'matchEnd'].includes(props.game.phase),
);
const heading = computed(() => {
  const game = props.game,
    seat = session.seat;
  if (game.spectator) return t('room.spectating');
  if (game.phase === 'grand')
    return t(game.ready[seat] ? 'play.grandWaiting' : 'play.grandPrompt');
  if (ended.value)
    return game.phase === 'matchEnd'
      ? t('play.winner', { team: game.scores[0] > game.scores[1] ? 'A' : 'B' })
      : t('play.roundOver');
  if (game.phase === 'exchange')
    return t(
      game.exchangeReady[seat] ? 'play.exchangeWaiting' : 'play.exchangePrompt',
    );
  if (collecting.value)
    return t(dragon.value ? 'play.dragonPrompt' : 'play.collectPrompt');
  if (game.phase === 'trick') return t('play.collectWaiting');
  return game.turn === seat
    ? t('play.yourTurn')
    : t('play.turn', { name: game.names[game.turn ?? 0] });
});
const help = computed(() => {
  const game = props.game;
  if (game.spectator) return t('play.spectatorHint');
  if (game.phase === 'grand') return t('play.grandHelp');
  if (ended.value)
    return t('play.delta', {
      a: game.delta?.[0] ?? 0,
      b: game.delta?.[1] ?? 0,
    });
  if (game.phase === 'exchange') {
    const seats = partners(session.seat);
    return t('play.exchangeHelp', {
      first: game.names[seats[0]],
      second: game.names[seats[1]],
    });
  }
  if (collecting.value) return t('play.collectHelp');
  return chosen.value.length
    ? t('play.selection', {
        count: chosen.value.length,
        kind: combo.value
          ? message(
              combinationMessage(
                combo.value,
                chosen.value.length === 1
                  ? chosen.value[0]?.special
                  : undefined,
              ),
            )
          : t('play.invalidCombo'),
      })
    : t('play.selectHint');
});
const cannotPlay = computed(
  () =>
    locked.value ||
    !combo.value ||
    !beats(combo.value, props.game.top) ||
    ((props.game.turn !== session.seat || props.game.phase === 'trick') &&
      !combo.value.bomb),
);
function play() {
  session.submit({
    type: 'play',
    ids: [...session.selected],
    wish: wish.value ? Number(wish.value) : null,
    target: Number(target.value),
    phoenixRank: Number(phoenixRank.value) || null,
  });
}
</script>
<template>
  <div class="action-message">
    <h3>{{ heading }}</h3>
    <p>{{ help }}</p>
  </div>
  <template v-if="!game.spectator">
    <div v-if="game.phase === 'grand'" class="action-buttons">
      <button
        class="accent"
        :disabled="locked || game.ready[session.seat]"
        @click="session.submit({ type: 'grand', call: true })"
      >
        {{ t('play.grandYes') }}</button><button
        class="primary"
        :disabled="locked || game.ready[session.seat]"
        @click="session.submit({ type: 'grand', call: false })"
      >
        {{ t('play.grandNo') }}
      </button>
    </div>
    <div v-else-if="ended">
      <button
        v-if="
          game.phase === 'roundEnd' &&
          (session.mode === 'demo' || session.seat === game.leader)
        "
        class="primary"
        :disabled="locked"
        @click="session.submit({ type: 'next' })"
      >
        {{ t('play.next') }}</button><button
        v-else
        class="quiet"
        @click="session.leaving = true"
      >
        {{ t('play.leave') }}
      </button>
    </div>
    <div v-else-if="game.phase === 'exchange'" class="action-buttons">
      <button
        class="quiet"
        :disabled="locked || !!game.calls[session.seat]"
        @click="session.submit({ type: 'tichu' })"
      >
        {{ t('play.tichu') }}</button><button
        class="primary"
        :disabled="
          locked ||
          game.exchangeReady[session.seat] ||
          session.selected.length !== 2
        "
        @click="
          session.submit({ type: 'exchange', ids: [...session.selected] })
        "
      >
        {{ t('play.exchange', { count: session.selected.length }) }}
      </button>
    </div>
    <div v-else-if="collecting" class="action-buttons">
      <ChoicePicker
        v-if="dragon"
        v-model="target"
        :label="t('play.recipient')"
        :disabled="locked"
        :options="
          recipients.map((recipient) => ({
            value: String(recipient.seat),
            label: recipient.name,
          }))
        "
      /><button
        class="primary"
        :disabled="locked"
        @click="session.submit({ type: 'collect', target: Number(target) })"
      >
        {{ t(dragon ? 'play.giveTrick' : 'play.collect') }}
      </button>
    </div>
    <div v-else class="action-buttons play-actions">
      <label v-if="hasMahjong"
        >{{ t('play.wish')
        }}<select id="wish" v-model="wish">
          <option value="">{{ t('play.noWish') }}</option>
          <option v-for="rank in ranks" :key="rank" :value="String(rank)">
            {{ LABEL[rank] || rank }}
          </option>
        </select></label
      >
      <ChoicePicker
        v-if="hasDog"
        v-model="target"
        :label="t('play.dogTarget')"
        :disabled="locked"
        :options="
          recipients.map((recipient) => ({
            value: String(recipient.seat),
            label: recipient.name,
          }))
        "
      />
      <label v-if="hasPhoenix"
        >{{ t('play.phoenixRank')
        }}<select id="phoenixRank" v-model="phoenixRank">
          <option value="">{{ t('play.automatic') }}</option>
          <option v-for="rank in ranks" :key="rank" :value="String(rank)">
            {{ LABEL[rank] || rank }}
          </option>
        </select></label
      >
      <button
        class="quiet"
        :disabled="
          locked || game.played[session.seat] || !!game.calls[session.seat]
        "
        @click="session.submit({ type: 'tichu' })"
      >
        {{ t('play.tichuShort') }}
      </button>
      <button
        :disabled="
          locked ||
          game.turn !== session.seat ||
          game.phase !== 'play' ||
          !game.top
        "
        @click="session.submit({ type: 'pass' })"
      >
        {{ t('play.pass') }}
      </button>
      <button class="primary" :disabled="cannotPlay" @click="play">
        {{ t(combo?.bomb ? 'play.bomb' : 'play.cards') }}
      </button>
    </div>
  </template>
</template>
