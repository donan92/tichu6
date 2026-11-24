import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, disposePinia, setActivePinia } from 'pinia';
import App from '../../src/App.vue';
import { useSessionStore } from '../../src/stores/session';
import { mount } from '@vue/test-utils';
import I18NextVue from 'i18next-vue';
import { i18next } from '../../src/localization';
import TrainingConsent from '../../src/components/TrainingConsent.vue';
import {
  TRAINING_CONSENT_KEY,
  readTrainingConsent,
  writeTrainingConsent,
} from '../../src/training-consent';

const wrappers: { unmount: () => void }[] = [];
beforeEach(async () => {
  writeTrainingConsent(false); // Clear any in-memory storage-failure override.
  localStorage.clear();
  await i18next.changeLanguage('en');
});
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));
function render() {
  const wrapper = mount(TrainingConsent, {
    attachTo: document.body,
    global: { plugins: [[I18NextVue, { i18next }]] },
  });
  wrappers.push(wrapper);
  return wrapper;
}

describe('training recording preference', () => {
  it('defaults on with a visible notice and persists an explicit opt-out across remount', async () => {
    const wrapper = render();
    const toggle = wrapper.get('[role="switch"]');
    expect(toggle.attributes('aria-checked')).toBe('true');
    expect(wrapper.get('.training-notice').text()).toContain('on by default');
    expect(toggle.element.closest('details')).toBeNull();
    await toggle.trigger('click');
    expect(readTrainingConsent()).toBe(false);
    expect(toggle.attributes('aria-checked')).toBe('false');
    expect(localStorage.getItem(TRAINING_CONSENT_KEY)).toBe('false');
    wrapper.unmount();
    const restored = render();
    expect(restored.get('[role="switch"]').attributes('aria-checked')).toBe(
      'false',
    );
    await restored.get('[role="switch"]').trigger('click');
    expect(readTrainingConsent()).toBe(true);
    await restored.get('[role="switch"]').trigger('click');
    expect(readTrainingConsent()).toBe(false);
  });

  it('preserves existing choices and fails closed for unreadable or invalid storage', () => {
    expect(readTrainingConsent()).toBe(true);
    localStorage.setItem(TRAINING_CONSENT_KEY, 'false');
    expect(readTrainingConsent()).toBe(false);
    localStorage.setItem(TRAINING_CONSENT_KEY, 'true');
    expect(readTrainingConsent()).toBe(true);
    localStorage.setItem(TRAINING_CONSENT_KEY, 'invalid');
    expect(readTrainingConsent()).toBe(false);
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw Error('Unavailable');
    };
    try {
      expect(readTrainingConsent()).toBe(false);
    } finally {
      Storage.prototype.getItem = original;
    }
  });

  it('shows an accessible toggle and the opt-out instruction in Korean', async () => {
    await i18next.changeLanguage('ko');
    const wrapper = render();
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(1);
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(0);
    expect(wrapper.get('[role="switch"]').attributes('aria-label')).toContain(
      '수집 여부',
    );
    expect(wrapper.get('.training-notice').text()).toContain('토글을 꺼');
    expect(wrapper.get('details').text()).toContain('닉네임');
    expect(wrapper.get('details').attributes('open')).toBeUndefined();
  });

  it('honors current-tab withdrawal even when storage writes fail', () => {
    writeTrainingConsent(true);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('Storage unavailable');
    };
    try {
      writeTrainingConsent(false);
      expect(readTrainingConsent()).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
      writeTrainingConsent(false);
    }
  });
});

it('shows collection settings only in the hall and preserves preferences when leaving it', async () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  const session = useSessionStore();
  const wrapper = mount(App, {
    global: {
      plugins: [pinia, [I18NextVue, { i18next }]],
      stubs: {
        AppHeader: true,
        HomeView: true,
        HallView: true,
        GameView: true,
        RoomView: true,
        LeaveDialog: true,
      },
    },
  });
  try {
    expect(wrapper.findComponent(TrainingConsent).exists()).toBe(false);
    session.mode = 'hall';
    await nextTick();
    await wrapper.get('[role="switch"]').trigger('click');
    expect(readTrainingConsent()).toBe(false);
    for (const mode of ['room', 'demo', 'home'] as const) {
      session.mode = mode;
      await nextTick();
      expect(wrapper.findComponent(TrainingConsent).exists()).toBe(false);
      expect(readTrainingConsent()).toBe(false);
    }
    session.mode = 'hall';
    await nextTick();
    expect(wrapper.get('[role="switch"]').attributes('aria-checked')).toBe(
      'false',
    );
  } finally {
    wrapper.unmount();
    disposePinia(pinia);
  }
});
