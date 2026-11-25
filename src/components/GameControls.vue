<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ActionConfirm from './ActionConfirm.vue';
import PlayingCard from './PlayingCard.vue';
import ChoicePicker from './ChoicePicker.vue';
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
const wish = ref(''),
  target = ref(''),
  phoenixRank = ref('');
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
function chooseDragon(value: string) {
  if (collecting.value && dragon.value)
    requestConfirmation(
      { type: 'dragonTarget', target: Number(value) },
      t('play.confirmDragon', { name: props.game.names[Number(value)] }),
    );
}
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
  () => [props.game.phase, props.game.last, props.game.dragonTarget],
  () => {
    if (collecting.value && dragon.value)
      target.value = String(props.game.dragonTarget ?? (session.seat + 1) % 6);
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
const confirmation = ref<{ action: GameAction; description: string } | null>(
  null,
);
function requestConfirmation(action: GameAction, description: string) {
  if (locked.value) return;
  confirmation.value = { action, description };
}
function confirmAction() {
  const pending = confirmation.value;
  confirmation.value = null;
  if (!pending || locked.value) return;
  if (pending.action.type === 'dragonTarget')
    target.value = String(pending.action.target);
  session.submit(pending.action);
}
watch(
  () => [
    props.game.revision,
    props.game.phase,
    props.game.turn,
    session.seat,
    locked.value,
    session.selected.join(','),
  ],
  () => {
    confirmation.value = null;
  },
);
function collect(event: MouseEvent) {
  (event.currentTarget as HTMLButtonElement)?.focus();
  const action: GameAction = { type: 'collect', target: Number(target.value) };
  if (dragon.value)
    requestConfirmation(
      action,
      t('play.confirmDragon', { name: props.game.names[Number(target.value)] }),
    );
  else session.submit(action);
}
function play(event: MouseEvent) {
  (event.currentTarget as HTMLButtonElement)?.focus();
  if (cannotPlay.value) return;
  const action: GameAction = {
    type: 'play',
    ids: [...session.selected],
    wish: wish.value ? Number(wish.value) : null,
    target: Number(target.value),
    phoenixRank: Number(phoenixRank.value) || null,
  };
  if (hasDog.value)
    requestConfirmation(
      action,
      t('play.confirmDog', { name: props.game.names[Number(target.value)] }),
    );
  else if (hasMahjong.value)
    requestConfirmation(
      action,
      t('play.confirmWish', {
        rank: wish.value
          ? LABEL[Number(wish.value)] || wish.value
          : t('play.noWish'),
      }),
    );
  else if (chosen.value.some((card) => card.special === 'dragon'))
    requestConfirmation(action, t('play.confirmDragonPlay'));
  else session.submit(action);
}
</script>
<template>
  <ActionConfirm
    v-if="confirmation"
    :description="confirmation.description"
    @cancel="confirmation = null"
    @confirm="confirmAction"
  />
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
          @click="session.submit({ type: 'tichu' })"
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
      <ChoicePicker
        v-if="dragon"
        :model-value="target"
        :label="t('play.recipient')"
        :disabled="locked"
        :options="
          recipients.map((recipient) => ({
            value: String(recipient.seat),
            label: recipient.name,
          }))
        "
        @update:model-value="chooseDragon"
      /><button class="primary" :disabled="locked" @click="collect">
        {{ t(dragon ? 'play.giveTrick' : 'play.collect') }}
      </button>
    </div>
    <div v-else class="action-buttons play-actions">
      <ChoicePicker
        v-if="hasMahjong"
        v-model="wish"
        compact
        :label="t('play.wish')"
        :disabled="locked"
        :options="[
          { value: '', label: t('play.noWish') },
          ...ranks.map((rank) => ({
            value: String(rank),
            label: String(LABEL[rank] || rank),
          })),
        ]"
      />
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
