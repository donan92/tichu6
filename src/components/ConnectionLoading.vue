<script setup lang="ts">
import { useSessionStore } from '../stores/session';
import { useText } from '../composables/useText';
const session = useSessionStore();
const { t, message } = useText();
</script>
<template>
  <main class="connection-loading" :aria-busy="!session.connectionError">
    <section aria-labelledby="restore-title">
      <div
        v-if="!session.connectionError"
        class="spinner"
        aria-hidden="true"
      ></div>
      <h1 id="restore-title">
        {{ t(session.connectionError ? 'restore.failed' : 'restore.title') }}
      </h1>
      <p role="status">
        {{
          session.connectionError
            ? message(session.connectionError)
            : t('restore.description')
        }}
      </p>
      <p class="muted">
        {{ t(session.connectionError ? 'restore.retryHint' : 'restore.hint') }}
      </p>
      <button
        v-if="session.connectionError"
        type="button"
        class="primary"
        :disabled="session.busy"
        @click="session.enterHall()"
      >
        {{ t('restore.retry') }}
      </button>
      <button
        v-if="session.connectionError"
        type="button"
        @click="session.cancelRestore()"
      >
        {{ t('restore.cancel') }}
      </button>
    </section>
  </main>
</template>
<style scoped>
.connection-loading {
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding: 24px;
  box-sizing: border-box;
  text-align: center;
}
.connection-loading section {
  width: 100%;
  max-width: 400px;
}
.connection-loading h1 {
  font-size: 22px;
  margin: 20px 0 12px;
}
.connection-loading p {
  line-height: 1.6;
}
.connection-loading button {
  margin-top: 16px;
  min-height: 48px;
}
.spinner {
  width: 36px;
  height: 36px;
  margin: auto;
  border: 3px solid var(--line);
  border-top-color: var(--lime);
  border-radius: 50%;
  animation: restore-spin 1s linear infinite;
}
@keyframes restore-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
</style>
