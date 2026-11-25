<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  ref,
  useId,
  useTemplateRef,
  watch,
} from 'vue';
import { useTranslation } from 'i18next-vue';
const props = defineProps<{
  modelValue: string;
  label: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  compact?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const { t } = useTranslation();
const id = useId();
const opened = ref(false);
const trigger = useTemplateRef<HTMLButtonElement>('trigger');
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const selected = computed(
  () =>
    props.options.find((option) => option.value === props.modelValue)?.label ??
    props.label,
);
function close() {
  dialog.value?.close();
  opened.value = false;
  trigger.value?.focus({ preventScroll: true });
}
function open() {
  if (props.disabled) return;
  opened.value = true;
  dialog.value?.showModal();
  dialog.value
    ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    ?.focus();
}
function choose(value: string) {
  if (props.disabled || !props.options.some((option) => option.value === value))
    return;
  close();
  emit('update:modelValue', value);
}
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled && opened.value) close();
  },
);
onBeforeUnmount(() => {
  if (opened.value) dialog.value?.close();
});
</script>
<template>
  <div class="choice-picker">
    <button
      ref="trigger"
      type="button"
      class="choice-trigger"
      :disabled="disabled"
      aria-haspopup="dialog"
      :aria-expanded="opened"
      :aria-controls="id"
      :aria-label="`${label}: ${selected}`"
      @click="open"
    >
      <span>{{ selected }}</span><span aria-hidden="true">⌄</span>
    </button>
    <Teleport to="body">
      <dialog
        :id="id"
        ref="dialog"
        class="choice-dialog"
        :aria-labelledby="`${id}-title`"
        @cancel.prevent="close"
        @click="$event.target === $event.currentTarget && close()"
      >
        <section class="choice-panel">
          <h2 :id="`${id}-title`">{{ label }}</h2>
          <div class="choice-options" :class="{ compact }">
            <button
              v-for="option in options"
              :key="option.value"
              type="button"
              :aria-pressed="option.value === modelValue"
              :disabled="disabled"
              @click="choose(option.value)"
            >
              <span>{{ option.label }}</span><span
                v-if="option.value === modelValue"
                aria-hidden="true"
                >✓</span
              >
            </button>
          </div>
          <button type="button" class="choice-cancel" @click="close">
            {{ t('picker.cancel') }}
          </button>
        </section>
      </dialog>
    </Teleport>
  </div>
</template>
<style scoped>
.choice-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 44px;
}
.choice-dialog {
  width: min(360px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  padding: 0;
  border: 1px solid #647b91;
  border-radius: 14px;
  margin: auto;
  color: var(--text, #edf2f7);
  background: #192e43;
  overflow: auto;
}
.choice-dialog::backdrop {
  background: #0009;
}
.choice-panel {
  padding: 20px;
}
.choice-panel h2 {
  font-size: 18px;
  margin: 0 0 16px;
}
.choice-options {
  display: grid;
  gap: 8px;
}
.choice-options.compact {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.choice-options button {
  min-height: 48px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-align: left;
  overflow-wrap: anywhere;
}
.choice-options button[aria-pressed='true'] {
  border-color: #efb64e;
  color: #efb64e;
}
.choice-cancel {
  width: 100%;
  min-height: 44px;
  margin-top: 16px;
}
</style>
