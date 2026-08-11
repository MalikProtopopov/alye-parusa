"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "../../lib/api";
import { translateApiError } from "../../lib/errors";
import type {
  Availability,
  Floorplan,
  FloorplanInput,
  PlanCategory,
} from "../../lib/types";
import { AVAILABILITY_LABELS, AVAILABILITY_ORDER } from "../../lib/labels";
import { parseDecimal } from "../../lib/validation";
import { SLUG_RE } from "../../lib/slug";
import { useAutoSlug } from "../../lib/useAutoSlug";
import { useToast } from "../../lib/useToast";
import { useUnsavedGuard } from "../../lib/useUnsavedGuard";
import Checkbox from "../../components/Checkbox";
import FormActions from "../../components/FormActions";
import MediaUpload from "../../components/MediaUpload";
import RichTextEditor from "../../components/RichTextEditor";
import Toast from "../../components/Toast";

interface FormState {
  title: string;
  slug: string;
  category_id: string;
  description: string;
  area_m2: string;
  price: string;
  availability_status: Availability;
  floor: string;
  ceiling_height: string;
  image_url: string;
  active: boolean;
  sort: string;
}

const EMPTY: FormState = {
  title: "",
  slug: "",
  category_id: "",
  description: "",
  area_m2: "",
  price: "",
  availability_status: "available",
  floor: "",
  ceiling_height: "",
  image_url: "",
  active: true,
  sort: "0",
};

function fromFloorplan(fp: Floorplan): FormState {
  return {
    title: fp.title,
    slug: fp.slug,
    category_id: fp.category_id ?? "",
    description: fp.description ?? "",
    area_m2: String(fp.area_m2),
    price: fp.price === null || fp.price === undefined ? "" : String(fp.price),
    availability_status: fp.availability_status,
    floor: fp.floor === null || fp.floor === undefined ? "" : String(fp.floor),
    ceiling_height:
      fp.ceiling_height === null || fp.ceiling_height === undefined
        ? ""
        : String(fp.ceiling_height),
    image_url: fp.image_url ?? "",
    active: fp.active,
    sort: String(fp.sort ?? 0),
  };
}

// Необязательное число: пустая строка → null. parseDecimal терпит
// русскую запятую и пробелы разрядов («12,5», «3 500 000»).
function numOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = parseDecimal(t);
  return Number.isNaN(n) ? null : n;
}

// Все ошибки формы разом: map «ключ поля → текст».
function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.title.trim() === "") errors.title = "Заполните это поле";
  const slug = form.slug.trim();
  if (slug === "") {
    errors.slug = "Заполните это поле";
  } else if (!SLUG_RE.test(slug)) {
    errors.slug = "Только латиница, цифры и дефис, напр. studiya-26";
  }
  const area = parseDecimal(form.area_m2);
  if (form.area_m2.trim() === "" || Number.isNaN(area)) {
    errors.area_m2 = "Укажите площадь числом, напр. 26 или 26,5";
  } else if (area <= 0) {
    errors.area_m2 = "Площадь должна быть больше нуля";
  }
  if (form.price.trim() !== "") {
    const price = parseDecimal(form.price);
    if (Number.isNaN(price)) errors.price = "Укажите цену числом";
    else if (price < 0) errors.price = "Цена не может быть отрицательной";
  }
  if (form.floor.trim() !== "") {
    const floor = parseDecimal(form.floor);
    if (Number.isNaN(floor) || !Number.isInteger(floor)) {
      errors.floor = "Этаж — целое число";
    }
  }
  if (form.ceiling_height.trim() !== "") {
    const h = parseDecimal(form.ceiling_height);
    if (Number.isNaN(h)) {
      errors.ceiling_height = "Укажите высоту числом, напр. 3,3";
    } else if (h < 2 || h > 10) {
      // Жёсткая граница правдоподобия: ловит сантиметры вместо метров (330).
      errors.ceiling_height =
        "Высота потолка указывается в метрах — от 2 до 10, напр. 3,3";
    }
  }
  return errors;
}

export default function FloorplanForm({ id }: { id?: string }) {
  const router = useRouter();
  const { msg, show } = useToast();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<PlanCategory[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slugUnlocked, setSlugUnlocked] = useState(false);
  const [snapshot, setSnapshot] = useState<string>(() =>
    JSON.stringify(EMPTY)
  );

  const dirty = useMemo(
    () => !loading && JSON.stringify(form) !== snapshot,
    [form, snapshot, loading]
  );
  useUnsavedGuard(dirty && !saving && !deleting);

  // Категории для селекта (ошибка не блокирует форму — остаётся «Без категории»).
  useEffect(() => {
    let cancelled = false;
    apiFetch<PlanCategory[]>("/api/v1/admin/plan-categories")
      .then((data) => {
        if (cancelled) return;
        data.sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title));
        setCategories(data);
      })
      .catch(() => {
        /* селект останется с одной опцией «Без категории» */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    apiFetch<Floorplan>(`/api/v1/admin/floorplans/${id}`)
      .then((fp) => {
        if (cancelled) return;
        const st = fromFloorplan(fp);
        setForm(st);
        setSnapshot(JSON.stringify(st));
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(err instanceof Error ? err.message : "Ошибка загрузки");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // Авто-слаг из названия — только при создании, до ручной правки.
  const autoSlug = useAutoSlug({
    enabled: !isEdit,
    source: form.title,
    onSlug: (slug) => set("slug", slug),
  });
  const slugLocked = isEdit && !slugUnlocked;

  function applyErrors(map: Record<string, string>) {
    setErrors(map);
    const order: (keyof FormState)[] = [
      "title",
      "slug",
      "area_m2",
      "price",
      "floor",
      "ceiling_height",
    ];
    const first = order.find((k) => map[k]);
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(first);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLInputElement | null)?.focus?.({ preventScroll: true });
    });
  }

  async function save(exitAfter: boolean) {
    const all = validate(form);
    if (Object.keys(all).length > 0) {
      applyErrors(all);
      show("Исправьте выделенные поля", "error");
      return;
    }

    const payload: FloorplanInput = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      category_id: form.category_id || null,
      description: form.description.trim() || null,
      area_m2: parseDecimal(form.area_m2),
      price: numOrNull(form.price),
      availability_status: form.availability_status,
      floor: numOrNull(form.floor),
      ceiling_height: numOrNull(form.ceiling_height),
      image_url: form.image_url.trim() || null,
      active: form.active,
      sort: numOrNull(form.sort) ?? 0,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await apiFetch<Floorplan>(`/api/v1/admin/floorplans/${id}`, {
          method: "PUT",
          body: payload,
        });
        setSnapshot(JSON.stringify(form));
        show("Изменения сохранены");
        if (exitAfter) setTimeout(() => router.push("/floorplans"), 500);
      } else {
        const created = await apiFetch<Floorplan>("/api/v1/admin/floorplans", {
          method: "POST",
          body: payload,
        });
        setSnapshot(JSON.stringify(form));
        show("Планировка создана");
        if (exitAfter) {
          setTimeout(() => router.push("/floorplans"), 500);
        } else if (created?.id) {
          // Остаёмся в записи: URL меняется на /floorplans/{id} сразу —
          // задержка молча теряла бы правки, внесённые за эти полсекунды
          // (ремаунт формы с сервера). Паттерн ResourceForm.
          router.replace(`/floorplans/${created.id}`);
        }
      }
    } catch (err) {
      // 409 — адрес занят: ищем владельца для внятного сообщения.
      if (err instanceof ApiError && err.status === 409) {
        const slug = form.slug.trim();
        let ownerTitle: string | null = null;
        try {
          // Форма с данными смонтирована: 401 здесь не должен уводить на /login
          const list = await apiFetch<Floorplan[]>("/api/v1/admin/floorplans", {
            on401: "silent",
          });
          const owner = list.find((x) => x.slug === slug && x.id !== id);
          if (owner) ownerTitle = owner.title;
        } catch {
          /* нет списка — сообщение без владельца */
        }
        const text = ownerTitle
          ? `Адрес «${slug}» уже занят планировкой «${ownerTitle}»`
          : `Адрес «${slug}» уже занят другой планировкой`;
        applyErrors({ slug: text });
        show(text, "error");
      } else {
        show(translateApiError(err, "Ошибка сохранения"), "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id) return;
    if (!window.confirm(`Удалить планировку «${form.title}»?`)) return;
    setDeleting(true);
    try {
      await apiFetch<void>(`/api/v1/admin/floorplans/${id}`, {
        method: "DELETE",
      });
      setSnapshot(JSON.stringify(form));
      show("Планировка удалена");
      setTimeout(() => router.push("/floorplans"), 500);
    } catch (err) {
      show(translateApiError(err, "Ошибка удаления"), "error");
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

  if (loadError) {
    return <div className="alert alert-error">{loadError}</div>;
  }

  return (
    <div>
      <div className="page-head">
        <h1>{isEdit ? "Редактирование планировки" : "Новая планировка"}</h1>
        <div className="spacer" />
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
            router.push("/floorplans");
          }}
        >
          К списку
        </button>
      </div>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
        style={{ maxWidth: 720 }}
      >
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="title">
              Название *
            </label>
            <input
              id="title"
              className={"input" + (errors.title ? " invalid" : "")}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
            {errors.title && (
              <span className="field-error">{errors.title}</span>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="slug">
              Адрес (slug) *
            </label>
            <div className="slug-row">
              <input
                id="slug"
                className={"input mono" + (errors.slug ? " invalid" : "")}
                value={form.slug}
                readOnly={slugLocked}
                onChange={(e) => {
                  autoSlug.markManual();
                  // Слаг всегда строчный — как в универсальной форме: вставка
                  // «Studiya-26» не должна падать с ошибкой формата.
                  set("slug", e.target.value.toLowerCase());
                }}
                placeholder="studiya-26"
              />
              {slugLocked ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setSlugUnlocked(true)}
                  title="Разблокировать изменение адреса"
                >
                  Изменить
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={autoSlug.regenerate}
                  title="Пересобрать адрес из названия"
                >
                  ↻ Из названия
                </button>
              )}
            </div>
            {errors.slug && <span className="field-error">{errors.slug}</span>}
            <span className="field-hint">
              {slugLocked
                ? "Адрес опубликованной страницы. При изменении старый адрес получит 301-редирект на новый"
                : "Часть адреса /planirovki/<slug> — заполняется сам из названия"}
            </span>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="category_id">
              Категория
            </label>
            <select
              id="category_id"
              className="select"
              value={form.category_id}
              onChange={(e) => set("category_id", e.target.value)}
            >
              <option value="">— Без категории —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Без категории планировка не попадёт в фильтры каталога.
              Категории задаются в разделе «Категории планировок»
            </span>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="availability">
              Статус наличия
            </label>
            <select
              id="availability"
              className="select"
              value={form.availability_status}
              onChange={(e) =>
                set("availability_status", e.target.value as Availability)
              }
            >
              {AVAILABILITY_ORDER.map((a) => (
                <option key={a} value={a}>
                  {AVAILABILITY_LABELS[a]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <span className="field-label" id="description-label">
            Описание
          </span>
          {/* RichTextEditor нормализует пустой HTML к "" → в payload уйдёт null */}
          <RichTextEditor
            id="description"
            value={form.description}
            onChange={(html) => set("description", html)}
            initKey={id ?? "new"}
            ariaLabelledby="description-label"
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="area_m2">
              Площадь, м² *
            </label>
            {/* type="text" + inputMode="decimal»: number-инпут молча
                отбрасывал вставку «3 500 000» и запятую «12,5» */}
            <input
              id="area_m2"
              className={"input" + (errors.area_m2 ? " invalid" : "")}
              type="text"
              inputMode="decimal"
              value={form.area_m2}
              onChange={(e) => set("area_m2", e.target.value)}
            />
            {errors.area_m2 && (
              <span className="field-error">{errors.area_m2}</span>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="price">
              Цена, ₽
            </label>
            <input
              id="price"
              className={"input" + (errors.price ? " invalid" : "")}
              type="text"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="можно оставить пустым"
            />
            {errors.price && (
              <span className="field-error">{errors.price}</span>
            )}
            <span className="field-hint">
              Пустое поле — на сайте будет «Узнать цену»
            </span>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="floor">
              Этаж
            </label>
            <input
              id="floor"
              className={"input" + (errors.floor ? " invalid" : "")}
              type="number"
              step="1"
              value={form.floor}
              onChange={(e) => set("floor", e.target.value)}
            />
            {errors.floor && (
              <span className="field-error">{errors.floor}</span>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ceiling_height">
              Высота потолка, м
            </label>
            <input
              id="ceiling_height"
              className={"input" + (errors.ceiling_height ? " invalid" : "")}
              type="text"
              inputMode="decimal"
              value={form.ceiling_height}
              onChange={(e) => set("ceiling_height", e.target.value)}
              placeholder="напр. 3,3"
            />
            {errors.ceiling_height && (
              <span className="field-error">{errors.ceiling_height}</span>
            )}
            <span className="field-hint">В метрах: от 2 до 10</span>
          </div>
        </div>

        <div className="field">
          <span className="field-label" id="image_url-label">
            Изображение планировки
          </span>
          <MediaUpload
            id="image_url"
            value={form.image_url}
            onChange={(url) => set("image_url", url)}
            accept="image"
            onError={(m) => show(m, "error")}
            ariaLabelledby="image_url-label"
          />
          <span className="field-hint">
            JPG/PNG/WebP/GIF до 10 МБ; рекомендуем от 1200 px по ширине
          </span>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="sort">
            Порядок
          </label>
          <input
            id="sort"
            className="input"
            type="number"
            step="1"
            value={form.sort}
            onChange={(e) => set("sort", e.target.value)}
            style={{ maxWidth: 200 }}
          />
          <span className="field-hint">
            Порядок вывода: меньше — выше. Удобнее перетаскивать строки в
            списке
          </span>
        </div>

        <div className="field">
          <Checkbox
            id="active"
            checked={form.active}
            onChange={(next) => set("active", next)}
            label="Активна (показывать на сайте)"
            hint="Выключено — планировка скрыта на сайте, данные сохраняются"
          />
        </div>

        <FormActions
          saving={saving}
          deleting={deleting}
          createMode={!isEdit}
          onSave={() => void save(false)}
          onSaveExit={() => void save(true)}
          onDelete={isEdit ? onDelete : undefined}
        />
      </form>

      <Toast msg={msg} />
    </div>
  );
}
