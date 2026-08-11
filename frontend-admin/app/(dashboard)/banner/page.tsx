"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { translateApiError } from "../../lib/errors";
import { mediaUrl } from "../../lib/media";
import type { Banner } from "../../lib/types";
import { useToast } from "../../lib/useToast";
import { useUnsavedGuard } from "../../lib/useUnsavedGuard";
import FormActions from "../../components/FormActions";
import MediaUpload from "../../components/MediaUpload";
import Toast from "../../components/Toast";

// Пустое значение поля → null при отправке.
function s(v: string): string | null {
  return v.trim() === "" ? null : v;
}

const FIELDS: { key: keyof Banner; label: string; hint?: string }[] = [
  {
    key: "eyebrow",
    label: "Надзаголовок (eyebrow)",
    hint: "Мелкая строка капсом над заголовком, напр. «Апарт-отель на первой линии»",
  },
  { key: "title", label: "Заголовок", hint: "Главная фраза первого экрана" },
  {
    key: "subtitle",
    label: "Подзаголовок",
    hint: "1–2 предложения под заголовком",
  },
  {
    key: "cta_primary_label",
    label: "Основная кнопка — текст",
    hint: "Например «Получить презентацию»",
  },
  {
    key: "cta_primary_target",
    label: "Основная кнопка — ссылка/цель",
    hint: "Якорь блока (#form) или адрес страницы",
  },
  {
    key: "cta_secondary_label",
    label: "Второстепенная кнопка — текст",
  },
  {
    key: "cta_secondary_target",
    label: "Второстепенная кнопка — ссылка/цель",
    hint: "Якорь блока или адрес страницы",
  },
  { key: "background_url", label: "Фон баннера (фото)" },
];

// Кнопка показывается на сайте только когда заполнены И текст, И ссылка —
// проверяем обе пары перед сохранением (сайт молча скрывает половинчатую).
function validate(form: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  const v = (k: keyof Banner) => (form[k] ?? "").trim();
  if (v("cta_primary_label") !== "" && v("cta_primary_target") === "") {
    errors.cta_primary_target =
      "Укажите ссылку/цель — без неё сайт не покажет кнопку";
  }
  if (v("cta_primary_target") !== "" && v("cta_primary_label") === "") {
    errors.cta_primary_label =
      "Укажите текст кнопки — без него сайт не покажет кнопку";
  }
  if (v("cta_secondary_label") !== "" && v("cta_secondary_target") === "") {
    errors.cta_secondary_target =
      "Укажите ссылку/цель — без неё сайт не покажет кнопку";
  }
  if (v("cta_secondary_target") !== "" && v("cta_secondary_label") === "") {
    errors.cta_secondary_label =
      "Укажите текст кнопки — без него сайт не покажет кнопку";
  }
  return errors;
}

// Живой предпросмотр hero-блока главной страницы: рендерится из state формы
// в реальном времени, до сохранения. Мини-копия публичного баннера:
// тёмно-изумрудный фон, фото cover, градиент-оверлей и контент поверх.
// Сайт использует background_url только как неподвижный постер <img> —
// предпросмотр показывает ровно то же.
function BannerPreview({ form }: { form: Record<string, string> }) {
  // В поле хранится относительный путь /media/… — превью показывает файл
  // с домена API (иначе браузер искал бы его на домене админки).
  const bg = mediaUrl(form.background_url);
  const [bgBroken, setBgBroken] = useState(false);
  useEffect(() => setBgBroken(false), [bg]);
  const empty = (v: string | undefined) => !v || v.trim() === "";
  // Кнопка без ссылки (или ссылка без текста) на сайте не показывается —
  // в предпросмотре приглушаем её.
  const primaryIncomplete =
    !empty(form.cta_primary_label) && empty(form.cta_primary_target);
  const secondaryIncomplete =
    !empty(form.cta_secondary_label) && empty(form.cta_secondary_target);
  return (
    <div className="banner-hero" aria-hidden="true">
      {bg &&
        (bgBroken ? (
          // Файл не открылся — честная плашка вместо «сломанной картинки».
          <div className="banner-hero-missing">
            Фон не загрузился — файл не найден
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="banner-hero-bg"
            src={bg}
            alt=""
            onError={() => setBgBroken(true)}
          />
        ))}
      <div className="banner-hero-overlay" />
      <div className="banner-hero-content">
        <div
          className={"banner-hero-eyebrow" + (empty(form.eyebrow) ? " ph" : "")}
        >
          {form.eyebrow?.trim() || "Надзаголовок…"}
        </div>
        <div className={"banner-hero-title" + (empty(form.title) ? " ph" : "")}>
          {form.title?.trim() || "Заголовок баннера…"}
        </div>
        <div
          className={
            "banner-hero-subtitle" + (empty(form.subtitle) ? " ph" : "")
          }
        >
          {form.subtitle?.trim() || "Подзаголовок — 1–2 предложения…"}
        </div>
        <div className="banner-hero-ctas">
          <span
            className={
              "banner-hero-btn primary" +
              (empty(form.cta_primary_label) ? " ph" : "")
            }
            style={
              primaryIncomplete
                ? { opacity: 0.35, textDecoration: "line-through" }
                : undefined
            }
            title={
              primaryIncomplete
                ? "Без ссылки сайт не покажет кнопку"
                : undefined
            }
          >
            {form.cta_primary_label?.trim() || "Основная кнопка…"}
          </span>
          <span
            className={
              "banner-hero-btn secondary" +
              (empty(form.cta_secondary_label) ? " ph" : "")
            }
            style={
              secondaryIncomplete
                ? { opacity: 0.35, textDecoration: "line-through" }
                : undefined
            }
            title={
              secondaryIncomplete
                ? "Без ссылки сайт не покажет кнопку"
                : undefined
            }
          >
            {form.cta_secondary_label?.trim() || "Вторая кнопка…"}
          </span>
        </div>
        {(primaryIncomplete || secondaryIncomplete) && (
          <div
            style={{
              marginTop: 8,
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            Кнопка без ссылки не появится на сайте — заполните «ссылка/цель».
          </div>
        )}
      </div>
    </div>
  );
}

export default function BannerPage() {
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
    apiFetch<Banner>("/api/v1/admin/banner")
      .then((data) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        FIELDS.forEach((f) => {
          next[f.key] = (data[f.key] as string | null) ?? "";
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

  function set(key: keyof Banner, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function save() {
    // Защита от затирания: без успешной загрузки PUT обнулил бы
    // весь первый экран сайта.
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
      const payload: Banner = {
        eyebrow: s(form.eyebrow || ""),
        title: s(form.title || ""),
        subtitle: s(form.subtitle || ""),
        cta_primary_label: s(form.cta_primary_label || ""),
        cta_primary_target: s(form.cta_primary_target || ""),
        cta_secondary_label: s(form.cta_secondary_label || ""),
        cta_secondary_target: s(form.cta_secondary_target || ""),
        background_url: s(form.background_url || ""),
      };
      await apiFetch<Banner>("/api/v1/admin/banner", {
        method: "PUT",
        body: payload,
      });
      setSnapshot(JSON.stringify(form));
      show("Баннер сохранён");
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
          <h1>Hero / Баннер</h1>
          <p className="page-desc">
            Первый экран сайта. Заполненные здесь поля ЗАМЕНЯЮТ тексты глав
            скролл-hero; пустые поля — сайт показывает тексты глав. Фон —
            постер/резерв, когда видеосеквенция недоступна (медленная сеть,
            отключённый JS).
          </p>
        </div>
      </div>

      {loading ? (
        <div className="row-gap" style={{ color: "var(--ink-45)" }}>
          <span className="spin" /> Загрузка…
        </div>
      ) : loadError ? (
        // Данные не загрузились — форму не показываем: сохранение пустой
        // формы обнулило бы hero-баннер на живом сайте.
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
        <div className="banner-layout">
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            style={{ maxWidth: 720 }}
          >
            {FIELDS.map((f) => {
              const multiline = f.key === "subtitle";
              const media = f.key === "background_url";
              return (
                <div className="field" key={f.key}>
                  <label className="field-label" htmlFor={f.key}>
                    {f.label}
                  </label>
                  {media ? (
                    <MediaUpload
                      id={f.key}
                      value={form[f.key] ?? ""}
                      onChange={(url) => set(f.key, url)}
                      accept="image"
                      onError={(m) => show(m, "error")}
                    />
                  ) : multiline ? (
                    <textarea
                      id={f.key}
                      className={
                        "textarea" + (errors[f.key] ? " invalid" : "")
                      }
                      value={form[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      id={f.key}
                      className={"input" + (errors[f.key] ? " invalid" : "")}
                      value={form[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  )}
                  {errors[f.key] && (
                    <span className="field-error">{errors[f.key]}</span>
                  )}
                  {media ? (
                    <span className="field-hint">
                      Фото JPG/PNG/WebP до 10 МБ, рекомендуем от 1920 px по
                      ширине. Сайт показывает фон как неподвижный постер —
                      видео здесь не поддерживается
                    </span>
                  ) : (
                    f.hint && <span className="field-hint">{f.hint}</span>
                  )}
                </div>
              );
            })}

            <FormActions
              saving={saving}
              singleton
              onSave={() => void save()}
            />
          </form>

          <div className="banner-preview-col">
            <div className="banner-preview-label">Предпросмотр</div>
            <BannerPreview form={form} />
            <p className="banner-preview-note">
              Так баннер выглядит на главной. Сохраните, чтобы применить.
            </p>
          </div>
        </div>
      )}

      <Toast msg={msg} />
    </div>
  );
}
