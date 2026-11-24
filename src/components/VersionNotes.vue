<script setup lang="ts">
import { onBeforeUnmount, ref, useId, useTemplateRef } from 'vue';
import { useTranslation } from 'i18next-vue';
import { version } from '../../package.json';
import releases from '../release-notes.json';
const { t } = useTranslation();
const id = useId();
const opened = ref(false);
const trigger = useTemplateRef<HTMLButtonElement>('trigger');
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const recent = releases.slice(0, 5);
function open() {
  trigger.value?.focus({ preventScroll: true });
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
    class="version-trigger"
    aria-haspopup="dialog"
    :aria-expanded="opened"
    :aria-controls="id"
    :aria-label="t('patches.open', { version })"
    @click="open"
  >
    v{{ version }}
  </button>
  <Teleport to="body">
    <dialog
      :id="id"
      ref="dialog"
      class="patch-dialog"
      :aria-labelledby="`${id}-title`"
      @cancel.prevent="close"
      @close="opened = false"
      @click="$event.target === $event.currentTarget && close()"
    >
      <section class="patch-panel">
        <h2 :id="`${id}-title`">{{ t('patches.title') }}</h2>
        <ol>
          <li v-for="release in recent" :key="release.version">
            <span class="patch-version">v{{ release.version }}</span>
            <p>{{ t(release.summary) }}</p>
          </li>
        </ol>
        <button type="button" class="patch-close" autofocus @click="close">
          {{ t('patches.close') }}
        </button>
      </section>
    </dialog>
  </Teleport>
</template>
<style scoped>
.version-trigger {
  min-height: 44px;
  min-width: 44px;
  padding: 4px;
  background: transparent;
  border-color: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  text-decoration: underline dotted;
  text-underline-offset: 4px;
}
.version-trigger:hover {
  color: var(--ink);
}
.patch-dialog {
  width: min(480px, calc(100vw - 24px));
  max-height: calc(100dvh - 32px);
  margin: auto;
  padding: 0;
  border: 1px solid #647b91;
  border-radius: 14px;
  background: #192e43;
  color: var(--ink);
  overflow: auto;
}
.patch-dialog::backdrop {
  background: #0009;
}
.patch-panel {
  padding: 20px;
}
.patch-panel h2 {
  font-size: 20px;
  margin: 0 0 16px;
}
.patch-panel ol {
  list-style: none;
  padding: 0;
  margin: 0;
}
.patch-panel li {
  padding: 12px 0;
  border-top: 1px solid #40576d;
}
.patch-version {
  color: var(--lime);
  font-size: 12px;
  font-weight: 700;
}
.patch-panel p {
  margin: 4px 0 0;
  line-height: 1.5;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.patch-close {
  width: 100%;
  min-height: 44px;
  margin-top: 16px;
}
</style>
