import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, disposePinia, setActivePinia } from 'pinia';
import I18NextVue from 'i18next-vue';
import { i18next } from '../../src/localization';
import AppHeader from '../../src/components/AppHeader.vue';
import HomeView from '../../src/views/HomeView.vue';
import VersionNotes from '../../src/components/VersionNotes.vue';
import { useSessionStore } from '../../src/stores/session';
import { version } from '../../package.json';
import releases from '../../src/release-notes.json';
import en from '../../src/locales/en.json';
import ko from '../../src/locales/ko.json';
let pinia: ReturnType<typeof createPinia>;
const wrappers: { unmount: () => void }[] = [];
const plugins = () => [
  pinia,
  [I18NextVue, { i18next }] as [typeof I18NextVue, { i18next: typeof i18next }],
];
beforeEach(async () => {
  vi.stubGlobal('HTMLDialogElement', HTMLDialogElement);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function () {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function () {
      this.open = false;
    },
  });
  pinia = createPinia();
  setActivePinia(pinia);
  await i18next.changeLanguage('en');
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  disposePinia(pinia);
  vi.unstubAllGlobals();
});
it('opens five newest summaries, closes via button/Escape/backdrop, and restores focus repeatedly', async () => {
  const wrapper = mount(VersionNotes, {
    attachTo: document.body,
    global: { plugins: plugins() },
  });
  wrappers.push(wrapper);
  const trigger = wrapper.get('button');
  for (const dismissal of ['button', 'escape', 'backdrop']) {
    await trigger.trigger('click');
    const dialog = document.querySelector<HTMLDialogElement>('.patch-dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelectorAll('li')).toHaveLength(5);
    expect(dialog.querySelector('li')?.textContent).toContain(`v${version}`);
    for (const release of releases.slice(0, 5))
      expect(dialog.textContent).toContain(
        en[release.summary as keyof typeof en],
      );
    for (const release of releases.slice(5))
      expect(
        Array.from(
          dialog.querySelectorAll('.patch-version'),
          (node) => node.textContent,
        ),
      ).not.toContain(`v${release.version}`);
    if (dismissal === 'button')
      dialog.querySelector<HTMLButtonElement>('.patch-close')!.click();
    else
      dialog.dispatchEvent(
        new Event(dismissal === 'escape' ? 'cancel' : 'click', {
          bubbles: true,
          cancelable: true,
        }),
      );
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger.element);
  }
});
it('header version is separate from leave-game link and footer opens its own localized dialog', async () => {
  const session = useSessionStore();
  session.mode = 'room';
  const wrapper = mount(
    {
      components: { AppHeader, HomeView },
      template: '<AppHeader /><HomeView />',
    },
    { attachTo: document.body, global: { plugins: plugins() } },
  );
  wrappers.push(wrapper);
  await wrapper.get('header .version-trigger').trigger('click');
  expect(session.leaving).toBe(false);
  document
    .querySelector<HTMLButtonElement>('.patch-dialog .patch-close')!
    .click();
  await i18next.changeLanguage('ko');
  await wrapper.get('footer .version-trigger').trigger('click');
  const dialogs = Array.from(
    document.querySelectorAll<HTMLDialogElement>('.patch-dialog'),
  );
  const dialog = dialogs.find((d) => d.open)!;
  expect(dialog.textContent).toContain('최근 5개 업데이트');
  for (const release of releases.slice(0, 5))
    expect(dialog.textContent).toContain(
      ko[release.summary as keyof typeof ko],
    );
  expect(new Set(dialogs.map((d) => d.id)).size).toBe(2);
});
