<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
const props = defineProps<{
  deadline?: number | null;
  phase: string;
  duration?: number | null;
  canExtend?: boolean;
  reconnectUntil?: number | null;
}>();
const emit = defineEmits<{ extend: [] }>();
const { t } = useTranslation();
const now = ref(Date.now());
watch(
  () => props.deadline,
  () => {
    now.value = Date.now();
  },
  { flush: 'sync' },
);
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 250);
});
onUnmounted(() => clearInterval(timer));
const waiting = computed(
  () => props.phase === 'play' && (props.reconnectUntil ?? 0) > now.value,
);
const seconds = computed(() =>
  Math.max(
    0,
    Math.ceil(
      ((waiting.value ? props.reconnectUntil! : (props.deadline ?? now.value)) -
        now.value) /
        1000,
    ),
  ),
);
</script>
<template>
  <div
    v-if="deadline && ['grand', 'exchange', 'play', 'trick'].includes(phase)"
    class="turn-clock"
    :class="{ urgent: !waiting && seconds <= 5 }"
    role="timer"
    aria-live="off"
  >
    {{
      t(
        waiting
          ? 'play.reconnectWait'
          : phase === 'grand' || phase === 'exchange'
            ? 'play.preparationDeadline'
            : phase === 'trick'
              ? 'play.autoCollect'
              : 'play.turnDeadline',
        {
          seconds,
        },
      )
    }}
    <div class="clock-row">
      <progress
        :max="duration || (phase === 'trick' ? 5000 : 30000)"
        :value="Math.max(0, (deadline ?? 0) - now)"
        :aria-label="t('play.timeRemaining')"
      />
      <button
        v-if="
          canExtend &&
          phase === 'play' &&
          !waiting &&
          seconds > 0 &&
          seconds <= 10
        "
        @click="emit('extend')"
      >
        {{ t('play.extendTime') }}
      </button>
    </div>
  </div>
</template>
<style scoped>
.turn-clock {
  color: var(--lime);
  font-weight: 700;
  margin: 6px 0;
}
.clock-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
progress {
  width: 100%;
  height: 12px;
  accent-color: #efb64e;
}
.urgent {
  color: #f25a65;
}
.urgent progress {
  accent-color: #f25a65;
  animation: clock-shake 0.35s infinite;
}
.clock-row button {
  white-space: nowrap;
  min-height: 44px;
}
@keyframes clock-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-2px);
  }
  75% {
    transform: translateX(2px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .urgent progress {
    animation: none;
  }
}
</style>
