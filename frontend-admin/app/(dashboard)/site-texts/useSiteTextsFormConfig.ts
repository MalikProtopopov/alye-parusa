"use client";

// Конфиг формы «Тексты секций» с недоступными занятыми ключами:
// на каждый ключ — одна запись, занятые помечаются « — уже используется»
// (кроме ключа самой редактируемой записи). Дефолт селекта — первая
// СВОБОДНАЯ секция (иначе форма открывалась бы с занятой disabled-опцией
// и сохранение упиралось бы в непонятный 409). Кросс-проверка validate
// даёт инлайн-ошибку у селекта вместо тоста про «занятый адрес».
// Бэкенд недоступен — остаётся исходный конфиг без пометок.

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import {
  SECTION_KEY_OPTIONS,
  siteTextsConfig,
  type ResourceConfig,
  type ResourceItem,
} from "../../lib/resources";

export function useSiteTextsFormConfig(currentId?: string): {
  config: ResourceConfig;
  /** true — занятость ключей известна (или бэкенд недоступен): форму
      создания можно монтировать с правильным дефолтом. */
  ready: boolean;
} {
  const [state, setState] = useState<{
    config: ResourceConfig;
    ready: boolean;
  }>({ config: siteTextsConfig, ready: false });

  useEffect(() => {
    let cancelled = false;
    apiFetch<ResourceItem[]>("/api/v1/admin/site-texts")
      .then((items) => {
        if (cancelled) return;
        const usedBy = new Map(items.map((x) => [String(x.key), x.id]));
        const isBusy = (value: string) => {
          const ownerId = usedBy.get(value);
          return ownerId !== undefined && ownerId !== currentId;
        };
        const options = SECTION_KEY_OPTIONS.map((o) =>
          isBusy(o.value)
            ? {
                ...o,
                label: `${o.label} — уже используется`,
                disabled: true,
              }
            : o
        );
        const firstFree = options.find((o) => !o.disabled)?.value;
        setState({
          ready: true,
          config: {
            ...siteTextsConfig,
            fields: siteTextsConfig.fields.map((f) =>
              f.key === "key"
                ? { ...f, options, default: firstFree ?? f.default }
                : f
            ),
            validate: (form) => {
              const errors: Record<string, string> = {};
              const key = String(form.key ?? "");
              if (key && isBusy(key)) {
                errors.key =
                  "Для этой секции уже есть запись — отредактируйте существующую";
              }
              return errors;
            },
          },
        });
      })
      .catch(() => {
        // Без списка — конфиг без пометок, но форму не блокируем.
        if (!cancelled) setState({ config: siteTextsConfig, ready: true });
      });
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  return state;
}
