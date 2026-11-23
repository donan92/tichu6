import { useTranslation } from 'i18next-vue';
import { combinationMessage } from '../combinations';
import type { Card, Message, RoomTitle } from '../types';
export function useText() {
  const { t } = useTranslation();
  function message(value: Message | string | null): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const params = { ...value.params };
    if (value.code === 'log.play') {
      params.kind =
        typeof params.power === 'number' &&
        typeof params.size === 'number' &&
        typeof params.bomb === 'number'
          ? message(
              combinationMessage(
                {
                  kind: String(params.kind),
                  power: params.power,
                  size: params.size,
                  bomb: params.bomb,
                },
                params.special as Card['special'],
              ),
            )
          : t(`kind.${params.kind}`);
    }
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
