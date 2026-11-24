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
    <button
      type="button"
      role="switch"
      class="training-toggle"
      :aria-checked="enabled"
      :aria-describedby="`${id}-notice`"
      :aria-label="t('training.choice')"
      @click="changed(!enabled)"
    >
      <span>{{ t(enabled ? 'training.on' : 'training.off') }}</span>
      <span class="switch-track" :class="{ enabled }" aria-hidden="true">
        <span class="switch-thumb"></span>
      </span>
    </button>
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
.training-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 44px;
  gap: 12px;
  padding: 4px 8px;
  background: transparent;
  border: 0;
  color: var(--ink);
}
.training-toggle:focus-visible {
  outline: 2px solid var(--lime);
  outline-offset: 2px;
}
.switch-track {
  display: inline-flex;
  align-items: center;
  flex: 0 0 48px;
  height: 28px;
  padding: 3px;
  box-sizing: border-box;
  border-radius: 20px;
  background: #64748b;
}
.switch-track.enabled {
  background: var(--lime);
}
.switch-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px #0004;
}
.switch-track.enabled .switch-thumb {
  transform: translateX(20px);
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
