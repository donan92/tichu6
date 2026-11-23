<script setup lang="ts">
import { onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useSessionStore } from '../stores/session';
const session = useSessionStore();
const { t } = useTranslation();
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const previous = document.activeElement;
onMounted(() => dialog.value?.showModal());
onBeforeUnmount(() => {
  dialog.value?.close();
  if (previous instanceof HTMLElement && previous.isConnected)
    previous.focus({ preventScroll: true });
});
</script>
<template>
  <dialog
    ref="dialog"
    class="leave-dialog"
    aria-labelledby="leave-title"
    @cancel.prevent="session.leaving = false"
  >
    <div>
      <h2 id="leave-title">
        {{ t(session.forfeiting ? 'leave.forfeitTitle' : 'leave.title') }}
      </h2>
      <p>
        {{
          t(
            session.forfeiting
              ? session.mode === 'demo'
                ? 'leave.practiceForfeit'
                : 'leave.forfeitDescription'
              : 'leave.description',
          )
        }}
      </p>
      <button autofocus @click="session.leaving = false">
        {{ t('leave.cancel') }}</button><button
        class="accent"
        @click="session.confirmLeave"
      >
        {{ t(session.forfeiting ? 'leave.forfeit' : 'play.leave') }}
      </button>
    </div>
  </dialog>
</template>
