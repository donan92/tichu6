<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick, useTemplateRef } from 'vue';
import { useTranslation } from 'i18next-vue';
import type { RoundView } from '../types';
const props = defineProps<{ game: RoundView }>();
const { t } = useTranslation();
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
let previous: Element | null = null;
const notice = ref<{ name: string; call: number } | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
const queue: { name: string; call: number }[] = [];
function next() {
  clearTimeout(timer);
  notice.value = queue.shift() ?? null;
  if (notice.value) timer = setTimeout(next, 5000);
}
watch(
  () => ({ round: props.game.round, calls: [...props.game.calls] }),
  (value, old) => {
    if (!old || old.round !== value.round) {
      queue.length = 0;
      next();
      return;
    }
    value.calls.forEach((call, i) => {
      if (call && call !== old.calls[i])
        queue.push({ name: props.game.names[i], call });
    });
    if (!notice.value) next();
  },
);
watch(notice, async (value) => {
  if (value) {
    if (!previous) previous = document.activeElement;
    await nextTick();
    dialog.value?.showModal();
  } else if (previous instanceof HTMLElement && previous.isConnected) {
    previous.focus({ preventScroll: true });
    previous = null;
  }
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  dialog.value?.close();
});
</script>
<template>
  <Teleport to="body">
    <dialog
      v-if="notice"
      ref="dialog"
      class="declaration-overlay"
      :aria-label="t('play.declarationTitle')"
      aria-live="assertive"
      @cancel.prevent="next"
    >
      <section>
        <h2>{{ t('play.declarationTitle') }}</h2>
        <p>
          {{
            t('play.declarationNotice', {
              name: notice.name,
              call: t(notice.call === 200 ? 'play.grand' : 'play.tichuShort'),
            })
          }}
        </p>
        <button @click="next">{{ t('play.dismissNotice') }}</button>
      </section>
    </dialog>
  </Teleport>
</template>
<style scoped>
.declaration-overlay {
  position: fixed;
  margin: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  border: 0;
  color: inherit;
  inset: 0;
  z-index: 100;
  background: #0007;
  display: grid;
  place-items: center;
  padding: 16px;
}
.declaration-overlay section {
  background: #192e43;
  border: 2px solid #efb64e;
  border-radius: 12px;
  padding: 24px;
  max-width: 100%;
  text-align: center;
}
</style>
