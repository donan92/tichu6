<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, useId } from 'vue';
import { useText } from '../composables/useText';
import { useSessionStore } from '../stores/session';
const props = defineProps<{ joining?: boolean; code?: string }>();
const emit = defineEmits<{ close: [] }>();
const { t, message } = useText();
const session = useSessionStore();
const dialog = ref<HTMLDialogElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const value = ref('');
const copied = ref(false);
const failed = ref(false);
const id = useId();
const previous = document.activeElement;
const link = () => {
  const url = new URL(location.href);
  url.search = '';
  url.hash = 'join=' + props.code;
  return url.href;
};
async function copy() {
  try {
    await navigator.clipboard.writeText(link());
    copied.value = true;
  } catch {
    failed.value = true;
  }
}
function join() {
  if (/^[A-Z0-9]{6}$/.test(value.value)) session.joinCode(value.value);
}
onMounted(() => {
  dialog.value?.showModal();
  input.value?.focus();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  if (previous instanceof HTMLElement && previous.isConnected)
    previous.focus({ preventScroll: true });
});
watch(
  () => session.mode,
  (mode) => {
    if (props.joining && mode === 'room') emit('close');
  },
);
</script>
<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="leave-dialog"
      :aria-labelledby="id"
      @cancel.prevent="emit('close')"
    >
      <form @submit.prevent="joining ? join() : copy()">
        <h2 :id="id">
          {{ t(joining ? 'private.joinTitle' : 'private.shareTitle') }}
        </h2>
        <p>{{ t(joining ? 'private.joinHint' : 'private.shareHint') }}</p>
        <label v-if="joining">
          {{ t('private.code') }}
          <input
            ref="input"
            v-model="value"
            class="invite-code"
            maxlength="6"
            minlength="6"
            pattern="[A-Z0-9]{6}"
            autocomplete="off"
            autocapitalize="characters"
            :spellcheck="false"
            required
            @input="
              value = value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, 6)
            "
          />
        </label>
        <template v-else>
          <p class="invite-code">{{ code }}</p>
          <label
            >{{ t('private.link')
            }}<input
              :value="link()"
              readonly
              @focus="($event.target as HTMLInputElement).select()"
          /></label>
          <p v-if="copied" role="status">{{ t('private.copied') }}</p>
          <p v-if="failed" role="alert">{{ t('private.copyFailed') }}</p>
        </template>
        <p v-if="joining && session.notice" role="alert">
          {{ message(session.notice) }}
        </p>
        <div class="entry-actions">
          <button type="button" @click="emit('close')">
            {{ t('picker.cancel') }}
          </button>
          <button
            type="submit"
            class="primary"
            :disabled="
              joining && (!session.connected || !/^[A-Z0-9]{6}$/.test(value))
            "
          >
            {{ t(joining ? 'private.joinAction' : 'private.copyLink') }}
          </button>
        </div>
      </form>
    </dialog>
  </Teleport>
</template>
<style scoped>
.invite-code {
  font: 700 28px monospace;
  letter-spacing: 0.3em;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
}
form {
  min-width: 0;
  padding: 24px;
  width: min(420px, 100%);
  box-sizing: border-box;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
}
input {
  max-width: 100%;
}
.entry-actions {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 8px;
}
.entry-actions button {
  margin: 8px 0 0;
  padding: 10px 8px;
  min-height: 48px;
  min-width: 0;
  white-space: nowrap;
}
</style>
