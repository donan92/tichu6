import { createApp } from 'vue';
import { createPinia } from 'pinia';
import I18NextVue from 'i18next-vue';
import App from './App.vue';
import { i18next, initializeLanguage } from './localization';
import './style.css';
await initializeLanguage();
createApp(App).use(createPinia()).use(I18NextVue, { i18next }).mount('#app');
