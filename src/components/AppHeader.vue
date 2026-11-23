<script setup lang="ts">
import { computed } from 'vue';
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
    <a
      class="brand"
      href="#"
      @click.prevent="session.mode !== 'home' && (session.leaving = true)"
      >6<span>T</span><small>{{ t('app.tagline') }}</small></a
    >
    <div class="header-right">
      <label class="language-picker"
        ><span>{{ t('app.language') }}</span
        ><select
          id="language"
          v-model="language"
          :aria-label="t('app.language')"
        >
          <option v-for="(pack, id) in languages" :key="id" :value="id">
            {{ pack.label }}
          </option>
        </select></label
      >
      <span class="connection-label">{{ t(status) }}</span>
      <button
        v-if="session.mode !== 'home'"
        class="quiet"
        @click="session.leaving = true"
      >
        {{
          t(
            session.mode === 'hall'
              ? 'connection.disconnect'
              : 'connection.lounge',
          )
        }}
      </button>
    </div>
  </header>
</template>
