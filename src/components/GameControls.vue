<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import TurnClock from './TurnClock.vue';
import ActionConfirm from './ActionConfirm.vue';
import PlayingCard from './PlayingCard.vue';
import { useTranslation } from 'i18next-vue';
import { beats, classify, legalPlays, LABEL, partners, team } from '../game.js';
import { useSessionStore } from '../stores/session';
import { combinationMessage } from '../combinations';
import { useText } from '../composables/useText';
import type { GameAction, RoundView } from '../types';
const props = defineProps<{ game: RoundView }>();
const session = useSessionStore();
const { t } = useTranslation();
const { message } = useText();
const phoenixRank = ref('');
const ranks = Array.from({ length: 13 }, (_, index) => index + 2);
const chosen = computed(() =>
  props.game.hand.filter((card) => session.selected.includes(card.id)),
);
const exchangeDraft = computed(() =>
  session.selected
    .map((id, index) => ({
      card: props.game.hand.find((card) => card.id === id),
      name: props.game.names[partners(session.seat)[index]],
    }))
    .filter((entry) => entry.card),
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
    )
    .filter(
      ({ seat }) =>
        props.game.counts[seat] > 0 ||
        (collecting.value
          ? props.game.counts.every(
              (count, i) => team(i) === team(session.seat) || count === 0,
            )
          : partners(session.seat).every((i) => props.game.counts[i] === 0)),
    ),
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
  if (collecting.value)
    return t(dragon.value ? 'play.autoDragonHelp' : 'play.autoCollectHelp');
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
const wishBombRequired = computed(
  () =>
    !props.game.spectator &&
    props.game.phase === 'play' &&
    props.game.turn === session.seat &&
    !!props.game.top?.bomb &&
    !!props.game.wish &&
    legalPlays(props.game.hand, props.game.top, props.game.wish).some(
      (option) => option.play.bomb,
    ),
);
const cannotPlay = computed(
  () =>
    locked.value ||
    !combo.value ||
    !beats(combo.value, props.game.top) ||
    ((props.game.turn !== session.seat || props.game.phase === 'trick') &&
      !combo.value.bomb),
);
type ChoiceKind = 'dog' | 'wish' | 'dragon';
const confirmation = ref<{
  action: GameAction;
  description: string;
  kind?: ChoiceKind;
  choice: string | null;
} | null>(null);
const choiceOptions = computed(() =>
  confirmation.value?.kind === 'wish'
    ? [
        { value: '', label: t('play.noWish') },
        ...ranks.map((rank) => ({
          value: String(rank),
          label: String(LABEL[rank] || rank),
        })),
      ]
    : recipients.value.map((recipient) => ({
        value: String(recipient.seat),
        label: recipient.name,
      })),
);
const confirmationText = computed(() => {
  const pending = confirmation.value;
  if (!pending) return '';
  if (!pending.kind || pending.choice === null) return pending.description;
  return pending.kind === 'wish'
    ? t('play.confirmWish', {
        rank: pending.choice
          ? LABEL[Number(pending.choice)] || pending.choice
          : t('play.noWish'),
      })
    : t(pending.kind === 'dog' ? 'play.confirmDog' : 'play.confirmDragon', {
        name: props.game.names[Number(pending.choice)],
      });
});
function requestConfirmation(
  action: GameAction,
  description: string,
  kind?: ChoiceKind,
) {
  if (locked.value) return;
  confirmation.value = { action, description, kind, choice: null };
}
const pendingCall = ref<100 | 200 | null>(null);
function requestCall(call: 100 | 200, event: MouseEvent) {
  (event.currentTarget as HTMLButtonElement).focus();
  if (locked.value) return;
  pendingCall.value = call;
  if (props.game.callConfirmUsed?.[session.seat]) openCall();
  else session.submit({ type: 'prepareCall', call });
}
function openCall() {
  const call = pendingCall.value;
  if (call == null) return;
  pendingCall.value = null;
  requestConfirmation(
    call === 200 ? { type: 'grand', call: true } : { type: 'tichu' },
    t(call === 200 ? 'play.confirmLarge' : 'play.confirmSmall'),
  );
}
watch(
  () => [props.game.callConfirmUsed?.[session.seat], locked.value],
  () => {
    if (
      pendingCall.value &&
      props.game.callConfirmUsed?.[session.seat] &&
      !locked.value
    )
      openCall();
  },
  { flush: 'post' },
);
function confirmAction() {
  const pending = confirmation.value;
  if (!pending || locked.value || (pending.kind && pending.choice === null))
    return;
  const action = pending.action;
  if (pending.kind === 'wish' && action.type === 'play')
    action.wish = pending.choice ? Number(pending.choice) : null;
  else if (
    (action.type === 'play' || action.type === 'collect') &&
    pending.kind
  )
    action.target = Number(pending.choice);
  session.submit(action);
}
// Compare semantic values, not freshly deserialized snapshot objects.
// Presence/alarm broadcasts must not discard a recipient or wish selection.
watch(
  [
    () => props.game.phase,
    () => props.game.round,
    () => JSON.stringify(props.game.top),
    () => props.game.hand.map((card) => card.id).join(','),
    () => props.game.turn,
    () => props.game.last,
    () => props.game.wish,
    () => props.game.calls[session.seat],
    () => session.seat,
    () => session.selected.join(','),
  ],
  () => {
    confirmation.value = null;
  },
);

function collect(event: MouseEvent) {
  (event.currentTarget as HTMLButtonElement)?.focus();
  const action: GameAction = { type: 'collect' };
  if (dragon.value) requestConfirmation(action, t('play.recipient'), 'dragon');
  else session.submit(action);
}
function play(event: MouseEvent) {
  (event.currentTarget as HTMLButtonElement)?.focus();
  if (props.game.dogPending === session.seat) {
    requestConfirmation(
      { type: 'play', ids: ['dog'] },
      t('play.dogTarget'),
      'dog',
    );
    return;
  }
  if (cannotPlay.value) return;
  const action: GameAction = {
    type: 'play',
    ids: [...session.selected],
    phoenixRank: Number(phoenixRank.value) || null,
  };
  if (combo.value?.bomb) session.submit(action);
  else if (hasDog.value) session.submit({ type: 'prepareDog' });
  else if (hasMahjong.value)
    requestConfirmation(action, t('play.wish'), 'wish');
  else if (chosen.value.some((card) => card.special === 'dragon'))
    requestConfirmation(action, t('play.confirmDragonPlay'));
  else
    requestConfirmation(
      action,
      t('play.confirmCombination', {
        kind: message(combinationMessage(combo.value!)),
        count: chosen.value.length,
      }),
    );
}
watch(
  () => [props.game.dogPending, props.game.revision, locked.value],
  () => {
    if (
      props.game.dogPending === session.seat &&
      !locked.value &&
      !confirmation.value
    )
      requestConfirmation(
        { type: 'play', ids: ['dog'] },
        t('play.dogTarget'),
        'dog',
      );
  },
  { immediate: true, flush: 'post' },
);
</script>
<template>
  <ActionConfirm
    v-if="confirmation"
    :description="confirmationText"
    :disabled="locked || (!!confirmation.kind && confirmation.choice === null)"
    @cancel="confirmation = null"
    @confirm="confirmAction"
  >
    <TurnClock
      v-if="confirmation.kind === 'dog' || confirmation.kind === 'dragon'"
      :deadline="game.deadline"
      :duration="game.deadlineDuration"
      :phase="game.phase"
    />
    <div
      v-if="confirmation.kind"
      class="special-choices"
      :class="{ ranks: confirmation.kind === 'wish' }"
    >
      <button
        v-for="option in choiceOptions"
        :key="option.value"
        type="button"
        :aria-pressed="confirmation.choice === option.value"
        @click="confirmation.choice = option.value"
      >
        {{ option.label }}
      </button>
    </div>
  </ActionConfirm>
  <div class="action-message">
    <h3>{{ heading }}</h3>
    <p>{{ help }}</p>
    <p v-if="wishBombRequired" role="status">
      {{ t('play.wishBombRequired', { rank: LABEL[game.wish!] || game.wish }) }}
    </p>
  </div>
  <template v-if="!game.spectator">
    <div v-if="game.phase === 'grand'" class="action-buttons">
      <button
        class="accent"
        :disabled="locked || game.ready[session.seat]"
        @click="requestCall(200, $event)"
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
    <div v-else-if="game.phase === 'exchange'" class="exchange-actions">
      <p>
        {{
          t(
            game.exchangeReady[session.seat]
              ? 'play.exchangeLocked'
              : 'play.exchangeEditable',
          )
        }}
      </p>
      <div class="exchange-draft">
        <div v-for="(entry, index) in exchangeDraft" :key="index">
          <span>{{ entry.name }}</span><PlayingCard
            v-if="entry.card"
            :card="entry.card"
          />
        </div>
      </div>
      <div class="action-buttons">
        <button
          class="quiet"
          :disabled="locked || !session.selected.length"
          @click="session.selected = []"
        >
          {{ t('play.exchangeReselect') }}
        </button>
        <button
          class="quiet"
          :disabled="locked || !!game.calls[session.seat]"
          @click="requestCall(100, $event)"
        >
          {{ t('play.tichu') }}</button><button
          class="primary"
          :disabled="locked || session.selected.length !== 2"
          @click="
            session.submit({ type: 'exchange', ids: [...session.selected] })
          "
        >
          {{ t('play.exchangeConfirm', { count: session.selected.length }) }}
        </button>
      </div>
    </div>
    <div v-else-if="collecting" class="action-buttons">
      <button class="primary" :disabled="locked" @click="collect">
        {{ t(dragon ? 'play.giveTrick' : 'play.collect') }}
      </button>
    </div>
    <div v-else class="action-buttons play-actions">
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
        @click="requestCall(100, $event)"
      >
        {{ t('play.tichuShort') }}
      </button>
      <button
        class="primary"
        :disabled="cannotPlay && game.dogPending !== session.seat"
        @click="play"
      >
        {{ t(combo?.bomb ? 'play.bomb' : 'play.cards') }}
      </button>
    </div>
  </template>
</template>

<style scoped>
.special-choices {
  display: grid;
  gap: 8px;
}
.special-choices.ranks {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.special-choices button {
  margin: 0;
  min-height: 44px;
}
.special-choices button[aria-pressed='true'] {
  border-color: #efb64e;
  color: #efb64e;
}
</style>
