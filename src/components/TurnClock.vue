<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
const props = defineProps<{
  deadline?: number | null;
  phase: string;
  reconnectUntil?: number | null;
}>();
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
  <p
    v-if="deadline && (phase === 'play' || phase === 'trick')"
    class="turn-clock"
    role="timer"
    aria-live="off"
  >
    {{
      t(
        waiting
          ? 'play.reconnectWait'
          : phase === 'trick'
            ? 'play.autoCollect'
            : 'play.turnDeadline',
        {
          seconds,
        },
      )
    }}
  </p>
</template>
<style scoped>
.turn-clock {
  color: var(--lime);
  font-weight: 700;
  margin: 6px 0;
}
</style>
