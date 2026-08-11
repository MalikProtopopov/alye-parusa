"use client";

// Простой WYSIWYG без библиотек: contentEditable + document.execCommand.
// execCommand помечен deprecated, но стабильно работает во всех браузерах
// и достаточен для демо. Значение — HTML-строка (innerHTML).
//
// ВАЖНО:
//  1) contentEditable инициализируем значением РОВНО ОДИН РАЗ на запись
//     (перезапись innerHTML на каждый ре-рендер сбрасывает курсор);
//  2) вставка (paste) перехватывается и очищается: только разрешённые теги,
//     никаких style/class/цветов/фонов из Word/Google Docs/сайтов;
//  3) активные инструменты подсвечиваются по selectionchange.

import { useCallback, useEffect, useRef, useState } from "react";

// ── Очистка вставляемого HTML ───────────────────────────────────────

// Разрешённые теги. У <a> оставляем только href, у остальных — ничего.
const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s",
  "h2", "h3", "ul", "ol", "li", "a", "blockquote",
]);
// Контейнеры, разворачиваемые в <p> (их содержимое становится абзацем).
const BLOCK_UNWRAP = new Set([
  "div", "section", "article", "header", "footer", "main", "aside",
  "h1", "h4", "h5", "h6", "pre", "table", "tr", "figure", "figcaption",
]);
// Узлы, выбрасываемые целиком вместе с содержимым.
const DROP_TAGS = new Set([
  "script", "style", "head", "meta", "link", "title", "iframe",
  "object", "embed", "svg", "img", "video", "audio", "form", "input",
  "button", "select", "textarea",
]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeHref(href: string): string | null {
  const v = href.trim();
  if (/^(https?:|mailto:|tel:|\/)/i.test(v)) return v;
  return null;
}

// Рекурсивная сборка чистого HTML: только разрешённые теги, без атрибутов
// (кроме href у ссылок). span → текст, div/section и пр. → <p>…</p>.
function sanitizeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.nodeValue ?? "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (DROP_TAGS.has(tag)) return "";

  const inner = Array.from(el.childNodes).map(sanitizeNode).join("");

  if (ALLOWED_TAGS.has(tag)) {
    if (tag === "br") return "<br>";
    if (tag === "a") {
      const href = safeHref(el.getAttribute("href") ?? "");
      return href
        ? `<a href="${escapeHtml(href)}">${inner}</a>`
        : inner;
    }
    // Все атрибуты (style, class, color, bgcolor…) отбрасываются здесь:
    // тег пересобирается заново без единого атрибута.
    return `<${tag}>${inner}</${tag}>`;
  }

  if (BLOCK_UNWRAP.has(tag)) {
    return inner.trim() === "" ? "" : `<p>${inner}</p>`;
  }

  // span, font, td и прочее неизвестное — разворачиваем в содержимое.
  return inner;
}

/** Очистка HTML из буфера обмена до разрешённого подмножества. */
export function sanitizePastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.body.childNodes).map(sanitizeNode).join("");
}

// HTML без видимого содержимого («<p><br></p>», «<br>» и т.п.) → пусто.
function isVisuallyEmpty(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim() === ""
  );
}

// ── Тулбар ──────────────────────────────────────────────────────────

type InlineCmd =
  | "bold"
  | "italic"
  | "underline"
  | "insertUnorderedList"
  | "insertOrderedList";
type BlockTag = "h2" | "h3" | "blockquote";

interface ActiveState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  insertUnorderedList: boolean;
  insertOrderedList: boolean;
  block: BlockTag | "p" | null;
}

const INITIAL_ACTIVE: ActiveState = {
  bold: false,
  italic: false,
  underline: false,
  insertUnorderedList: false,
  insertOrderedList: false,
  block: null,
};

const INLINE_BUTTONS: {
  label: string;
  title: string;
  command: InlineCmd;
  style?: React.CSSProperties;
}[] = [
  { label: "Ж", title: "Полужирный", command: "bold", style: { fontWeight: 700 } },
  { label: "К", title: "Курсив", command: "italic", style: { fontStyle: "italic" } },
  {
    label: "Ч",
    title: "Подчёркнутый",
    command: "underline",
    style: { textDecoration: "underline" },
  },
];

const BLOCK_BUTTONS: { label: string; title: string; tag: BlockTag }[] = [
  { label: "H2", title: "Заголовок 2-го уровня", tag: "h2" },
  { label: "H3", title: "Заголовок 3-го уровня", tag: "h3" },
  { label: "❝", title: "Цитата", tag: "blockquote" },
];

const LIST_BUTTONS: { label: string; title: string; command: InlineCmd }[] = [
  { label: "•", title: "Маркированный список", command: "insertUnorderedList" },
  { label: "1.", title: "Нумерованный список", command: "insertOrderedList" },
];

export interface RichTextEditorProps {
  id?: string;
  /** Начальное значение (HTML). Применяется один раз на initKey. */
  value: string;
  onChange: (html: string) => void;
  /** Ключ записи: смена ключа — переинициализация содержимого. */
  initKey?: string;
  /** id элемента-подписи поля (доступность: связь с label формы). */
  ariaLabelledby?: string;
}

export default function RichTextEditor({
  id,
  value,
  onChange,
  initKey,
  ariaLabelledby,
}: RichTextEditorProps) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const initedFor = useRef<string | null>(null);
  const [active, setActive] = useState<ActiveState>(INITIAL_ACTIVE);

  const key = initKey ?? "single";

  // Инициализация содержимого один раз на запись (или при смене записи).
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    if (initedFor.current === key) return;
    initedFor.current = key;
    el.innerHTML = value;
    // value намеренно не в зависимостях: после инициализации редактор —
    // источник правды, внешние ре-рендеры не должны трогать innerHTML.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const emit = useCallback(() => {
    const el = areaRef.current;
    if (!el) return;
    const html = el.innerHTML;
    // Пустой редактор не отдаёт «<br>»/«<p><br></p>» — нормализуем к "".
    onChange(isVisuallyEmpty(html) ? "" : html);
  }, [onChange]);

  // Блочный формат: от anchorNode вверх до contentEditable-корня.
  const computeBlock = useCallback((): ActiveState["block"] => {
    const area = areaRef.current;
    const sel = window.getSelection();
    if (!area || !sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.anchorNode;
    if (!node || !area.contains(node)) return null;
    while (node && node !== area) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as Element).tagName;
        if (tag === "H2") return "h2";
        if (tag === "H3") return "h3";
        if (tag === "BLOCKQUOTE") return "blockquote";
      }
      node = node.parentNode;
    }
    return "p";
  }, []);

  // Пересчёт подсветки тулбара по текущему выделению.
  const refreshActive = useCallback(() => {
    const area = areaRef.current;
    const sel = window.getSelection();
    // Реагируем только если селекция внутри редактора.
    if (!area || !sel || !sel.anchorNode || !area.contains(sel.anchorNode)) {
      return;
    }
    let next: ActiveState = { ...INITIAL_ACTIVE, block: computeBlock() };
    try {
      next = {
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
        block: next.block,
      };
    } catch {
      /* queryCommandState может бросить в редких случаях — игнорируем */
    }
    setActive(next);
  }, [computeBlock]);

  // selectionchange: вешаем на document при монтировании, снимаем при размонтировании.
  useEffect(() => {
    document.addEventListener("selectionchange", refreshActive);
    return () => document.removeEventListener("selectionchange", refreshActive);
  }, [refreshActive]);

  function exec(command: string, arg?: string) {
    areaRef.current?.focus();
    document.execCommand(command, false, arg);
    emit();
    refreshActive();
  }

  // H2/H3/цитата — toggle: повторный клик возвращает параграф.
  function toggleBlock(tag: BlockTag) {
    const current = computeBlock();
    exec("formatBlock", current === tag ? "p" : tag);
  }

  function addLink() {
    const url = window.prompt("Адрес ссылки (https://…):", "https://");
    if (!url || url === "https://") return;
    exec("createLink", url);
  }

  // Убрать формат: inline-стили выделения + ссылки + блок в параграф.
  function clearFormat() {
    areaRef.current?.focus();
    document.execCommand("removeFormat", false);
    document.execCommand("unlink", false);
    document.execCommand("formatBlock", false, "p");
    emit();
    refreshActive();
  }

  // Вставка: перехватываем и чистим. Никакие цвета/фоны/шрифты из
  // Word/Google Docs/сайтов не должны попасть в редактор.
  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    if (html) {
      document.execCommand("insertHTML", false, sanitizePastedHtml(html));
    } else {
      const text = e.clipboardData.getData("text/plain");
      if (text) document.execCommand("insertText", false, text);
    }
    emit();
  }

  return (
    <div className="rte">
      <div className="rte-toolbar" role="toolbar" aria-label="Форматирование">
        {INLINE_BUTTONS.map((b) => (
          <button
            key={b.command}
            type="button"
            className="rte-btn"
            title={b.title}
            aria-label={b.title}
            aria-pressed={active[b.command]}
            data-active={active[b.command] || undefined}
            style={b.style}
            // mousedown + preventDefault — не отдаём фокус, сохраняем выделение
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(b.command)}
          >
            {b.label}
          </button>
        ))}
        <span className="rte-sep" />
        {BLOCK_BUTTONS.map((b) => (
          <button
            key={b.tag}
            type="button"
            className="rte-btn"
            title={b.title}
            aria-label={b.title}
            aria-pressed={active.block === b.tag}
            data-active={active.block === b.tag || undefined}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => toggleBlock(b.tag)}
          >
            {b.label}
          </button>
        ))}
        <span className="rte-sep" />
        {LIST_BUTTONS.map((b) => (
          <button
            key={b.command}
            type="button"
            className="rte-btn"
            title={b.title}
            aria-label={b.title}
            aria-pressed={active[b.command]}
            data-active={active[b.command] || undefined}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(b.command)}
          >
            {b.label}
          </button>
        ))}
        <span className="rte-sep" />
        <button
          type="button"
          className="rte-btn"
          title="Ссылка"
          aria-label="Ссылка"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addLink}
        >
          🔗
        </button>
        <button
          type="button"
          className="rte-btn"
          title="Убрать форматирование"
          aria-label="Убрать форматирование"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clearFormat}
        >
          ⌫
        </button>
      </div>
      <div
        ref={areaRef}
        id={id}
        className="rte-area"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabelledby ? undefined : "Текст"}
        aria-labelledby={ariaLabelledby}
        onInput={emit}
        onBlur={emit}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onPaste={onPaste}
      />
      <div className="field-hint">
        HTML очищается на сервере: разрешены заголовки, списки, ссылки,
        выделение
      </div>
    </div>
  );
}
