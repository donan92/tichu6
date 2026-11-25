<script setup lang="ts">
import { computed, ref, useId, useTemplateRef, onBeforeUnmount } from 'vue';
import { useTranslation } from 'i18next-vue';
import type { RoundView } from '../types';
const props = defineProps<{ game: RoundView }>();
const { t } = useTranslation();
const id = useId();
const opened = ref(false);
const trigger = useTemplateRef<HTMLButtonElement>('trigger');
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const history = computed(() => props.game.scoreHistory ?? []);
const missing = computed(() => {
  const completed =
    props.game.round -
    (['roundEnd', 'matchEnd'].includes(props.game.phase) ? 0 : 1);
  return completed > history.value.length;
});
const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
function open() {
  dialog.value?.showModal();
  opened.value = true;
}
function close() {
  dialog.value?.close();
  opened.value = false;
  trigger.value?.focus({ preventScroll: true });
}
onBeforeUnmount(() => {
  if (opened.value) dialog.value?.close();
});
</script>
<template>
  <button
    ref="trigger"
    type="button"
    class="score score-trigger"
    :aria-label="t('score.open')"
    aria-haspopup="dialog"
    :aria-expanded="opened"
    :aria-controls="id"
    @click="open"
  >
    <span class="team-a"
      >{{ t('common.team', { team: 'A' }) }} <b>{{ game.scores[0] }}</b></span
    ><i>:</i
    ><span class="team-b"
      ><b>{{ game.scores[1] }}</b> {{ t('common.team', { team: 'B' }) }}</span
    >
  </button>
  <Teleport to="body">
    <dialog
      :id="id"
      ref="dialog"
      class="score-dialog"
      :aria-labelledby="`${id}-title`"
      @cancel.prevent="close"
      @click="$event.target === $event.currentTarget && close()"
    >
      <section>
        <h2 :id="`${id}-title`">{{ t('score.title') }}</h2>
        <p v-if="missing">{{ t('score.missing') }}</p>
        <p v-else-if="!history.length">{{ t('score.empty') }}</p>
        <table v-if="history.length">
          <thead>
            <tr>
              <th scope="col">{{ t('score.round') }}</th>
              <th scope="col">{{ t('common.team', { team: 'A' }) }}</th>
              <th scope="col">{{ t('common.team', { team: 'B' }) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in history" :key="entry.round">
              <th scope="row">{{ entry.round }}</th>
              <td v-for="team in [0, 1]" :key="team">
                <strong
                  >{{ t('score.change') }}
                  {{ signed(entry.delta[team]) }}</strong
                ><small>{{ t('score.total') }} {{ entry.scores[team] }}</small>
              </td>
            </tr>
          </tbody>
        </table>
        <button autofocus type="button" class="score-close" @click="close">
          {{ t('score.close') }}
        </button>
      </section>
    </dialog>
  </Teleport>
</template>
<style scoped>
.score-trigger {
  background: transparent;
  border: 0;
  border-radius: 8px;
  padding: 6px;
  min-height: 44px;
  cursor: pointer;
}
.score-trigger:focus-visible {
  outline: 2px solid #efb64e;
  outline-offset: 2px;
}
.score-dialog {
  width: min(480px, calc(100vw - 24px));
  max-height: calc(100dvh - 32px);
  margin: auto;
  padding: 0;
  border: 1px solid #647b91;
  border-radius: 14px;
  background: #192e43;
  color: #f6f7f9;
  overflow: auto;
}
.score-dialog::backdrop {
  background: #0009;
}
section {
  padding: 16px;
}
h2 {
  font-size: 20px;
  margin: 0 0 16px;
}
p {
  font-size: 14px;
}
table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}
th,
td {
  text-align: center;
  padding: 10px 2px;
  border-bottom: 1px solid #40576d;
  overflow-wrap: anywhere;
}
small {
  display: block;
  margin-top: 4px;
  color: #b5c7d9;
}
.score-close {
  width: 100%;
  margin-top: 16px;
  min-height: 44px;
}
</style>
