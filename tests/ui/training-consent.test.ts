import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
    const on = wrapper.get('input[value="on"]');
    const off = wrapper.get('input[value="off"]');
    expect((on.element as HTMLInputElement).checked).toBe(true);
    expect(wrapper.get('.training-notice').text()).toContain('on by default');
    expect(wrapper.get('fieldset').element.closest('details')).toBeNull();
    await off.setValue();
    expect(readTrainingConsent()).toBe(false);
    expect((on.element as HTMLInputElement).checked).toBe(false);
    expect(localStorage.getItem(TRAINING_CONSENT_KEY)).toBe('false');
    expect(wrapper.get('[role="status"]').text()).toContain('off');
    wrapper.unmount();
    const restored = render();
    expect(
      (restored.get('input[value="off"]').element as HTMLInputElement).checked,
    ).toBe(true);
    await restored.get('input[value="on"]').setValue();
    expect(readTrainingConsent()).toBe(true);
    await restored.get('input[value="off"]').setValue();
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

  it('shows labeled native radio options and the opt-out instruction in Korean', async () => {
    await i18next.changeLanguage('ko');
    const wrapper = render();
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(2);
    expect(wrapper.get('legend').text()).toContain('수집 여부');
    expect(wrapper.get('.training-notice').text()).toContain('동의하지 않으면');
    expect(
      wrapper.findAll('.training-option').map((label) => label.text()),
    ).toEqual(['수집 켜기', '수집 끄기']);
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
