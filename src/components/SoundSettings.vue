<script setup lang="ts">
import { onBeforeUnmount, ref, useId, useTemplateRef } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useAudioStore } from '../stores/audio';
const audio = useAudioStore();
const { t } = useTranslation();
const id = useId();
const opened = ref(false);
const trigger = useTemplateRef<HTMLButtonElement>('trigger');
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
function open() {
  void audio.unlock();
  dialog.value?.showModal();
  opened.value = true;
}
function close() {
  dialog.value?.close();
  opened.value = false;
  trigger.value?.focus({ preventScroll: true });
}
async function preview() {
  await audio.unlock();
  await audio.playEffect('card');
}
onBeforeUnmount(() => {
  if (opened.value) dialog.value?.close();
});
</script>
<template>
  <button
    ref="trigger"
    class="sound-trigger quiet"
    type="button"
    :aria-label="t('audio.open')"
    aria-haspopup="dialog"
    :aria-expanded="opened"
    :aria-controls="id"
    @click="open"
  >
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M11 4 6 8H3v8h3l5 4Z" />
      <template
        v-if="
          (audio.settings.music && audio.settings.musicVolume > 0) ||
          (audio.settings.effects && audio.settings.effectsVolume > 0)
        "
      >
        <path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />
      </template>
      <path v-else d="m16 9 5 6m0-6-5 6" />
    </svg>
  </button>
  <Teleport to="body">
    <dialog
      :id="id"
      ref="dialog"
      class="sound-dialog"
      :aria-labelledby="`${id}-title`"
      @cancel.prevent="close"
      @close="opened = false"
      @click="$event.target === $event.currentTarget && close()"
    >
      <section class="sound-panel">
        <h2 :id="`${id}-title`">{{ t('audio.title') }}</h2>
        <p>{{ t('audio.description') }}</p>
        <fieldset :disabled="!audio.available">
          <legend>{{ t('audio.music') }}</legend>
          <label class="sound-toggle"
            ><input
              v-model="audio.settings.music"
              type="checkbox"
              autofocus
            />{{ t('audio.musicEnabled') }}</label
          >
          <label :for="`${id}-music`">{{
            t('audio.volume', { value: audio.settings.musicVolume })
          }}</label>
          <input
            :id="`${id}-music`"
            v-model.number="audio.settings.musicVolume"
            type="range"
            min="0"
            max="100"
            step="1"
            :aria-label="t('audio.musicVolume')"
            :disabled="!audio.settings.music"
          />
          <p>
            {{
              t(
                audio.track === 'lobby'
                  ? 'audio.lobbyTrack'
                  : 'audio.gameTrack',
              )
            }}
          </p>
        </fieldset>
        <fieldset :disabled="!audio.available">
          <legend>{{ t('audio.effects') }}</legend>
          <label class="sound-toggle"
            ><input v-model="audio.settings.effects" type="checkbox" />{{
              t('audio.effectsEnabled')
            }}</label
          >
          <label :for="`${id}-effects`">{{
            t('audio.volume', { value: audio.settings.effectsVolume })
          }}</label>
          <input
            :id="`${id}-effects`"
            v-model.number="audio.settings.effectsVolume"
            type="range"
            min="0"
            max="100"
            step="1"
            :aria-label="t('audio.effectsVolume')"
            :disabled="!audio.settings.effects"
          />
          <button
            type="button"
            :disabled="
              !audio.settings.effects || audio.settings.effectsVolume === 0
            "
            @click="preview"
          >
            {{ t('audio.preview') }}
          </button>
        </fieldset>
        <p v-if="!audio.available || audio.failed" role="status">
          {{ t(!audio.available ? 'audio.unavailable' : 'audio.failed') }}
        </p>
        <p class="sound-note">{{ t('audio.saved') }}</p>
        <button class="sound-close" type="button" @click="close">
          {{ t('audio.close') }}
        </button>
      </section>
    </dialog>
  </Teleport>
</template>
<style scoped>
.sound-trigger {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sound-dialog {
  width: min(440px, calc(100vw - 24px));
  max-height: calc(100dvh - 32px);
  margin: auto;
  padding: 0;
  border: 1px solid #647b91;
  border-radius: 14px;
  background: #192e43;
  color: var(--ink);
  overflow: auto;
}
.sound-dialog::backdrop {
  background: #0009;
}
.sound-panel {
  padding: 16px;
}
.sound-panel h2 {
  margin: 0 0 12px;
  font-size: 20px;
}
.sound-panel p {
  color: var(--muted);
  line-height: 1.5;
  overflow-wrap: anywhere;
  font-size: 13px;
}
.sound-panel fieldset {
  min-width: 0;
  margin: 14px 0;
  padding: 12px;
  border: 1px solid #40576d;
  border-radius: 8px;
}
.sound-panel legend {
  padding: 0 6px;
  font-weight: 700;
}
.sound-panel input[type='range'] {
  display: block;
  width: 100%;
  min-height: 44px;
  margin: 0;
  padding: 0;
  accent-color: var(--lime);
}
.sound-toggle {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  margin-bottom: 8px;
}
.sound-toggle input {
  width: 20px;
  height: 20px;
  accent-color: var(--lime);
}
.sound-panel button {
  min-height: 44px;
}
.sound-close {
  width: 100%;
}
</style>
