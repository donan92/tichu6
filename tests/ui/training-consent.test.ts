import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import I18NextVue from 'i18next-vue';
import { i18next } from '../../src/localization';
import TrainingConsent from '../../src/components/TrainingConsent.vue';
import {
  TRAINING_CONSENT_KEY,
  readTrainingConsent,
} from '../../src/training-consent';

const wrappers: { unmount: () => void }[] = [];
beforeEach(async () => {
  localStorage.clear();
  await i18next.changeLanguage('en');
});
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));

describe('training consent', () => {
  it('is opt-in, persists changes, and stops reflecting after unmount', async () => {
    const wrapper = mount(TrainingConsent, {
      global: { plugins: [[I18NextVue, { i18next }]] },
    });
    wrappers.push(wrapper);
    const input = wrapper.get('input[type="checkbox"]');
    expect((input.element as HTMLInputElement).checked).toBe(false);
    await input.setValue(true);
    expect(readTrainingConsent()).toBe(true);
    expect(localStorage.getItem(TRAINING_CONSENT_KEY)).toBe('true');
    await input.setValue(false);
    expect(readTrainingConsent()).toBe(false);
  });

  it('keeps the native checkbox in a compact collapsible footer in Korean', async () => {
    await i18next.changeLanguage('ko');
    const wrapper = mount(TrainingConsent, {
      attachTo: document.body,
      global: { plugins: [[I18NextVue, { i18next }]] },
    });
    wrappers.push(wrapper);
    expect(wrapper.get('footer details summary').text()).toContain('봇');
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(1);
    expect(
      wrapper.get('footer').element.querySelector('p')?.textContent,
    ).toContain('닉네임');
  });
});

it('honors current-tab withdrawal even when localStorage writes fail', async () => {
  const { writeTrainingConsent } = await import('../../src/training-consent');
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
