import { useTranslation } from 'i18next-vue';
import type { Message, RoomTitle } from '../types';
export function useText() {
  const { t } = useTranslation();
  function message(value: Message | string | null): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const params = { ...value.params };
    if (value.code === 'log.play') params.kind = t(`kind.${params.kind}`);
    return t(value.code, params);
  }
  function title(value?: RoomTitle): string {
    if (typeof value === 'string') return value;
    return value
      ? t('room.title', {
          adjective: t(`room.adjective.${value.adjective}`),
          noun: t(`room.noun.${value.noun}`),
          number: value.number,
        })
      : '';
  }
  return { t, message, title };
}
