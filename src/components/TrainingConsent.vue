<script setup lang="ts">
import { onMounted, onUnmounted, ref, useId } from 'vue';
import { useTranslation } from 'i18next-vue';
import {
  TRAINING_CONSENT_EVENT,
  readTrainingConsent,
  writeTrainingConsent,
} from '../training-consent';

const { t } = useTranslation();
const id = useId();
const enabled = ref(readTrainingConsent());
function changed(value: boolean) {
  enabled.value = value;
  writeTrainingConsent(value);
}
function sync(event: Event) {
  const value = (event as CustomEvent<{ enabled?: unknown }>).detail?.enabled;
  if (typeof value === 'boolean') enabled.value = value;
}
onMounted(() => window.addEventListener(TRAINING_CONSENT_EVENT, sync));
onUnmounted(() => window.removeEventListener(TRAINING_CONSENT_EVENT, sync));
</script>

<template>
  <section class="training-panel" :aria-labelledby="`${id}-title`">
    <div class="training-heading">
      <h2 :id="`${id}-title`">{{ t('training.title') }}</h2>
      <span class="training-status" role="status">{{
        t(enabled ? 'training.enabled' : 'training.disabled')
      }}</span>
    </div>
    <p :id="`${id}-notice`" class="training-notice">
      {{ t(enabled ? 'training.noticeOn' : 'training.noticeOff') }}
    </p>
    <fieldset :aria-describedby="`${id}-notice`">
      <legend>{{ t('training.choice') }}</legend>
      <label class="training-option" :class="{ selected: enabled }">
        <input
          type="radio"
          :name="`${id}-collection`"
          value="on"
          :checked="enabled"
          @change="changed(true)"
        />
        <span>{{ t('training.on') }}</span>
      </label>
      <label class="training-option" :class="{ selected: !enabled }">
        <input
          type="radio"
          :name="`${id}-collection`"
          value="off"
          :checked="!enabled"
          @change="changed(false)"
        />
        <span>{{ t('training.off') }}</span>
      </label>
    </fieldset>
    <details class="training-details">
      <summary>{{ t('training.details') }}</summary>
      <p>{{ t('training.description') }}</p>
      <p>{{ t('training.retention') }}</p>
    </details>
  </section>
</template>

<style scoped>
.training-panel {
  box-sizing: border-box;
  max-width: 1216px;
  margin: 12px auto;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--lime);
  border-radius: 8px;
  background: var(--panel, #20364c);
  color: var(--ink);
  font-size: 14px;
}
.training-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 12px;
}
.training-heading h2 {
  margin: 0;
  font-size: 15px;
}
.training-status {
  color: var(--muted);
  font-size: 12px;
}
.training-panel p {
  margin: 8px 0;
  line-height: 1.5;
}
.training-panel fieldset {
  display: flex;
  gap: 8px;
  min-width: 0;
  padding: 0;
  margin: 0;
  border: 0;
}
.training-panel legend {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.training-option {
  display: flex;
  flex-direction: row;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  margin: 0;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  cursor: pointer;
  color: var(--ink);
}
.training-option.selected {
  border-color: var(--lime);
}
.training-option:focus-within {
  outline: 2px solid var(--lime);
  outline-offset: 2px;
}
.training-option input[type='radio'] {
  appearance: auto;
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  min-height: 0;
  padding: 0;
  margin: 0;
  accent-color: var(--lime);
}
.training-details {
  margin-top: 8px;
  color: var(--muted);
  font-size: 12px;
}
@media (max-width: 1280px) {
  .training-panel {
    margin-inline: 16px;
  }
}
@media (max-width: 600px) {
  .training-panel {
    margin: 8px 12px;
    padding: 10px 12px;
    font-size: 12px;
  }
}
</style>
