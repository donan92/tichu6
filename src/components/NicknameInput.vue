<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
const model = defineModel<string>({ required: true });
defineProps<{ label: string }>();
const { t } = useTranslation();
</script>
<template>
  <label
    >{{ t(label)
    }}<input
      id="name"
      v-model="model"
      maxlength="8"
      pattern="[A-Za-z0-9]{1,8}"
      autocapitalize="none"
      :spellcheck="false"
      :placeholder="t('home.placeholder')"
      autocomplete="nickname"
  /></label>
</template>
