"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "../lib/api";
import { isNotFoundError, translateApiError } from "../lib/errors";
import { datetimeLocalToIso, formatDate, isoToDatetimeLocal } from "../lib/labels";
import type { FieldDef, ResourceConfig, ResourceItem } from "../lib/resources";
import { useAutoSlug } from "../lib/useAutoSlug";
import { useKnownPaths } from "../lib/useKnownPaths";
import { useToast } from "../lib/useToast";
import { useUnsavedGuard } from "../lib/useUnsavedGuard";
import {
  isEmptyHtml,
  looksLikeBareDomain,
  parseDecimal,
  validateFields,
} from "../lib/validation";
import CharCounter from "./CharCounter";
import Checkbox from "./Checkbox";
import FormActions from "./FormActions";
import MediaUpload from "./MediaUpload";
import RichTextEditor from "./RichTextEditor";
import Toast from "./Toast";

type FormState = Record<string, string | boolean>;

// Проценты: в UI — 30, в API — 0.30. Округления гасят двоичные хвосты
// (0.905 → 90.5 → 0.905 без потерь).
function fractionToPercent(v: number): string {
  return String(Math.round(v * 100 * 100) / 100);
}
function percentToFraction(n: number): number {
  return Math.round((n / 100) * 10000) / 10000;
}

// Начальное (пустое) состояние формы по описанию полей.
function emptyState(
  fields: FieldDef[],
  initial?: Record<string, string>
): FormState {
  const st: FormState = {};
  for (const f of fields) {
    if (f.type === "checkbox") {
      st[f.key] = typeof f.default === "boolean" ? f.default : false;
    } else if (f.type === "select") {
      st[f.key] =
        typeof f.default === "string"
          ? f.default
          : f.options?.[0]?.value ?? "";
    } else {
      st[f.key] = typeof f.default === "string" ? f.default : "";
    }
  }
  if (initial) {
    for (const [k, v] of Object.entries(initial)) {
      if (k in st) st[k] = v;
    }
  }
  return st;
}

// Данные с бэкенда → состояние формы.
function toFormState(fields: FieldDef[], item: ResourceItem): FormState {
  const st: FormState = {};
  for (const f of fields) {
    const raw = item[f.key];
    if (f.type === "checkbox") {
      st[f.key] = Boolean(raw);
    } else if (f.type === "datetime") {
      st[f.key] = typeof raw === "string" && raw ? isoToDatetimeLocal(raw) : "";
    } else if (raw === null || raw === undefined) {
      st[f.key] = "";
    } else if (f.type === "number" && f.percent && typeof raw === "number") {
      st[f.key] = fractionToPercent(raw);
    } else {
      st[f.key] = String(raw);
    }
  }
  return st;
}

// Состояние формы → тело запроса.
function buildPayload(
  fields: FieldDef[],
  form: FormState
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const f of fields) {
    const v = form[f.key];
    if (f.type === "checkbox") {
      payload[f.key] = Boolean(v);
    } else if (f.type === "richtext") {
      const s = String(v);
      payload[f.key] = isEmptyHtml(s) ? (f.required ? "" : null) : s;
    } else if (f.type === "number") {
      const s = String(v).trim();
      if (s === "") {
        payload[f.key] = f.key === "sort" ? 0 : null;
      } else {
        // parseDecimal понимает «8,5» и «5 000 000»; NaN сюда не доходит —
        // validateFields блокирует сохранение с «Введите число» раньше.
        const n = parseDecimal(s);
        payload[f.key] = f.percent ? percentToFraction(n) : n;
      }
    } else if (f.type === "datetime") {
      const s = String(v).trim();
      payload[f.key] = s === "" ? null : datetimeLocalToIso(s);
    } else {
      const s = String(v).trim();
      payload[f.key] = s === "" ? (f.required ? "" : null) : s;
    }
  }
  return payload;
}

// Комбобокс путей сайта: свободный ввод + datalist известных страниц.
function PagePickerInput({
  field,
  value,
  invalid,
  onChange,
}: {
  field: FieldDef;
  value: string;
  invalid: boolean;
  onChange: (v: string) => void;
}) {
  const known = useKnownPaths();
  const listId = `${field.key}-known-paths`;
  return (
    <>
      <input
        id={field.key}
        className={
          "input" + (field.mono ? " mono" : "") + (invalid ? " invalid" : "")
        }
        type="text"
        list={known ? listId : undefined}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {known && (
        <datalist id={listId}>
          {known.map((p) => (
            <option key={p.path} value={p.path}>
              {p.label}
            </option>
          ))}
        </datalist>
      )}
    </>
  );
}

interface SlugCtx {
  /** Слаг заблокирован (edit-режим до нажатия «Изменить»). */
  locked: boolean;
  unlock: () => void;
  regenerate: () => void;
  markManual: () => void;
  isEdit: boolean;
}

function renderField(
  f: FieldDef,
  form: FormState,
  set: (key: string, value: string | boolean) => void,
  ctx: {
    onError: (msg: string) => void;
    recordKey: string;
    errors: Record<string, string>;
    slug?: SlugCtx;
  }
) {
  const error = ctx.errors[f.key];

  if (f.type === "checkbox") {
    return (
      <div className="field" key={f.key} id={`field-${f.key}`}>
        <Checkbox
          id={f.key}
          checked={Boolean(form[f.key])}
          onChange={(next) => set(f.key, next)}
          label={f.label}
          hint={f.hint}
        />
        {error && <span className="field-error">{error}</span>}
      </div>
    );
  }

  const value = String(form[f.key] ?? "");
  const showCounter = f.counter || f.maxLength !== undefined;
  const labelText = (
    <>
      {f.label}
      {f.required ? " *" : ""}
    </>
  );

  if (f.type === "media") {
    return (
      <div className="field" key={f.key} id={`field-${f.key}`}>
        <span className="field-label" id={`${f.key}-label`}>
          {labelText}
        </span>
        <MediaUpload
          id={f.key}
          value={value}
          onChange={(url) => set(f.key, url)}
          accept={f.accept ?? "image"}
          noWidthWarning={f.noWidthWarning}
          onError={ctx.onError}
          ariaLabelledby={`${f.key}-label`}
        />
        {error && <span className="field-error">{error}</span>}
        {f.hint && <span className="field-hint">{f.hint}</span>}
      </div>
    );
  }

  if (f.type === "richtext") {
    return (
      <div className="field" key={f.key} id={`field-${f.key}`}>
        <span className="field-label" id={`${f.key}-label`}>
          {labelText}
        </span>
        <RichTextEditor
          id={f.key}
          value={value}
          onChange={(html) => set(f.key, html)}
          initKey={ctx.recordKey + ":" + f.key}
          ariaLabelledby={`${f.key}-label`}
        />
        {error && <span className="field-error">{error}</span>}
        {f.hint && <span className="field-hint">{f.hint}</span>}
      </div>
    );
  }

  // Слаг-поле с авто-генерацией: new — авто из title + «↻ Из названия»,
  // edit — заблокировано до явного «Изменить» (смена адреса = смена URL).
  const isSlugField = Boolean(f.slugFrom) && ctx.slug !== undefined;
  const slugLocked = isSlugField && ctx.slug!.locked;

  return (
    <div className="field" key={f.key} id={`field-${f.key}`}>
      <div className="field-label-row">
        <label className="field-label" htmlFor={f.key}>
          {labelText}
        </label>
        {showCounter && <CharCounter value={value} max={f.maxLength} />}
      </div>
      {f.type === "textarea" ? (
        <textarea
          id={f.key}
          className={"textarea" + (error ? " invalid" : "")}
          value={value}
          onChange={(e) => set(f.key, e.target.value)}
        />
      ) : f.type === "select" ? (
        <select
          id={f.key}
          className={"select" + (error ? " invalid" : "")}
          value={value}
          onChange={(e) => set(f.key, e.target.value)}
        >
          {/* Значение вне списка опций (легаси-данные): показываем его явно,
              иначе селект выглядит пустым, а «невидимое» значение сохраняется */}
          {value !== "" && !f.options?.some((o) => o.value === value) && (
            <option value={value}>{`Неизвестное значение: ${value}`}</option>
          )}
          {f.options?.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      ) : f.type === "pagePicker" ? (
        <PagePickerInput
          field={f}
          value={value}
          invalid={Boolean(error)}
          onChange={(v) => set(f.key, v)}
        />
      ) : isSlugField ? (
        <div className="slug-row">
          <input
            id={f.key}
            className={
              "input" + (f.mono ? " mono" : "") + (error ? " invalid" : "")
            }
            type="text"
            value={value}
            placeholder={f.placeholder}
            readOnly={slugLocked}
            onChange={(e) => {
              ctx.slug!.markManual();
              // Слаг всегда строчный: вставка «Proektnaya-Deklaraciya»
              // не должна падать с непонятной ошибкой формата.
              set(f.key, e.target.value.toLowerCase());
            }}
          />
          {slugLocked ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={ctx.slug!.unlock}
              title="Разблокировать изменение адреса"
            >
              Изменить
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm"
              onClick={ctx.slug!.regenerate}
              title="Пересобрать адрес из названия"
            >
              ↻ Из названия
            </button>
          )}
        </div>
      ) : (
        // Числа — текстовый инпут с цифровой клавиатурой: принимает «8,5» и
        // «5 000 000» (валидация — parseDecimal), не «крутится» колесом мыши
        // и не превращает нечисловой ввод в пустую строку (badInput).
        // min/max проверяет validateFields, а не нативные стрелки.
        <input
          id={f.key}
          className={
            "input" + (f.mono ? " mono" : "") + (error ? " invalid" : "")
          }
          type={f.type === "datetime" ? "datetime-local" : "text"}
          inputMode={f.type === "number" ? "decimal" : undefined}
          value={value}
          placeholder={f.placeholder}
          onChange={(e) => set(f.key, e.target.value)}
          onBlur={
            f.type === "url"
              ? (e) => {
                  // Дружелюбие к «sberbank.ru»: дописываем https:// сами.
                  const v = e.target.value.trim();
                  if (v && looksLikeBareDomain(v)) {
                    set(f.key, `https://${v}`);
                  }
                }
              : undefined
          }
        />
      )}
      {error && <span className="field-error">{error}</span>}
      {isSlugField && slugLocked && (
        <span className="field-hint">
          Адрес опубликованной страницы. При изменении старый адрес получит
          301-редирект на новый
        </span>
      )}
      {f.hint && <span className="field-hint">{f.hint}</span>}
    </div>
  );
}

/**
 * Универсальная форма создания/редактирования сущности.
 * singleton (config.singleton): загрузка GET /admin/<path>, сохранение PUT,
 * без списка и удаления.
 * aside: необязательная колонка предпросмотра (живой рендер из state формы).
 * initial: префилл полей при создании (например ?slug= из «Страниц без SEO»).
 */
export default function ResourceForm({
  config,
  id,
  aside,
  initial,
}: {
  config: ResourceConfig;
  id?: string;
  aside?: (form: Record<string, string | boolean>) => React.ReactNode;
  initial?: Record<string, string>;
}) {
  const router = useRouter();
  const { msg, show, dismiss } = useToast();
  const singleton = Boolean(config.singleton);
  const isEdit = Boolean(id);
  const shouldLoad = isEdit || singleton;

  const [form, setForm] = useState<FormState>(() =>
    emptyState(config.fields, initial)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(shouldLoad);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Запись не найдена (404/битый id) — отдельный сценарий: «Повторить» не поможет.
  const [loadNotFound, setLoadNotFound] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  // Когда запись сохранялась в последний раз (updated_at из API) —
  // подсказка при параллельном редактировании в двух вкладках.
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  // 401 при сохранении: постоянная плашка «Войти заново» (тост исчезает,
  // а форма с данными остаётся смонтированной — вход в новой вкладке).
  const [sessionExpired, setSessionExpired] = useState(false);
  const [slugUnlocked, setSlugUnlocked] = useState(false);

  // Снапшот сохранённого состояния — источник dirty-флага.
  const [snapshot, setSnapshot] = useState<string>(() =>
    JSON.stringify(emptyState(config.fields, initial))
  );
  const dirty = useMemo(
    () => !loading && JSON.stringify(form) !== snapshot,
    [form, snapshot, loading]
  );
  useUnsavedGuard(dirty && !saving && !deleting);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setLoadNotFound(false);
    const url = singleton
      ? `/api/v1/admin/${config.path}`
      : `/api/v1/admin/${config.path}/${id}`;
    apiFetch<ResourceItem>(url)
      .then((item) => {
        if (cancelled) return;
        const st = toFormState(config.fields, item);
        setForm(st);
        setSnapshot(JSON.stringify(st));
        setUpdatedAt(
          typeof item.updated_at === "string" ? item.updated_at : null
        );
      })
      .catch((err) => {
        if (cancelled) return;
        if (isNotFoundError(err)) {
          setLoadNotFound(true);
          setLoadError("Запись не найдена — возможно, её удалили");
        } else {
          setLoadError(translateApiError(err, "Ошибка загрузки"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Зависим от config.path, а НЕ от объекта config: разделы, где конфиг
    // достраивается асинхронно (site-texts помечает занятые ключи), меняют
    // его идентичность — перезагрузка формы стёрла бы набранное.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.path, id, singleton, shouldLoad, loadAttempt]);

  const set = useCallback((key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // Авто-слаг: поле со slugFrom (обычно slug ← title), только при создании.
  const slugField = config.fields.find((f) => f.slugFrom);
  const autoSlug = useAutoSlug({
    enabled: !isEdit && !singleton && Boolean(slugField),
    source: slugField ? String(form[slugField.slugFrom!] ?? "") : "",
    onSlug: (slug) => {
      if (slugField) set(slugField.key, slug);
    },
  });
  const slugCtx: SlugCtx | undefined = slugField
    ? {
        locked: isEdit && !slugUnlocked,
        unlock: () => setSlugUnlocked(true),
        regenerate: autoSlug.regenerate,
        markManual: autoSlug.markManual,
        isEdit,
      }
    : undefined;

  // Показ всех ошибок: подсветка + скролл/фокус к первому невалидному полю.
  function applyErrors(map: Record<string, string>) {
    setErrors(map);
    const firstKey = config.fields.find((f) => map[f.key])?.key;
    if (!firstKey) return;
    requestAnimationFrame(() => {
      const el =
        document.getElementById(firstKey) ??
        document.getElementById(`field-${firstKey}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLElement && "focus" in el) {
        (el as HTMLInputElement).focus?.({ preventScroll: true });
      }
    });
  }

  // 409 slug_exists: ищем владельца адреса в админ-списке.
  async function handleSlugConflict(err: ApiError): Promise<boolean> {
    if (err.status !== 409) return false;
    // Редиректы: 409 path_exists → инлайн-ошибка у поля «Откуда».
    if (
      err.data === "path_exists" &&
      config.fields.some((f) => f.key === "from_path")
    ) {
      const text = translateApiError(err);
      applyErrors({ from_path: text });
      show(text, "error");
      return true;
    }
    const sf = config.fields.find((f) => f.key === "slug");
    if (!sf) return false;
    const slug = String(form[sf.key] ?? "").trim();
    let ownerTitle: string | null = null;
    try {
      // Форма с данными смонтирована: 401 здесь не должен уводить на /login.
      const list = await apiFetch<ResourceItem[]>(
        `/api/v1/admin/${config.path}`,
        { on401: "silent" }
      );
      const owner = list.find(
        (x) => String(x[sf.key] ?? "") === slug && x.id !== id
      );
      if (owner) {
        ownerTitle = String(owner[config.nameField] ?? "") || null;
      }
    } catch {
      /* без списка — покажем сообщение без владельца */
    }
    const text = ownerTitle
      ? `Адрес «${slug}» уже занят записью «${ownerTitle}»`
      : `Адрес «${slug}» уже занят другой записью`;
    applyErrors({ [sf.key]: text });
    show(text, "error");
    return true;
  }

  async function save(exitAfter: boolean) {
    // 1. Клиентская валидация: все ошибки разом.
    const fieldErrors = validateFields(config.fields, form);
    const crossErrors = config.validate ? config.validate(form) : {};
    const all = { ...crossErrors, ...fieldErrors };
    if (Object.keys(all).length > 0) {
      applyErrors(all);
      show("Исправьте выделенные поля", "error");
      return;
    }

    const payload = buildPayload(config.fields, form);

    // 2. Необязательный confirm (перенос пометки «Политика» и т.п.).
    if (config.confirmSave) {
      setSaving(true);
      let confirmText: string | null = null;
      try {
        confirmText = await config.confirmSave(payload, { id, isEdit });
      } finally {
        setSaving(false);
      }
      if (confirmText && !window.confirm(confirmText)) return;
    }

    setSessionExpired(false);
    setSaving(true);
    try {
      if (singleton) {
        const saved = await apiFetch<ResourceItem>(
          `/api/v1/admin/${config.path}`,
          { method: "PUT", body: payload }
        );
        setSnapshot(JSON.stringify(form));
        if (typeof saved?.updated_at === "string") {
          setUpdatedAt(saved.updated_at);
        }
        show("Изменения сохранены");
      } else if (isEdit) {
        const saved = await apiFetch<ResourceItem>(
          `/api/v1/admin/${config.path}/${id}`,
          { method: "PUT", body: payload }
        );
        setSnapshot(JSON.stringify(form));
        if (typeof saved?.updated_at === "string") {
          setUpdatedAt(saved.updated_at);
        }
        show("Изменения сохранены");
        if (exitAfter) setTimeout(() => router.push(config.route), 500);
      } else {
        const created = await apiFetch<ResourceItem>(
          `/api/v1/admin/${config.path}`,
          { method: "POST", body: payload }
        );
        setSnapshot(JSON.stringify(form));
        show("Запись создана");
        if (exitAfter) {
          setTimeout(() => router.push(config.route), 500);
        } else if (created?.id) {
          // Остаёмся в записи: URL меняется на /{route}/{id} сразу — задержка
          // молча теряла бы правки, внесённые за эти полсекунды (ремаунт с сервера)
          router.replace(`${config.route}/${created.id}`);
        }
      }
    } catch (err) {
      if (err instanceof ApiError && (await handleSlugConflict(err))) return;
      if (err instanceof ApiError && err.status === 401) {
        // Только баннер: тост с другой формулировкой говорил бы о том же
        // самом, но исчезал раньше, чем пользователь успевал прочитать.
        setSessionExpired(true);
      } else {
        show(translateApiError(err, "Ошибка сохранения"), "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id) return;
    const name = String(form[config.nameField] ?? "");
    // Те же предупреждения о последствиях, что и при удалении из списка:
    // запись со своей страницей на сайте (slug без «/») уводит её в 404.
    const slug = typeof form.slug === "string" ? form.slug : "";
    const hasOwnPage =
      Boolean(config.siteHref?.({ id, ...form })) &&
      slug !== "" &&
      !slug.startsWith("/");
    const text =
      config.confirmDelete?.({ id, ...form }, []) ??
      (hasOwnPage
        ? `Удалить запись${name ? ` «${name}»` : ""}? Её страница на сайте перестанет открываться, действие необратимо. Если нужно только скрыть с сайта — выключите тумблер «Активна».`
        : `Удалить запись${name ? ` «${name}»` : ""}?`);
    if (!window.confirm(text)) return;
    setDeleting(true);
    try {
      await apiFetch<void>(`/api/v1/admin/${config.path}/${id}`, {
        method: "DELETE",
      });
      setSnapshot(JSON.stringify(form)); // сброс dirty перед уходом
      show("Запись удалена");
      setTimeout(() => router.push(config.route), 500);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSessionExpired(true); // без тоста — см. save()
      } else {
        show(translateApiError(err, "Ошибка удаления"), "error");
      }
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="row-gap" style={{ color: "var(--ink-45)" }}>
        <span className="spin" /> Загрузка…
      </div>
    );
  }

  const heading = singleton
    ? config.singletonTitle ?? config.titlePlural
    : isEdit
    ? config.editTitle
    : config.newTitle;

  // Ошибка загрузки — не тупик: понятный текст + «К списку» и «Повторить».
  if (loadError) {
    return (
      <div>
        <div className="page-head">
          <h1>{heading}</h1>
        </div>
        <div className="alert alert-error">{loadError}</div>
        <div className="row-gap">
          {!singleton && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => router.push(config.route)}
            >
              К списку
            </button>
          )}
          {!loadNotFound && (
            <button
              type="button"
              className="btn"
              onClick={() => setLoadAttempt((n) => n + 1)}
            >
              Повторить
            </button>
          )}
        </div>
      </div>
    );
  }

  // Ключ записи для richtext: инициализация contentEditable один раз на запись.
  const recordKey = singleton ? "singleton" : id ?? "new";

  const formEl = (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        void save(false);
      }}
      style={{ maxWidth: 720 }}
    >
      {config.fields.map((f) =>
        renderField(f, form, set, {
          onError: (m) => show(m, "error"),
          recordKey,
          errors,
          slug: slugCtx,
        })
      )}

      {sessionExpired && (
        <div className="alert alert-error">
          Сессия истекла.{" "}
          <a href="/login" target="_blank" rel="noreferrer">
            Войдите заново в новой вкладке
          </a>{" "}
          — затем вернитесь сюда и сохраните ещё раз: данные формы на месте
        </div>
      )}

      <FormActions
        saving={saving}
        deleting={deleting}
        createMode={!isEdit && !singleton}
        singleton={singleton}
        onSave={() => void save(false)}
        onSaveExit={singleton ? undefined : () => void save(true)}
        onDelete={isEdit && !singleton ? onDelete : undefined}
      />
    </form>
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{heading}</h1>
          {singleton && config.description && (
            <p className="page-desc">{config.description}</p>
          )}
          {updatedAt && (
            <p className="page-desc">Обновлено: {formatDate(updatedAt)}</p>
          )}
        </div>
        <div className="spacer" />
        {!singleton && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (
                dirty &&
                !window.confirm(
                  "На странице есть несохранённые изменения. Уйти без сохранения?"
                )
              ) {
                return;
              }
              router.push(config.route);
            }}
          >
            К списку
          </button>
        )}
      </div>

      {aside ? (
        <div className="banner-layout">
          {formEl}
          <div className="banner-preview-col">{aside(form)}</div>
        </div>
      ) : (
        formEl
      )}

      <Toast msg={msg} onClose={dismiss} />
    </div>
  );
}
