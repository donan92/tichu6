<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import {
  TRAINING_CONSENT_EVENT,
  readTrainingConsent,
  writeTrainingConsent,
} from '../training-consent';

const { t } = useTranslation();
const enabled = ref(readTrainingConsent());
function changed(event: Event) {
  const input = event.target as HTMLInputElement;
  enabled.value = input.checked;
  writeTrainingConsent(input.checked);
}
function sync(event: Event) {
  const value = (event as CustomEvent<{ enabled?: unknown }>).detail?.enabled;
  if (typeof value === 'boolean') enabled.value = value;
}
onMounted(() => window.addEventListener(TRAINING_CONSENT_EVENT, sync));
onUnmounted(() => window.removeEventListener(TRAINING_CONSENT_EVENT, sync));
</script>

<template>
  <footer class="training-footer">
    <details>
      <summary>{{ t('training.title') }}</summary>
      <label class="training-toggle">
        <input type="checkbox" :checked="enabled" @change="changed" />
        <span>{{ t('training.optIn') }}</span>
      </label>
      <p>{{ t('training.description') }}</p>
      <p>{{ t('training.retention') }}</p>
    </details>
  </footer>
</template>

<style scoped>
.training-footer {
  display: block;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 32px 24px;
  color: var(--muted);
  font-size: 12px;
}
.training-footer details {
  border-top: 1px solid var(--line);
  padding-top: 14px;
}
.training-footer summary {
  color: var(--muted);
}
.training-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: var(--ink);
  cursor: pointer;
}
.training-toggle input {
  accent-color: var(--lime);
  width: 16px;
  height: 16px;
}
.training-footer p {
  max-width: 700px;
  margin: 8px 0 0;
  line-height: 1.6;
}
@media (max-width: 600px) {
  .training-footer {
    padding: 0 16px 20px;
  }
}
</style>
