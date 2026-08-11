"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { translateApiError } from "../../lib/errors";
import type { Contacts } from "../../lib/types";
import { useToast } from "../../lib/useToast";
import { useUnsavedGuard } from "../../lib/useUnsavedGuard";
import FormActions from "../../components/FormActions";
import Toast from "../../components/Toast";

// Пустое/пробельное поле → null, остальное — без крайних пробелов: проверки
// выше идут по trim(), и сохранять сырое значение («05:09:000045:476 » с
// хвостовым пробелом) значило бы отдать на сайт то, что не проверялось.
function s(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

// Поле map_embed намеренно НЕ редактируется: сайт нигде не выводит карту,
// поэтому админка не собирает ввод «в никуда» (колонка в БД сохраняется).
type ContactsKey = Exclude<keyof Contacts, "map_embed">;

// ── Маска телефона «+7 (999) 123-45-67» ──────────────────────────────
// В поле показывается маска, в API уходит канонический «+7XXXXXXXXXX».
// Без библиотек: форматирование на каждый ввод + пересчёт позиции каретки
// по количеству цифр слева от неё (это делает предсказуемыми и Backspace,
// и вставку из буфера, и правку в середине номера).

/** Цифры номера, приведённые к 7XXXXXXXXXX (не длиннее 11). */
function phoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d === "") return "";
  if (d[0] === "8") d = "7" + d.slice(1); // привычный набор «8 900…»
  else if (d[0] !== "7") d = "7" + d; // «900…» — код страны дописываем сами
  return d.slice(0, 11);
}

/** Цифры → маска; незаконченный номер форматируется по мере ввода. */
function formatPhone(d: string): string {
  if (d === "") return "";
  const rest = d.slice(1); // без кода страны
  let out = "+7";
  if (rest.length > 0) out += ` (${rest.slice(0, 3)}`;
  if (rest.length >= 3) out += ")";
  if (rest.length > 3) out += ` ${rest.slice(3, 6)}`;
  if (rest.length > 6) out += `-${rest.slice(6, 8)}`;
  if (rest.length > 8) out += `-${rest.slice(8, 10)}`;
  return out;
}

/** Значение содержит буквы — это ссылка (wa.me/…), маску не применяем. */
function isLinkLike(v: string): boolean {
  return /[a-zA-Zа-яА-Я]/.test(v);
}

/** Значение из API → вид для поля (полный номер показываем маской). */
function phoneFromApi(v: string): string {
  const t = v.trim();
  if (t === "" || isLinkLike(t)) return t;
  const d = phoneDigits(t);
  // Неполный/непонятный номер оставляем как есть: пользователь увидит,
  // что именно лежит в базе, а валидация подскажет про формат.
  return d.length === 11 ? formatPhone(d) : t;
}

/** Вид для поля → канонический «+7XXXXXXXXXX» для API. */
function phoneToApi(v: string): string {
  const t = v.trim();
  if (t === "" || isLinkLike(t)) return t;
  const d = phoneDigits(t);
  return d.length === 11 ? "+" + d : t;
}

/** Позиция каретки сразу после n-й цифры отформатированной строки. */
function caretAfterDigit(formatted: string, n: number): number {
  if (n <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] >= "0" && formatted[i] <= "9") {
      count += 1;
      if (count === n) return i + 1;
    }
  }
  return formatted.length;
}

/**
 * Применить маску к «сырому» значению поля и вернуть каретку на ту же
 * цифру, где она была. caret — позиция в сыром значении.
 */
function applyPhoneMask(
  el: HTMLInputElement,
  raw: string,
  caret: number,
  commit: (formatted: string) => void
): void {
  const rawDigits = raw.replace(/\D/g, "");
  const digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length;
  const norm = phoneDigits(raw);
  const formatted = formatPhone(norm);
  // Маска могла дописать код страны — курсор смещается на столько же цифр.
  const added = norm.length - rawDigits.length;
  const target = Math.min(digitsBefore + Math.max(added, 0), norm.length);
  commit(formatted);
  const pos = caretAfterDigit(formatted, target);
  // Значение проставляет React — каретку двигаем после его коммита.
  requestAnimationFrame(() => {
    if (document.activeElement === el) el.setSelectionRange(pos, pos);
  });
}

// maxLength соответствует колонкам БД (String(32)/String(64)/String(255)),
// иначе чуть длинное значение падало бы необъяснимой «Ошибкой сервера (500)».
const FIELDS: {
  key: ContactsKey;
  label: string;
  hint?: string;
  maxLength?: number;
  placeholder?: string;
  /** Поле с маской телефона (в API уходит +7XXXXXXXXXX). */
  mask?: boolean;
  /** Поле принимает и ссылку (wa.me/…) — её маска не трогает. */
  allowLink?: boolean;
}[] = [
  {
    key: "phone",
    label: "Телефон",
    maxLength: 32,
    mask: true,
    placeholder: "+7 (999) 123-45-67",
    hint: "Показывается в шапке и футере; один номер в формате +7 (999) 123-45-67",
  },
  {
    key: "email",
    label: "Email",
    maxLength: 255,
    hint: "Публичная почта отдела продаж",
  },
  {
    key: "telegram",
    label: "Telegram",
    maxLength: 255,
    hint: "Ссылка t.me/… или @имя — кнопка мессенджера на сайте",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    maxLength: 255,
    mask: true,
    allowLink: true,
    placeholder: "+7 (999) 123-45-67",
    hint: "Номер в формате +7 (999) 123-45-67 или ссылка wa.me/… — кнопка мессенджера на сайте",
  },
  { key: "address", label: "Адрес", hint: "Адрес офиса продаж / объекта" },
  {
    key: "cadastral_number",
    label: "Кадастровый номер участка",
    maxLength: 64,
    hint: "Например 05:09:000045:476 — выводится в футере сайта",
  },
  {
    key: "work_hours",
    label: "Часы работы",
    maxLength: 255,
    hint: "Например «Ежедневно 9:00–21:00»",
  },
  {
    key: "inn",
    label: "ИНН",
    maxLength: 32,
    hint: "Реквизиты юрлица — выводятся в футере; 10 или 12 цифр",
  },
  {
    key: "ogrn",
    label: "ОГРН",
    maxLength: 32,
    hint: "Реквизиты юрлица — выводятся в футере; 13 цифр (ОГРНИП — 15)",
  },
];

// Клиентская проверка форматов перед сохранением: битые значения дают
// мёртвые ссылки tel:/mailto:/wa.me и неверные реквизиты в футере сайта.
function validate(form: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  const val = (k: ContactsKey) => (form[k] ?? "").trim();
  const digits = (v: string) => v.replace(/\D/g, "");

  const phone = val("phone");
  if (phone !== "") {
    const d = digits(phone);
    // Ровно 11 цифр, код страны 7 или 8 — иначе на сайте будет мёртвая
    // ссылка tel:.
    if (d.length !== 11 || (d[0] !== "7" && d[0] !== "8")) {
      errors.phone = "Введите номер полностью: +7 (999) 123-45-67";
    }
  }
  const email = val("email");
  if (email !== "" && !/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = "Некорректный email — формат imya@domen.ru";
  }
  const telegram = val("telegram");
  if (
    telegram !== "" &&
    !/^@[\w\d_]+$/i.test(telegram) &&
    !/^(https?:\/\/)?t\.me\//i.test(telegram)
  ) {
    errors.telegram = "Укажите @имя или ссылку t.me/…";
  }
  const whatsapp = val("whatsapp");
  if (whatsapp !== "") {
    if (isLinkLike(whatsapp)) {
      // Ссылку оставляем как есть — маска её не трогает.
      if (!/^https?:\/\//i.test(whatsapp) && !/^wa\.me\//i.test(whatsapp)) {
        errors.whatsapp =
          "Укажите номер +7 (999) 123-45-67 или ссылку wa.me/…";
      }
    } else {
      const d = digits(whatsapp);
      if (d.length !== 11 || (d[0] !== "7" && d[0] !== "8")) {
        errors.whatsapp =
          "Введите номер полностью: +7 (999) 123-45-67 — или вставьте ссылку wa.me/…";
      }
    }
  }
  const inn = val("inn");
  if (inn !== "" && !/^(\d{10}|\d{12})$/.test(inn)) {
    errors.inn = "ИНН — 10 или 12 цифр без пробелов";
  }
  const ogrn = val("ogrn");
  if (ogrn !== "" && !/^(\d{13}|\d{15})$/.test(ogrn)) {
    errors.ogrn = "ОГРН — 13 цифр (ОГРНИП — 15) без пробелов";
  }
  const cadastral = val("cadastral_number");
  if (cadastral !== "" && !/^\d{2}:\d{2}:\d{6,7}:\d+$/.test(cadastral)) {
    errors.cadastral_number = "Формат кадастрового номера: 05:09:000045:476";
  }
  return errors;
}

export default function ContactsPage() {
  const { msg, show } = useToast();
  const [form, setForm] = useState<Record<string, string>>({});
  const [snapshot, setSnapshot] = useState<string>("{}");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
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
    apiFetch<Contacts>("/api/v1/admin/contacts")
      .then((data) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        FIELDS.forEach((f) => {
          const raw = (data[f.key] as string | null) ?? "";
          // Канонический «+79991234567» из API показываем маской.
          next[f.key] = f.mask ? phoneFromApi(raw) : raw;
        });
        setForm(next);
        setSnapshot(JSON.stringify(next));
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

  function set(key: ContactsKey, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // Ввод в поле с маской: номер форматируется, ссылка wa.me/… (только там,
  // где она разрешена) остаётся как есть.
  function setMasked(
    key: ContactsKey,
    allowLink: boolean,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const el = e.target;
    const raw = el.value;
    if (allowLink && isLinkLike(raw)) {
      set(key, raw);
      return;
    }
    applyPhoneMask(el, raw, el.selectionStart ?? raw.length, (v) =>
      set(key, v)
    );
  }

  // Backspace на символе маски («)», «-», пробел) удаляет ближайшую цифру
  // слева — иначе курсор «застревает» на разделителях.
  function onMaskedKeyDown(
    key: ContactsKey,
    allowLink: boolean,
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (e.key !== "Backspace") return;
    const el = e.currentTarget;
    if (allowLink && isLinkLike(el.value)) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start !== end || start === 0) return;
    const prevChar = el.value[start - 1];
    if (prevChar >= "0" && prevChar <= "9") return; // обычное поведение
    e.preventDefault();
    let i = start - 1;
    while (i >= 0 && !(el.value[i] >= "0" && el.value[i] <= "9")) i -= 1;
    if (i < 0) return;
    const next = el.value.slice(0, i) + el.value.slice(i + 1);
    applyPhoneMask(el, next, i, (v) => set(key, v));
  }

  async function save() {
    // Защита от затирания: без успешной загрузки PUT обнулил бы
    // незаполненные поля на живом сайте.
    if (!loaded) return;
    const all = validate(form);
    if (Object.keys(all).length > 0) {
      setErrors(all);
      const first = FIELDS.find((f) => all[f.key])?.key;
      if (first) {
        requestAnimationFrame(() => {
          const el = document.getElementById(first);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          (el as HTMLInputElement | null)?.focus?.({ preventScroll: true });
        });
      }
      show("Исправьте выделенные поля", "error");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<Contacts> = {
        // В API — канонический вид без маски: +7XXXXXXXXXX.
        phone: s(phoneToApi(form.phone || "")),
        email: s(form.email || ""),
        telegram: s(form.telegram || ""),
        whatsapp: s(phoneToApi(form.whatsapp || "")),
        address: s(form.address || ""),
        cadastral_number: s(form.cadastral_number || ""),
        work_hours: s(form.work_hours || ""),
        inn: s(form.inn || ""),
        ogrn: s(form.ogrn || ""),
      };
      await apiFetch<Contacts>("/api/v1/admin/contacts", {
        method: "PUT",
        body: payload,
      });
      setSnapshot(JSON.stringify(form));
      show("Контакты сохранены");
    } catch (err) {
      show(translateApiError(err, "Ошибка сохранения"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Контакты</h1>
          <p className="page-desc">
            Телефон, мессенджеры, адрес и реквизиты — шапка, футер и страница
            контактов сайта.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="row-gap" style={{ color: "var(--ink-45)" }}>
          <span className="spin" /> Загрузка…
        </div>
      ) : loadError ? (
        // Данные не загрузились — форму не показываем: сохранение пустой
        // формы стёрло бы все контакты на сайте.
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
          {FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label className="field-label" htmlFor={f.key}>
                {f.label}
              </label>
              <input
                id={f.key}
                className={"input" + (errors[f.key] ? " invalid" : "")}
                value={form[f.key] ?? ""}
                maxLength={f.maxLength}
                type={f.mask ? "tel" : undefined}
                inputMode={f.mask ? "tel" : undefined}
                placeholder={f.placeholder}
                onChange={
                  f.mask
                    ? (e) => setMasked(f.key, Boolean(f.allowLink), e)
                    : (e) => set(f.key, e.target.value)
                }
                onKeyDown={
                  f.mask
                    ? (e) => onMaskedKeyDown(f.key, Boolean(f.allowLink), e)
                    : undefined
                }
              />
              {errors[f.key] && (
                <span className="field-error">{errors[f.key]}</span>
              )}
              {f.hint && <span className="field-hint">{f.hint}</span>}
            </div>
          ))}

          <FormActions saving={saving} singleton onSave={() => void save()} />
        </form>
      )}

      <Toast msg={msg} />
    </div>
  );
}
