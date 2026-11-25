<script setup lang="ts">
import { onMounted, onBeforeUnmount, useTemplateRef, useId } from 'vue';
import { useTranslation } from 'i18next-vue';
defineProps<{ description: string }>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();
const { t } = useTranslation();
const id = useId();
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
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="leave-dialog action-confirm"
      :aria-labelledby="id"
      @cancel.prevent="emit('cancel')"
      @click="$event.target === $event.currentTarget && emit('cancel')"
    >
      <div>
        <h2 :id="id">{{ t('play.confirmTitle') }}</h2>
        <p>{{ description }}</p>
        <button autofocus @click="emit('cancel')">
          {{ t('picker.cancel') }}
        </button>
        <button class="primary" @click="emit('confirm')">
          {{ t('play.confirmAction') }}
        </button>
      </div>
    </dialog>
  </Teleport>
</template>
