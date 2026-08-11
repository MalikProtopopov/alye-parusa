// Библиотека inline-SVG иконок админки.
// Единый стиль: 18×18, viewBox 24, stroke 1.6, currentColor, без заливки.

import type { SVGProps } from "react";

export type IconName =
  | "inbox" // Заявки — входящие
  | "chart" // Обзор — график
  | "floorplan" // Планировки — дом-план
  | "tag" // Категории планировок — ярлык
  | "calculator" // Калькулятор рассрочки
  | "banner" // Hero / Баннер — картинка
  | "layers" // Главы hero — слои
  | "type" // Тексты секций — литера
  | "star" // Преимущества
  | "sparkles" // Факты — искры
  | "handshake" // Партнёры
  | "users" // Команда
  | "question" // FAQ
  | "news" // Новости — газета
  | "document" // Документы
  | "contact" // Контакты — телефон/письмо
  | "seo" // SEO — лупа с графиком
  | "redirect" // Редиректы — стрелка-поворот
  | "gear"; // Настройки — шестерёнка

function base(props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...props,
  };
}

const PATHS: Record<IconName, React.ReactNode> = {
  chart: (
    <>
      <path d="M4 19.5h16" />
      <path d="M6 16l4.2-5.2 3 3.1L18.5 7" />
      <circle cx="18.5" cy="7" r="1.3" />
    </>
  ),
  // Лоток входящих со стрелкой вниз
  inbox: (
    <>
      <path d="M4 13.5h4l1.6 2.5h4.8l1.6-2.5h4" />
      <path d="M4 13.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5.5" />
      <path d="M12 4v6.5" />
      <path d="M9.5 8.5 12 11l2.5-2.5" />
    </>
  ),
  // Дом с линиями плана внутри
  floorplan: (
    <>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M5.5 14.5H11" />
      <path d="M11 20v-5.5" />
      <path d="M14.5 14.5h4" />
      <path d="M14.5 14.5V11" />
    </>
  ),
  // Калькулятор: корпус, экран, клавиши
  calculator: (
    <>
      <rect x="5.5" y="3.5" width="13" height="17" rx="1.5" />
      <path d="M8.5 7h7" />
      <path d="M8.5 11.5h.01" />
      <path d="M12 11.5h.01" />
      <path d="M15.5 11.5h.01" />
      <path d="M8.5 14.75h.01" />
      <path d="M12 14.75h.01" />
      <path d="M15.5 14.75h.01" />
      <path d="M8.5 18h.01" />
      <path d="M12 18h.01" />
      <path d="M15.5 18h.01" />
    </>
  ),
  // Картинка: рамка, солнце, гора
  banner: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M3.5 16.5 9.5 13l4 3 3-2.5 4 3" />
    </>
  ),
  // Пятиконечная звезда
  star: (
    <path d="M12 3.8l2.47 5.01 5.53.8-4 3.9.94 5.51L12 16.42 7.06 19.02 8 13.51l-4-3.9 5.53-.8L12 3.8z" />
  ),
  // Рукопожатие (упрощённое)
  handshake: (
    <>
      <path d="M2.5 8.5 7 6.5l5 2 4.5-2 5 2.2" />
      <path d="M2.5 8.5v6l3 1.5" />
      <path d="M21.5 8.7v5.8l-3 1.5" />
      <path d="M12 8.5 8.5 12a1.6 1.6 0 0 0 2.3 2.3l1.7-1.7" />
      <path d="M12.5 12.6l3 3a1.5 1.5 0 0 1-2.1 2.1l-.9-.9" />
      <path d="M12.4 16.8a1.5 1.5 0 0 1-2.1 2.1l-1.2-1.2" />
      <path d="M18.5 16 15 12.5" />
    </>
  ),
  // Два пользователя
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.5-3.2 2.8-5 5.5-5s5 1.8 5.5 5" />
      <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8" />
      <path d="M17.5 14.9c1.7.8 2.7 2.4 3 4.6" />
    </>
  ),
  // Знак вопроса в круге
  question: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.4 2.4 0 1 1 3.5 2.9c-.7.5-1.1 1-1.1 1.9" />
      <path d="M12 17.2h.01" />
    </>
  ),
  // Газета: страница с колонками
  news: (
    <>
      <path d="M7 4.5h13v13.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V7.5h3" />
      <path d="M7 4.5V18a1.5 1.5 0 0 1-1.5 1.5" />
      <rect x="10" y="7.5" width="7" height="4" />
      <path d="M10 14.5h7" />
      <path d="M10 17h4.5" />
    </>
  ),
  // Ярлык-бирка с отверстием
  tag: (
    <>
      <path d="M12.5 3.5H20.5v8l-8.6 8.6a1.5 1.5 0 0 1-2.1 0l-5.9-5.9a1.5 1.5 0 0 1 0-2.1l8.6-8.6z" />
      <circle cx="16.5" cy="7.5" r="1.3" />
    </>
  ),
  // Три слоя (стопка)
  layers: (
    <>
      <path d="M12 3.5 21 8.5 12 13.5 3 8.5 12 3.5z" />
      <path d="m4.5 12.3 7.5 4.2 7.5-4.2" />
      <path d="m4.5 16.1 7.5 4.2 7.5-4.2" />
    </>
  ),
  // Литера «T» с засечками (типографика)
  type: (
    <>
      <path d="M5 7.5V4.5h14v3" />
      <path d="M12 4.5v15" />
      <path d="M9 19.5h6" />
    </>
  ),
  // Искры: большая четырёхлучевая + малая
  sparkles: (
    <>
      <path d="M10 3.5 11.7 8.3 16.5 10l-4.8 1.7L10 16.5 8.3 11.7 3.5 10l4.8-1.7L10 3.5z" />
      <path d="M17.5 13.5l1 2.7 2.7 1-2.7 1-1 2.7-1-2.7-2.7-1 2.7-1 1-2.7z" />
    </>
  ),
  // Лист документа с загнутым углом
  document: (
    <>
      <path d="M6 3.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1-1.5z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M8.5 12.5h7" />
      <path d="M8.5 16h5" />
    </>
  ),
  // Телефонная трубка + письмо
  contact: (
    <>
      <path d="M4 5.5c0 7.5 6 13 13.5 13.5l1.5-3-3.5-2-1.7 1.4A11.5 11.5 0 0 1 8.6 10L10 8.5 8 5 4 5.5z" />
      <rect x="14" y="4" width="7" height="5" rx="0.8" />
      <path d="m14 4.5 3.5 2.5L21 4.5" />
    </>
  ),
  // Лупа с графиком роста внутри
  seo: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
      <path d="M7.5 12.5 10 10l1.8 1.6 2.7-3" />
      <path d="M14.5 8.6v1.8h-1.8" />
    </>
  ),
  // Стрелка-поворот: путь уходит вправо-вверх (301-редирект)
  redirect: (
    <>
      <path d="M4 18h6a4 4 0 0 0 4-4V7" />
      <path d="M10.5 10 14 6.5 17.5 10" />
      <path d="M17 18h3" />
    </>
  ),
  // Шестерёнка
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" />
    </>
  ),
};

/** Иконка навигации по имени. */
export function Icon({
  name,
  ...props
}: { name: IconName } & SVGProps<SVGSVGElement>) {
  return <svg {...base(props)}>{PATHS[name]}</svg>;
}

/** Открытый глаз (пароль показан). */
export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

/** Перечёркнутый глаз (пароль скрыт). */
export function EyeOffIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 4l16 16" />
      <path d="M9.9 6.1A9.4 9.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-3.2 3.9" />
      <path d="M6.1 8.3A17 17 0 0 0 2.5 12S6 18.5 12 18.5c1.2 0 2.3-.26 3.3-.68" />
      <path d="M9.9 9.9a2.8 2.8 0 0 0 4 4" />
    </svg>
  );
}

/** Стрелка загрузки (для зоны drag-n-drop). */
export function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base({ width: 22, height: 22, ...props })}>
      <path d="M12 15.5V5" />
      <path d="M7.5 9.5 12 5l4.5 4.5" />
      <path d="M4.5 15.5V18A1.5 1.5 0 0 0 6 19.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5" />
    </svg>
  );
}

/** Корзина (удаление файла в медиатеке). */
export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base({ width: 15, height: 15, ...props })}>
      <path d="M4 6.5h16" />
      <path d="M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" />
      <path d="M6.5 6.5 7.4 19a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.5" />
      <path d="M10 10.5v6" />
      <path d="M14 10.5v6" />
    </svg>
  );
}

/** Карандаш (изменить запись) — иконочная кнопка в строке списка. */
export function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base({ width: 16, height: 16, ...props })}>
      {/* Остриё (4,20) → корпус под 45° → скруглённый торец ластика */}
      <path d="M4 20L4.9 16.3L13.6 7.6a2 2 0 0 1 2.8 2.8L7.7 19.2Z" />
      {/* Ободок у ластика */}
      <path d="M10.7 10.5L13.5 13.3" />
    </svg>
  );
}

/** Стрелка из рамки (открыть на сайте в новой вкладке). */
export function ExternalLinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base({ width: 16, height: 16, ...props })}>
      <path d="M14 4.5h5.5V10" />
      <path d="M19.5 4.5 11 13" />
      <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </svg>
  );
}

/** Галочка чекбокса (рисуется внутри стилизованного бокса). */
export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base({ width: 14, height: 14, strokeWidth: 2.4, ...props })}>
      <path d="m5 12.5 4.6 4.6L19 7" />
    </svg>
  );
}

/** Крестик (закрыть модалку). */
export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}
