<script setup lang="ts">
defineProps<{ title: string }>();
</script>
<template>
  <details class="guide-panel">
    <summary>{{ title }}</summary>
    <div class="guide-content"><slot /></div>
  </details>
</template>
<style scoped>
.guide-panel {
  margin: 12px 0;
  border: 1px solid #52677b;
  border-radius: 10px;
  background: var(--panel);
  color: var(--ink);
  overflow-wrap: anywhere;
}
summary {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 14px 16px;
  list-style: none;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  border-radius: inherit;
}
summary::-webkit-details-marker {
  display: none;
}
summary::before {
  content: '';
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(-45deg);
}
[open] > summary::before {
  transform: rotate(45deg);
}
[open] > summary {
  border-bottom: 1px solid var(--line);
  border-radius: 10px 10px 0 0;
}
summary:focus-visible {
  outline: 2px solid var(--lime);
  outline-offset: 3px;
}
.guide-content {
  padding: 16px;
  line-height: 1.7;
}
.guide-content :deep(ul),
.guide-content :deep(ol) {
  padding-left: 20px;
}
.guide-content :deep(> :first-child) {
  margin-top: 0;
}
.guide-content :deep(> :last-child) {
  margin-bottom: 0;
}
</style>
