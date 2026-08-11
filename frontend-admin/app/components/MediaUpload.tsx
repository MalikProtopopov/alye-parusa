"use client";

// Поле «медиа» + модальная медиатека.
//
// Поле: превью текущего значения + кнопки «Выбрать из галереи» и
// «Загрузить файл» (+ свёрнутый ручной ввод URL). Обе кнопки открывают одну
// модалку MediaLibraryModal в соответствующем режиме.
//
// Бэкенд:
//   GET    /api/v1/admin/media          → {items: [{name,url,path,original_url,thumb_url,content_type,size,uploaded_at}]}
//   POST   /api/v1/admin/media          → 201 {url,path,original_url,thumb_url,kind,content_type,size,original_size,width,height}
//          (multipart, поле `file`; Content-Type НЕ ставим — браузер сам с boundary)
//   DELETE /api/v1/admin/media/{name}   → 204
// `url` — оптимизированная веб-версия (её и пишем в поле), `original_url` —
// исходный файл байт в байт, `thumb_url` — превью ≤480px (у видео — постер).
// Ошибки: 413 (размер), 415 (тип), 422 (пустой).

import { useCallback, useEffect, useRef, useState } from "react";
import { API, getToken, SESSION_EXPIRED_MESSAGE } from "../lib/api";
import { formatDate, normalizeSearch, pluralRu } from "../lib/labels";
import { mediaUrl } from "../lib/media";
import { CloseIcon, Icon, TrashIcon, UploadIcon } from "./icons";

export type MediaAccept = "image" | "image-video" | "file";

interface MediaItem {
  /** Хранимое имя файла на сервере ({uuid}.webp) — идентичность и DELETE. */
  name: string;
  /** Исходное имя файла у пользователя — только для показа и поиска. */
  label?: string;
  url: string;
  path: string;
  original_url?: string | null;
  thumb_url?: string | null;
  content_type: string;
  size: number;
  uploaded_at: string;
}

interface MediaListResponse {
  items: MediaItem[];
}

interface MediaUploadResponse {
  url: string;
  path: string;
  original_url: string | null;
  thumb_url: string | null;
  kind: "image" | "video" | "pdf" | "gif";
  filename?: string;
  content_type: string;
  size: number;
  original_size?: number;
  width: number | null;
  height: number | null;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const FILE_TYPES = [...IMAGE_TYPES, "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 МБ для изображений/PDF (лимит бэкенда — 413)
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 МБ — свой лимит для видео
const MIN_WIDTH = 800; // предупреждение о маленьких изображениях

function acceptAttr(accept: MediaAccept): string {
  if (accept === "image") return IMAGE_TYPES.join(",");
  if (accept === "image-video") return [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");
  return FILE_TYPES.join(",");
}

function typeErrorText(accept: MediaAccept): string {
  if (accept === "image") return "Неподходящий формат: нужен JPG, PNG, WebP или GIF";
  if (accept === "image-video")
    return "Неподходящий формат: нужно изображение (JPG, PNG, WebP, GIF) или видео (MP4, WebM)";
  return "Неподходящий формат: нужен JPG, PNG, WebP, GIF или PDF";
}

function sizeErrorText(accept: MediaAccept): string {
  return accept === "image-video"
    ? "Файл больше лимита: изображение — до 10 МБ, видео — до 200 МБ"
    : "Файл больше 10 МБ";
}

function isImageType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

function isVideoType(contentType: string): boolean {
  return contentType.startsWith("video/");
}

// URL похож на изображение (для превью сохранённого значения).
function looksLikeImage(url: string): boolean {
  return /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(url);
}

// URL похож на видео (для превью сохранённого значения).
function looksLikeVideo(url: string): boolean {
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
}

function looksLikePdf(url: string): boolean {
  return /\.pdf(\?.*)?$/i.test(url);
}

// Имя файла из URL/пути — подпись под превью.
function fileNameFromUrl(url: string): string {
  try {
    const path = new URL(url, "http://x").pathname;
    return decodeURIComponent(path.split("/").pop() || url);
  } catch {
    return url;
  }
}

/** Плашка «файл не найден» вместо «сломанной картинки» браузера. */
function MissingMedia({
  variant,
  title,
}: {
  variant: "thumb" | "tile" | "side";
  title?: string;
}) {
  return (
    <span
      className={`media-missing media-missing-${variant}`}
      role="img"
      aria-label="Файл не найден"
      title={title ?? "Файл не найден — выберите или загрузите файл заново"}
    >
      <Icon name="banner" width={20} height={20} />
      <span>Файл не найден</span>
    </span>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " КБ";
  return bytes + " Б";
}

// ── Общие запросы к API медиа ───────────────────────────────────────

class MediaApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Медиатека всегда открыта поверх смонтированной формы с данными: 401 здесь
// НИКОГДА не редиректит и не чистит токен — иначе набранное в форме пропадёт.
async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  if (!token) {
    throw new MediaApiError(401, SESSION_EXPIRED_MESSAGE);
  }
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new MediaApiError(0, "Не удалось соединиться с сервером");
  }
  if (res.status === 401) {
    throw new MediaApiError(401, SESSION_EXPIRED_MESSAGE);
  }
  return res;
}

/** Отдельная «ошибка»: пользователь сам прервал загрузку (abort). */
export const UPLOAD_ABORTED = "Загрузка прервана";

// Клиентская предпроверка + загрузка файла через XHR (ради onprogress).
// onProgress получает процент 0–100. Возвращает MediaItem.
// xhrRef — наружу отдаётся текущий XHR, чтобы модалка могла прервать
// загрузку при закрытии.
function uploadFile(
  file: File,
  accept: MediaAccept,
  onProgress?: (pct: number) => void,
  xhrRef?: { current: XMLHttpRequest | null }
): Promise<MediaItem> {
  const allowed =
    accept === "image"
      ? IMAGE_TYPES
      : accept === "image-video"
        ? [...IMAGE_TYPES, ...VIDEO_TYPES]
        : FILE_TYPES;
  if (!allowed.includes(file.type)) {
    return Promise.reject(new MediaApiError(415, typeErrorText(accept)));
  }
  const isVideo = accept === "image-video" && VIDEO_TYPES.includes(file.type);
  const limit = isVideo ? MAX_VIDEO_SIZE : MAX_SIZE;
  if (file.size > limit) {
    return Promise.reject(
      new MediaApiError(
        413,
        isVideo
          ? "Видео больше 200 МБ — сожмите его перед загрузкой"
          : "Файл больше 10 МБ — уменьшите его перед загрузкой"
      )
    );
  }
  if (file.size === 0) {
    return Promise.reject(new MediaApiError(422, "Файл пустой"));
  }

  const token = getToken();
  if (!token) {
    return Promise.reject(new MediaApiError(401, SESSION_EXPIRED_MESSAGE));
  }

  return new Promise<MediaItem>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (xhrRef) xhrRef.current = xhr;
    xhr.open("POST", `${API}/api/v1/admin/media`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onerror = () =>
      reject(new MediaApiError(0, "Не удалось соединиться с сервером"));
    xhr.onabort = () => reject(new MediaApiError(0, UPLOAD_ABORTED));
    xhr.onload = () => {
      if (xhr.status === 401) {
        // Без редиректа: форма под модалкой хранит несохранённые данные.
        reject(new MediaApiError(401, SESSION_EXPIRED_MESSAGE));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const messages: Record<number, string> = {
          413: sizeErrorText(accept),
          415: typeErrorText(accept),
          422: "Файл пустой или повреждён",
        };
        reject(
          new MediaApiError(
            xhr.status,
            messages[xhr.status] ?? `Ошибка загрузки (${xhr.status})`
          )
        );
        return;
      }
      try {
        const data: MediaUploadResponse = JSON.parse(xhr.responseText);
        // Идентичность плитки — ХРАНИМОЕ имя ({uuid}.webp): по нему работает
        // DELETE и им же вернёт файл GET-список. Оригинальное имя — в label.
        const storedName = fileNameFromUrl(data.path || data.url);
        resolve({
          name: storedName,
          label: data.filename || storedName,
          url: data.url,
          path: data.path,
          original_url: data.original_url ?? null,
          thumb_url: data.thumb_url ?? null,
          content_type: data.content_type,
          size: data.size,
          uploaded_at: new Date().toISOString(),
        });
      } catch {
        reject(new MediaApiError(0, "Некорректный ответ сервера"));
      }
    };
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

// ── Зона перетаскивания (используется в модалке) ────────────────────

function DropZone({
  accept,
  uploading,
  progressLabel,
  onFiles,
}: {
  accept: MediaAccept;
  uploading: boolean;
  /** «Загрузка… 42 %» или «2 из 5 · 87 %» при мульти-аплоаде. */
  progressLabel: string | null;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <>
      <div
        className={
          "media-drop" + (dragOver ? " drag" : "") + (uploading ? " busy" : "")
        }
        role="button"
        tabIndex={0}
        aria-label="Загрузить файлы"
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !uploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (uploading) return;
          const files = Array.from(e.dataTransfer.files ?? []);
          if (files.length) onFiles(files);
        }}
      >
        {uploading ? (
          <span className="row-gap" style={{ justifyContent: "center" }}>
            <span className="spin" /> {progressLabel ?? "Загрузка…"}
          </span>
        ) : (
          <>
            <UploadIcon className="media-drop-ico" />
            <span>
              Перетащите файлы или <u>нажмите</u>
            </span>
            <span className="media-drop-note">
              {accept === "image"
                ? "JPG, PNG, WebP, GIF · до 10 МБ"
                : accept === "image-video"
                  ? "JPG, PNG, WebP, GIF, MP4, WebM — изображение до 10 МБ или видео до 200 МБ"
                  : "JPG, PNG, WebP, GIF, PDF · до 10 МБ"}
              {" · можно несколько сразу"}
            </span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptAttr(accept)}
        style={{ display: "none" }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </>
  );
}

// ── Модалка медиатеки ───────────────────────────────────────────────

type LibraryMode = "gallery" | "upload";
type TypeFilter = "all" | "image" | "video" | "pdf";

function MediaLibraryModal({
  accept,
  initialMode,
  onSelect,
  onClose,
  onError,
}: {
  accept: MediaAccept;
  initialMode: LibraryMode;
  onSelect: (url: string) => void;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<LibraryMode>(initialMode);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  // Файлы, чьё превью не загрузилось (удалены с диска, битый путь):
  // показываем плашку «Файл не найден» вместо иконки браузера.
  const [brokenNames, setBrokenNames] = useState<Set<string>>(new Set());
  const markBroken = useCallback((name: string) => {
    setBrokenNames((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  }, []);
  // Для закрытия во время загрузки: актуальный флаг + текущий XHR.
  const uploadingRef = useRef(false);
  const currentXhr = useRef<XMLHttpRequest | null>(null);

  // Закрытие модалки: во время загрузки — подтверждение и abort XHR,
  // иначе результат загрузки молча потеряется.
  const requestClose = useCallback(() => {
    if (uploadingRef.current) {
      if (!window.confirm("Загрузка ещё идёт — прервать её и закрыть?")) {
        return;
      }
      currentXhr.current?.abort();
    }
    onClose();
  }, [onClose]);

  // Выбор файла в галерее тоже закрывает модалку — значит, та же защита:
  // во время загрузки спрашиваем подтверждение и прерываем XHR, иначе
  // недокачанный файл молча пропадал бы.
  const requestSelect = useCallback(
    (url: string) => {
      if (uploadingRef.current) {
        if (
          !window.confirm("Загрузка ещё идёт — прервать её и вставить выбранный файл?")
        ) {
          return;
        }
        currentXhr.current?.abort();
      }
      onSelect(url);
    },
    [onSelect]
  );

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await authFetch("/api/v1/admin/media");
      if (!res.ok) throw new MediaApiError(res.status, `Ошибка загрузки списка (${res.status})`);
      const data: MediaListResponse = await res.json();
      setItems(data.items);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Не удалось загрузить медиатеку"
      );
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Esc закрывает модалку (с guard'ом на активную загрузку);
  // фокус — внутрь при открытии.
  useEffect(() => {
    dialogRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  // accept="image" — только картинки; accept="image-video" — картинки и видео;
  // accept="file" — всё.
  const base = (items ?? []).filter((it) => {
    if (accept === "image") return isImageType(it.content_type);
    if (accept === "image-video")
      return isImageType(it.content_type) || isVideoType(it.content_type);
    return true;
  });
  const searchQuery = normalizeSearch(search.trim());
  const visible = base.filter((it) => {
    if (filter === "image" && !isImageType(it.content_type)) return false;
    if (filter === "video" && !isVideoType(it.content_type)) return false;
    if (filter === "pdf" && it.content_type !== "application/pdf") return false;
    if (
      searchQuery &&
      !normalizeSearch(`${it.name} ${it.label ?? ""}`).includes(searchQuery)
    ) {
      return false;
    }
    return true;
  });
  const selected = visible.find((it) => it.name === selectedName) ?? null;

  // Последовательная загрузка нескольких файлов с прогрессом «i из n · pct %».
  async function handleUpload(files: File[]) {
    setUploading(true);
    uploadingRef.current = true;
    let lastUploaded: MediaItem | null = null;
    const failed: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const prefix = files.length > 1 ? `${i + 1} из ${files.length} · ` : "";
        const isVideoFile = file.type.startsWith("video/");
        setProgressLabel(`Загрузка… ${prefix}0 %`);
        try {
          const item = await uploadFile(
            file,
            accept,
            (pct) =>
              setProgressLabel(
                // Видео: после 100 % сервер ещё транскодирует — не «зависло».
                isVideoFile && pct >= 100
                  ? `${prefix}Обработка видео на сервере… это может занять несколько минут`
                  : `Загрузка… ${prefix}${pct} %`
              ),
            currentXhr
          );
          lastUploaded = item;
          // Новый файл — в начало грида.
          setItems((prev) => [
            item,
            ...(prev ?? []).filter((x) => x.name !== item.name),
          ]);
        } catch (err) {
          // Пользователь сам прервал загрузку при закрытии — остальные
          // файлы не отправляем и ошибкой это не считаем.
          if (err instanceof MediaApiError && err.message === UPLOAD_ABORTED) {
            return;
          }
          failed.push(
            `${file.name}: ${err instanceof Error ? err.message : "ошибка"}`
          );
        }
      }
    } finally {
      setUploading(false);
      uploadingRef.current = false;
      currentXhr.current = null;
      setProgressLabel(null);
    }
    if (failed.length) {
      onError(
        failed.length === files.length
          ? failed[0]
          : `Часть файлов не загрузилась — ${failed.join("; ")}`
      );
    }
    if (lastUploaded) {
      setSelectedName(lastUploaded.name);
      setFilter("all");
      setSearch("");
      setMode("gallery");
    }
  }

  async function handleDelete(item: MediaItem) {
    if (!window.confirm(`Удалить файл «${item.label ?? item.name}» с сервера?`))
      return;
    try {
      const res = await authFetch(
        `/api/v1/admin/media/${encodeURIComponent(item.name)}`,
        { method: "DELETE" }
      );
      if (!res.ok && res.status !== 204) {
        // 409 media_in_use несёт список записей-владельцев — показать его,
        // а не голый код ошибки
        const detail = (await res.json().catch(() => null))?.detail;
        if (res.status === 409 && detail && typeof detail === "object" && detail.code === "media_in_use") {
          const owners = (detail.used_by as Array<{ type: string; title: string }> | undefined) ?? [];
          const kinds: Record<string, string> = {
            floorplan: "Планировка", news: "Новость", advantage: "Преимущество",
            partner: "Партнёр", team: "Команда", document: "Документ",
            seo: "SEO", banner: "Hero / Баннер",
          };
          const list = owners.slice(0, 5)
            .map((u) => `${kinds[u.type] ?? u.type} «${u.title}»`).join(", ");
          throw new MediaApiError(
            res.status,
            `Файл используется в ${owners.length} ${pluralRu(owners.length, "записи", "записях", "записях")}: ${list}${owners.length > 5 ? "…" : ""}. Сначала замените его там.`
          );
        }
        throw new MediaApiError(res.status, `Ошибка удаления (${res.status})`);
      }
      setItems((prev) => (prev ?? []).filter((x) => x.name !== item.name));
      if (selectedName === item.name) setSelectedName(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Ошибка удаления");
    }
  }

  return (
    <div
      className="overlay media-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className="media-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Медиатека"
        tabIndex={-1}
      >
        <div className="media-modal-head">
          <div className="media-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "gallery"}
              className={"media-tab" + (mode === "gallery" ? " active" : "")}
              onClick={() => setMode("gallery")}
            >
              Галерея
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "upload"}
              className={"media-tab" + (mode === "upload" ? " active" : "")}
              onClick={() => setMode("upload")}
            >
              Загрузка
            </button>
          </div>
          {mode === "gallery" && (
            <input
              type="search"
              className="input media-search"
              placeholder="Поиск по имени…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              // Модалка живёт внутри <form> редактора: Enter в поиске
              // отправил бы форму и сохранил запись «мимо воли» пользователя
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              aria-label="Поиск файла по имени"
            />
          )}
          {mode === "gallery" && accept !== "image" && (
            <div className="media-filter" role="group" aria-label="Фильтр по типу">
              {(
                accept === "image-video"
                  ? ([
                      ["all", "Все"],
                      ["image", "Картинки"],
                      ["video", "Видео"],
                    ] as [TypeFilter, string][])
                  : ([
                      ["all", "Все"],
                      ["image", "Картинки"],
                      ["pdf", "PDF"],
                    ] as [TypeFilter, string][])
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  className={"media-tab sm" + (filter === val ? " active" : "")}
                  onClick={() => setFilter(val)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="spacer" />
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            aria-label="Закрыть"
            onClick={requestClose}
          >
            <CloseIcon />
          </button>
        </div>

        {mode === "upload" ? (
          <div className="media-modal-body single">
            <DropZone
              accept={accept}
              uploading={uploading}
              progressLabel={progressLabel}
              onFiles={(files) => void handleUpload(files)}
            />
          </div>
        ) : (
          <div className="media-modal-body">
            <div className="media-grid-wrap">
              {loadError && <div className="alert alert-error">{loadError}</div>}
              {items === null ? (
                <div className="row-gap" style={{ color: "var(--ink-45)" }}>
                  <span className="spin" /> Загрузка…
                </div>
              ) : visible.length === 0 ? (
                <div className="alert alert-info">
                  {searchQuery
                    ? "Ничего не найдено — измените запрос"
                    : "Файлов пока нет — загрузите первый на вкладке «Загрузка»"}
                </div>
              ) : (
                <div className="media-grid">
                  {visible.map((it) => {
                    const img = isImageType(it.content_type);
                    const vid = isVideoType(it.content_type);
                    const sel = selectedName === it.name;
                    const shown = it.label ?? it.name;
                    // API отдаёт относительные пути /media/… — дописываем домен
                    const thumbSrc = mediaUrl(it.thumb_url ?? it.url);
                    const broken = brokenNames.has(it.name) || thumbSrc === null;
                    return (
                      <div
                        key={it.name}
                        className={"media-tile" + (sel ? " selected" : "")}
                      >
                        <button
                          type="button"
                          className="media-tile-btn"
                          onClick={() => setSelectedName(it.name)}
                          onDoubleClick={() => requestSelect(it.url)}
                          aria-pressed={sel}
                          title={shown}
                        >
                          {img ? (
                            broken ? (
                              <MissingMedia variant="tile" />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumbSrc!}
                                alt={shown}
                                loading="lazy"
                                onError={() => markBroken(it.name)}
                              />
                            )
                          ) : vid ? (
                            it.thumb_url && !broken ? (
                              <span className="media-tile-video">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={mediaUrl(it.thumb_url)!}
                                  alt={shown}
                                  loading="lazy"
                                  onError={() => markBroken(it.name)}
                                />
                                <span className="media-tile-badge">видео</span>
                              </span>
                            ) : (
                              <span className="media-tile-pdf">
                                <span className="media-filechip mono">
                                  Видео
                                </span>
                                <span className="media-tile-name">
                                  {shown}
                                </span>
                                <span className="media-tile-size">
                                  {formatSize(it.size)}
                                </span>
                              </span>
                            )
                          ) : (
                            <span className="media-tile-pdf">
                              <span className="media-filechip mono">PDF</span>
                              <span className="media-tile-name">{shown}</span>
                              <span className="media-tile-size">
                                {formatSize(it.size)}
                              </span>
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          className="media-tile-del"
                          aria-label={`Удалить ${shown}`}
                          title="Удалить файл"
                          onClick={() => void handleDelete(it)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="media-side">
              {selected ? (
                <>
                  <div className="media-side-preview">
                    {brokenNames.has(selected.name) ||
                    mediaUrl(selected.url) === null ? (
                      <MissingMedia variant="side" />
                    ) : isVideoType(selected.content_type) ? (
                      <video
                        src={mediaUrl(selected.url)!}
                        controls
                        muted
                        style={{ maxWidth: "100%" }}
                        onError={() => markBroken(selected.name)}
                      />
                    ) : isImageType(selected.content_type) ? (
                      // Полноразмерная веб-версия (url), не превью.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaUrl(selected.url)!}
                        alt={selected.label ?? selected.name}
                        onError={() => markBroken(selected.name)}
                      />
                    ) : (
                      <span className="media-filechip mono">PDF</span>
                    )}
                  </div>
                  <div className="media-side-meta">
                    <div
                      className="media-side-name"
                      title={selected.label ?? selected.name}
                    >
                      {selected.label ?? selected.name}
                    </div>
                    <div className="muted">
                      {formatSize(selected.size)} ·{" "}
                      {formatDate(selected.uploaded_at)}
                    </div>
                    {selected.original_url && (
                      <>
                        <a
                          href={mediaUrl(selected.original_url) ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="media-side-orig"
                        >
                          Открыть оригинал
                        </a>
                        <span className="media-side-note">
                          хранится оригинал + веб-версия
                        </span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                    onClick={() => requestSelect(selected.url)}
                  >
                    Выбрать
                  </button>
                </>
              ) : (
                <div className="media-side-empty muted">
                  Выберите файл в галерее — здесь появится предпросмотр
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Поле формы ──────────────────────────────────────────────────────

export interface MediaUploadProps {
  id?: string;
  value: string;
  onChange: (url: string) => void;
  accept: MediaAccept;
  /** Отключить предупреждение о ширине < 800px (логотипы, иконки). */
  noWidthWarning?: boolean;
  onError: (msg: string) => void;
  /** id элемента-подписи поля (доступность: связь с label формы). */
  ariaLabelledby?: string;
}

/**
 * Поле «медиа»: превью значения + «Выбрать из галереи» / «Загрузить файл»
 * (обе кнопки открывают модалку медиатеки) + ручной ввод URL.
 * Значение — строка URL (совместимо с прежними text/url-полями).
 */
export default function MediaUpload({
  id,
  value,
  onChange,
  accept,
  noWidthWarning,
  onError,
  ariaLabelledby,
}: MediaUploadProps) {
  const [modal, setModal] = useState<LibraryMode | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [widthWarn, setWidthWarn] = useState<string | null>(null);
  // Превью не загрузилось (файл удалён с диска, опечатка в URL) —
  // показываем плашку вместо «сломанной картинки» браузера.
  const [broken, setBroken] = useState(false);

  // Смена значения — предупреждение пересчитается по onLoad превью.
  useEffect(() => {
    setWidthWarn(null);
    setBroken(false);
  }, [value]);

  // Вызывается только из onLoad картинки, поэтому к видео не применяется.
  function checkWidth(width: number) {
    if (noWidthWarning || accept === "file") return;
    if (width > 0 && width < MIN_WIDTH) {
      setWidthWarn(
        `Ширина изображения ${width}px — меньше рекомендуемых ${MIN_WIDTH}px, на сайте может выглядеть размыто`
      );
    } else {
      setWidthWarn(null);
    }
  }

  const isVideo = value !== "" && looksLikeVideo(value);
  const isImage =
    value !== "" &&
    !isVideo &&
    (accept === "file" ? looksLikeImage(value) : true);
  const isPdf = value !== "" && looksLikePdf(value);
  // В поле хранится относительный путь /media/… — для превью и ссылки
  // нужен абсолютный адрес API.
  const src = mediaUrl(value);

  return (
    <div className="media" id={id} role="group" aria-labelledby={ariaLabelledby}>
      {/* Превью текущего значения */}
      {value !== "" && (
        <div className="media-preview">
          {broken || src === null ? (
            <MissingMedia variant="thumb" />
          ) : isVideo ? (
            <video
              className="media-thumb"
              src={src}
              muted
              playsInline
              preload="metadata"
              onError={() => setBroken(true)}
            />
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="media-thumb"
              src={src}
              alt="Превью"
              onLoad={(e) => checkWidth(e.currentTarget.naturalWidth)}
              onError={() => {
                setWidthWarn(null);
                setBroken(true);
              }}
            />
          ) : (
            <span className="media-filechip mono">{isPdf ? "PDF" : "Файл"}</span>
          )}
          <div className="media-preview-info">
            <a
              href={src ?? value}
              target="_blank"
              rel="noreferrer"
              className="media-preview-name"
              title={value}
            >
              {fileNameFromUrl(value)}
            </a>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                onChange("");
                setWidthWarn(null);
              }}
            >
              Очистить
            </button>
          </div>
        </div>
      )}

      {widthWarn && <div className="media-warn">{widthWarn}</div>}

      <div className="row-gap">
        <button
          type="button"
          className="btn"
          onClick={() => setModal("gallery")}
        >
          Выбрать из галереи
        </button>
        <button type="button" className="btn" onClick={() => setModal("upload")}>
          Загрузить файл
        </button>
      </div>

      {/* Свернутый ручной ввод URL (fallback) */}
      <button
        type="button"
        className="media-url-toggle"
        onClick={() => setShowUrlInput((v) => !v)}
      >
        {showUrlInput ? "Скрыть поле URL" : "или вставить URL вручную"}
      </button>
      {showUrlInput && (
        <input
          className="input mono"
          type="text"
          value={value}
          placeholder="https://…"
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {modal !== null && (
        <MediaLibraryModal
          accept={accept}
          initialMode={modal}
          onSelect={(url) => {
            onChange(url);
            setModal(null);
          }}
          onClose={() => setModal(null)}
          onError={onError}
        />
      )}
    </div>
  );
}
