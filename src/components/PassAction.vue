<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { legalPlays } from '../game.js';
import { useSessionStore } from '../stores/session';
import type { RoundView } from '../types';
import ActionConfirm from './ActionConfirm.vue';
const props = defineProps<{ game: RoundView }>();
const session = useSessionStore();
const { t } = useTranslation();
const confirming = ref(false);
const disabled = computed(
  () =>
    session.pending ||
    props.game.paused ||
    !props.game.top ||
    props.game.dogPending != null,
);
function pass(event: MouseEvent) {
  (event.currentTarget as HTMLElement).focus();
  if (disabled.value) return;
  if (legalPlays(props.game.hand, props.game.top).length)
    confirming.value = true;
  else session.submit({ type: 'pass' });
}
function confirm() {
  confirming.value = false;
  if (!disabled.value) session.submit({ type: 'pass' });
}
watch(
  () => [props.game.revision, session.pending],
  () => {
    confirming.value = false;
  },
);
</script>
<template>
  <button class="hand-pass" :disabled="disabled" @click="pass">
    {{ t('play.pass') }}
  </button>
  <ActionConfirm
    v-if="confirming"
    :description="t('play.confirmPass')"
    @cancel="confirming = false"
    @confirm="confirm"
  />
</template>
<style scoped>
.hand-pass {
  width: 100%;
  min-height: 44px;
}
</style>
