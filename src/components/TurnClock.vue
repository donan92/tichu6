<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
const props = defineProps<{ deadline?: number | null; phase: string }>();
const { t } = useTranslation();
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 250);
});
onUnmounted(() => clearInterval(timer));
const seconds = computed(() =>
  Math.max(0, Math.ceil(((props.deadline ?? now.value) - now.value) / 1000)),
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
      t(phase === 'trick' ? 'play.autoCollect' : 'play.turnDeadline', {
        seconds,
      })
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
