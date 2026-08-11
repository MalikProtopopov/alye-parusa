"use client";

// Живой предпросмотр SEO-записи из state формы (паттерн InstallmentPreview):
// сниппет поисковой выдачи (крошка URL, title ~60, description ~160)
// + макет OG-карточки для шаринга + бейдж noindex.

import { useEffect, useState } from "react";
import { countGraphemes } from "../../lib/labels";
import { mediaUrl } from "../../lib/media";
import { SITE } from "../../lib/site";

const TITLE_LIMIT = 60;
const DESC_LIMIT = 160;

// Длина — по графемам (та же функция, что у счётчика поля: с эмодзи цифры
// в счётчике и предупреждения предпросмотра расходились). Рез — по
// кодпоинтам, чтобы не разорвать суррогатную пару посреди эмодзи.
function truncate(s: string, limit: number): string {
  if (countGraphemes(s) <= limit) return s;
  return Array.from(s).slice(0, limit - 1).join("").trimEnd() + "…";
}

// «домен › раздел › страница» из slug-пути.
function crumb(slugPath: string): string {
  let host = "site";
  try {
    host = new URL(SITE).host;
  } catch {
    /* оставим заглушку */
  }
  const clean = slugPath.trim();
  const segments = clean
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  return [host, ...segments].join(" › ");
}

export default function SerpPreview({
  form,
}: {
  form: Record<string, string | boolean>;
}) {
  const slug = String(form.slug ?? "").trim();
  const title = String(form.title ?? "").trim();
  const description = String(form.description ?? "").trim();
  // og_image_url хранится относительным путём /media/… — предпросмотр
  // берёт файл с домена API.
  const ogImage = mediaUrl(String(form.og_image_url ?? ""));
  const noindex = Boolean(form.noindex);
  const [ogBroken, setOgBroken] = useState(false);
  useEffect(() => setOgBroken(false), [ogImage]);

  const titleOver = countGraphemes(title) > TITLE_LIMIT;
  const descOver = countGraphemes(description) > DESC_LIMIT;

  return (
    <>
      <div className="banner-preview-label">Сниппет в поиске</div>
      <div className="card serp-card">
        {noindex && (
          <span className="badge badge-muted serp-noindex">
            noindex — страница скрыта из поиска
          </span>
        )}
        <div className="serp-crumb mono">{crumb(slug || "/")}</div>
        <div className={"serp-title" + (title ? "" : " ph")}>
          {title ? truncate(title, TITLE_LIMIT + 3) : "Title страницы…"}
        </div>
        {/* overflow-wrap: длинная неразрывная строка (вставленный URL)
            не должна растягивать карточку предпросмотра */}
        <div
          className={"serp-desc" + (description ? "" : " ph")}
          style={{ overflowWrap: "anywhere" }}
        >
          {description
            ? truncate(description, DESC_LIMIT + 10)
            : "Description — 1–2 предложения о странице для поисковой выдачи…"}
        </div>
        {(titleOver || descOver) && (
          <div className="serp-warn">
            {titleOver &&
              `Title длиннее ${TITLE_LIMIT} символов — поисковик обрежет его. `}
            {descOver &&
              `Description длиннее ${DESC_LIMIT} символов — конец не попадёт в сниппет.`}
          </div>
        )}
      </div>

      <div
        className="banner-preview-label"
        style={{ marginTop: "var(--sp-4)" }}
      >
        Карточка при шаринге (OG)
      </div>
      <div className="card serp-og">
        <div className="serp-og-image">
          {ogImage && !ogBroken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ogImage} alt="" onError={() => setOgBroken(true)} />
          ) : ogImage ? (
            // Файл не открылся — говорим об этом прямо: иначе пустая
            // карточка выглядит как «обложка по умолчанию».
            <span className="serp-og-fallback serp-og-missing">
              Файл не найден — проверьте изображение в поле «OG-картинка»
            </span>
          ) : (
            <span className="serp-og-fallback">
              обложка по умолчанию /og-cover.png
            </span>
          )}
        </div>
        <div className="serp-og-meta">
          <div
            className={"serp-og-title" + (title ? "" : " ph")}
            style={{ overflowWrap: "anywhere" }}
          >
            {title ? truncate(title, 70) : "Title страницы…"}
          </div>
          <div className="serp-og-host mono">{crumb("/").split(" › ")[0]}</div>
        </div>
      </div>
      <p className="banner-preview-note">
        Так страница будет выглядеть в выдаче и при отправке ссылки в
        мессенджер. Обновляется по мере ввода.
      </p>
    </>
  );
}
