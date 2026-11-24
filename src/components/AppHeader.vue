<script setup lang="ts">
import { computed } from 'vue';
import ChoicePicker from './ChoicePicker.vue';
import VersionNotes from './VersionNotes.vue';
import { useTranslation } from 'i18next-vue';
import { languages } from '../i18n.js';
import { changeLanguage } from '../localization';
import { useSessionStore } from '../stores/session';
const session = useSessionStore();
const { t, i18next } = useTranslation();
const language = computed({
  get: () => i18next.resolvedLanguage ?? 'en',
  set: (value) => {
    void changeLanguage(value);
  },
});
const status = computed(() =>
  session.mode === 'home'
    ? 'app.summary'
    : session.mode === 'demo'
      ? 'connection.practice'
      : session.connected
        ? 'connection.connected'
        : 'connection.reconnecting',
);
</script>
<template>
  <header>
    <div class="brand-group">
      <a
        class="brand"
        href="#"
        @click.prevent="session.mode !== 'home' && (session.leaving = true)"
        >6<span>T</span><small>{{ t('app.tagline') }}</small></a
      >
      <VersionNotes />
    </div>
    <div class="header-right">
      <ChoicePicker
        v-model="language"
        class="language-picker"
        :label="t('app.language')"
        :options="
          Object.entries(languages).map(([value, pack]) => ({
            value,
            label: pack.label,
          }))
        "
      />
      <span class="connection-label">{{ t(status) }}</span>
      <button
        v-if="session.mode !== 'home'"
        class="quiet"
        @click="session.leaving = true"
      >
        {{
          t(
            session.forfeiting
              ? 'leave.forfeit'
              : session.mode === 'hall'
                ? 'connection.disconnect'
                : 'connection.lounge',
          )
        }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.brand-group {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
</style>
