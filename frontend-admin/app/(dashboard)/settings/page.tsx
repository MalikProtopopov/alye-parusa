"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { translateApiError } from "../../lib/errors";
import type { Settings } from "../../lib/types";
import { useToast } from "../../lib/useToast";
import { useUnsavedGuard } from "../../lib/useUnsavedGuard";
import Checkbox from "../../components/Checkbox";
import FormActions from "../../components/FormActions";
import Toast from "../../components/Toast";

interface FormState {
  show_prices: boolean;
  notify_channel: string;
  metrika_id: string;
  yandex_verification: string;
  google_verification: string;
}

const DEFAULTS: FormState = {
  show_prices: true,
  notify_channel: "telegram",
  metrika_id: "",
  yandex_verification: "",
  google_verification: "",
};

// Номер счётчика Метрики: 5–12 цифр. Вставка целого сниппета установки
// содержит номер несколько раз плюс посторонние числа — берём первую
// длинную (5+) цифровую серию, а не склейку всех цифр подряд.
function normalizeMetrikaId(v: string): string {
  if (/^\d*$/.test(v)) return v.slice(0, 12);
  const run = v.match(/\d{5,}/);
  if (run) return run[0].slice(0, 12);
  return v.replace(/\D/g, "").slice(0, 12);
}

// Код подтверждения вебмастера: если вставлен весь мета-тег
// (<meta … content="…">), молча извлекаем значение content.
function extractVerification(v: string): { value: string; extracted: boolean } {
  if (/<meta/i.test(v) || /content=["']/i.test(v)) {
    const m = v.match(/content=["']([^"']+)["']/i);
    if (m) return { value: m[1].trim(), extracted: true };
  }
  return { value: v, extracted: false };
}

export default function SettingsPage() {
  const { msg, show } = useToast();
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [snapshot, setSnapshot] = useState<string>(() =>
    JSON.stringify(DEFAULTS)
  );
  const [telegramConfigured, setTelegramConfigured] = useState<boolean | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dirty = useMemo(
    () => loaded && !loading && JSON.stringify(form) !== snapshot,
    [form, snapshot, loading, loaded]
  );
  useUnsavedGuard(dirty && !saving);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    apiFetch<Settings>("/api/v1/admin/settings")
      .then((data) => {
        if (cancelled) return;
        const st: FormState = {
          show_prices: Boolean(data.show_prices),
          notify_channel: data.notify_channel || "telegram",
          metrika_id: data.metrika_id || "",
          yandex_verification: data.yandex_verification || "",
          google_verification: data.google_verification || "",
        };
        setForm(st);
        setSnapshot(JSON.stringify(st));
        setTelegramConfigured(
          typeof data.telegram_configured === "boolean"
            ? data.telegram_configured
            : null
        );
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(translateApiError(err, "Ошибка загрузки"));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // Ввод кода подтверждения: вставленный целиком мета-тег нормализуем
  // сразу, с тостом-объяснением.
  function setVerification(
    key: "yandex_verification" | "google_verification",
    raw: string
  ) {
    const { value, extracted } = extractVerification(raw);
    set(key, value);
    if (extracted) show("Извлечено значение content");
  }

  function validate(f: FormState): Record<string, string> {
    const errs: Record<string, string> = {};
    const metrika = f.metrika_id.trim();
    if (metrika !== "" && !/^\d{5,12}$/.test(metrika)) {
      errs.metrika_id = "Номер счётчика — от 5 до 12 цифр";
    }
    for (const key of ["yandex_verification", "google_verification"] as const) {
      const v = f[key].trim();
      if (v !== "" && /[<>\s"']/.test(v)) {
        errs[key] = "Вставьте только значение content, не весь тег";
      } else if (v.length > 128) {
        errs[key] = "Слишком длинное значение — не больше 128 символов";
      }
    }
    return errs;
  }

  async function save() {
    // Без успешной загрузки сохранение отправило бы DEFAULTS и стёрло бы
    // счётчик и коды подтверждения.
    if (!loaded) return;
    // Страховка: если тег всё же попал в state (напр. автозаполнение) —
    // нормализуем перед проверкой.
    const normalized: FormState = { ...form };
    let changed = false;
    for (const key of ["yandex_verification", "google_verification"] as const) {
      const { value, extracted } = extractVerification(normalized[key]);
      if (extracted) {
        normalized[key] = value;
        changed = true;
      }
    }
    if (changed) {
      setForm(normalized);
      show("Извлечено значение content");
    }
    const errs = validate(normalized);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      show("Исправьте выделенные поля", "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch<Settings>("/api/v1/admin/settings", {
        method: "PUT",
        body: {
          show_prices: normalized.show_prices,
          notify_channel: normalized.notify_channel,
          metrika_id: normalized.metrika_id.trim() || null,
          yandex_verification: normalized.yandex_verification.trim() || null,
          google_verification: normalized.google_verification.trim() || null,
        },
      });
      setSnapshot(JSON.stringify(normalized));
      show("Настройки сохранены");
    } catch (err) {
      show(translateApiError(err, "Ошибка сохранения"), "error");
    } finally {
      setSaving(false);
    }
  }

  // Тестовое уведомление: проверяет токен/чат Telegram без реальной заявки.
  async function sendTest() {
    setTesting(true);
    try {
      await apiFetch<{ ok: boolean }>(
        "/api/v1/admin/settings/test-notification",
        { method: "POST" }
      );
      show("Тестовое уведомление отправлено — проверьте Telegram");
    } catch (err) {
      show(translateApiError(err, "Не удалось отправить уведомление"), "error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Настройки</h1>
          <p className="page-desc">
            Глобальные переключатели сайта: показ цен, уведомления о заявках,
            аналитика и подтверждение прав в вебмастерах.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="row-gap" style={{ color: "var(--ink-45)" }}>
          <span className="spin" /> Загрузка…
        </div>
      ) : loadError ? (
        // Данные не загрузились — форму не показываем: сохранение формы
        // с DEFAULTS стёрло бы счётчик Метрики и коды подтверждения.
        <div className="alert alert-error">
          {loadError}{" "}
          <button
            type="button"
            className="btn btn-sm"
            style={{ marginLeft: "var(--sp-2)" }}
            onClick={() => load()}
          >
            Повторить
          </button>
        </div>
      ) : (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          style={{ maxWidth: 720 }}
        >
          {/* Фичефлаг «показывать цены на сайте» (З6) */}
          <div className="field">
            <Checkbox
              id="show_prices"
              checked={form.show_prices}
              onChange={(next) => set("show_prices", next)}
              label="Показывать цены на сайте"
              hint="Выкл. → на сайте вместо цены показывается «Узнать цену»."
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="notify_channel">
              Канал уведомлений о заявках
            </label>
            <select
              id="notify_channel"
              className="select"
              style={{ maxWidth: 320 }}
              value={form.notify_channel}
              onChange={(e) => set("notify_channel", e.target.value)}
            >
              <option value="telegram">Telegram</option>
              <option value="none">Выключено</option>
              <option value="email" disabled>
                Email — не поддерживается
              </option>
            </select>
            {form.notify_channel === "telegram" &&
              telegramConfigured === false && (
                <span className="field-hint" style={{ color: "var(--warn-600)" }}>
                  Бот не настроен: задайте TELEGRAM_BOT_TOKEN и
                  TELEGRAM_CHAT_ID на сервере — без них уведомления не
                  отправляются.
                </span>
              )}
            <div className="row-gap" style={{ marginTop: "var(--sp-2)" }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={sendTest}
                disabled={testing || form.notify_channel !== "telegram"}
              >
                {testing ? "Отправка…" : "Отправить тестовое уведомление"}
              </button>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="metrika_id">
              Яндекс.Метрика — номер счётчика
            </label>
            <input
              id="metrika_id"
              className={"input" + (errors.metrika_id ? " invalid" : "")}
              style={{ maxWidth: 280 }}
              inputMode="numeric"
              // Без maxLength: вставленный сниппет счётчика длиннее лимита
              // обрезался бы ДО того, как normalizeMetrikaId извлечёт номер.
              // Длину проверяет валидация при сохранении.
              placeholder="Напр. 12345678"
              value={form.metrika_id}
              onChange={(e) =>
                set("metrika_id", normalizeMetrikaId(e.target.value))
              }
            />
            {errors.metrika_id && (
              <span className="field-error">{errors.metrika_id}</span>
            )}
            <span
              className="field-hint"
              style={{ display: "block", marginTop: 4 }}
            >
              Только номер счётчика (5–12 цифр), не весь код установки. Пусто
              — аналитика выключена. Счётчик запускается на сайте только
              после согласия посетителя в cookie-баннере (152-ФЗ). Цель
              «lead_submit» — отправка заявки.
            </span>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="yandex_verification">
              Яндекс.Вебмастер — код подтверждения
            </label>
            <input
              id="yandex_verification"
              className={
                "input mono" + (errors.yandex_verification ? " invalid" : "")
              }
              placeholder="напр. 1a2b3c4d5e6f7a8b"
              value={form.yandex_verification}
              onChange={(e) =>
                setVerification("yandex_verification", e.target.value)
              }
            />
            {errors.yandex_verification && (
              <span className="field-error">{errors.yandex_verification}</span>
            )}
            <span className="field-hint">
              Только значение content из мета-тега подтверждения, без
              «&lt;meta …&gt;». Если вставить весь тег — значение извлечётся
              автоматически.
            </span>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="google_verification">
              Google Search Console — код подтверждения
            </label>
            <input
              id="google_verification"
              className={
                "input mono" + (errors.google_verification ? " invalid" : "")
              }
              placeholder="напр. AbCdEf0123456789"
              value={form.google_verification}
              onChange={(e) =>
                setVerification("google_verification", e.target.value)
              }
            />
            {errors.google_verification && (
              <span className="field-error">{errors.google_verification}</span>
            )}
            <span className="field-hint">
              Только значение content из мета-тега подтверждения, без
              «&lt;meta …&gt;». Если вставить весь тег — значение извлечётся
              автоматически.
            </span>
          </div>

          <FormActions saving={saving} singleton onSave={() => void save()} />
        </form>
      )}

      <Toast msg={msg} />
    </div>
  );
}
