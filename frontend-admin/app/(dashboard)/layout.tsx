"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, apiFetch, clearAuth, getRole, getToken } from "../lib/api";
import type { FeatureFlags, Me, Role } from "../lib/types";
import { roleLabel } from "../lib/labels";
import { SITE } from "../lib/site";
import { useNewLeadsCount } from "../lib/useNewLeadsCount";
import { Icon, type IconName } from "../components/icons";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  roles: Role[];
  feature?: keyof FeatureFlags; // если задан — пункт скрыт при выключенной фиче
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// Сгруппированная навигация: Продажи / Каталог / Контент / Сайт.
const NAV_GROUPS: NavGroup[] = [
  {
    title: "Продажи",
    items: [
      { href: "/dashboard", label: "Обзор", icon: "chart", roles: ["admin", "manager"] },
      { href: "/leads", label: "Заявки", icon: "inbox", roles: ["admin", "manager"] },
    ],
  },
  {
    title: "Каталог",
    items: [
      { href: "/floorplans", label: "Планировки", icon: "floorplan", roles: ["admin"] },
      { href: "/plan-categories", label: "Категории планировок", icon: "tag", roles: ["admin"] },
      { href: "/calculator", label: "Калькулятор рассрочки", icon: "calculator", roles: ["admin"], feature: "calculator" },
    ],
  },
  {
    title: "Контент",
    items: [
      { href: "/banner", label: "Hero / Баннер", icon: "banner", roles: ["admin"] },
      { href: "/hero-chapters", label: "Главы hero", icon: "layers", roles: ["admin"] },
      { href: "/site-texts", label: "Тексты секций", icon: "type", roles: ["admin"] },
      { href: "/advantages", label: "Преимущества", icon: "star", roles: ["admin"], feature: "advantages" },
      { href: "/facts", label: "Факты", icon: "sparkles", roles: ["admin"] },
      { href: "/partners", label: "Партнёры", icon: "handshake", roles: ["admin"], feature: "partners" },
      { href: "/team", label: "Команда", icon: "users", roles: ["admin"], feature: "team" },
      { href: "/faq", label: "FAQ", icon: "question", roles: ["admin"], feature: "faq" },
      { href: "/news", label: "Новости", icon: "news", roles: ["admin"], feature: "news" },
      { href: "/documents", label: "Документы", icon: "document", roles: ["admin"], feature: "documents" },
    ],
  },
  {
    title: "Сайт",
    items: [
      { href: "/contacts", label: "Контакты", icon: "contact", roles: ["admin"] },
      { href: "/seo", label: "SEO", icon: "seo", roles: ["admin"], feature: "seo_admin" },
      { href: "/redirects", label: "Редиректы", icon: "redirect", roles: ["admin"], feature: "seo_admin" },
      { href: "/settings", label: "Настройки", icon: "gear", roles: ["admin"] },
    ],
  },
];

// Плоский список пунктов — для заголовка раздела в топбаре.
const NAV_FLAT: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

// Контентные разделы, недоступные менеджеру.
const ADMIN_ONLY = [
  "/floorplans",
  "/plan-categories",
  "/advantages",
  "/facts",
  "/site-texts",
  "/hero-chapters",
  "/partners",
  "/team",
  "/faq",
  "/news",
  "/documents",
  "/banner",
  "/contacts",
  "/calculator",
  "/seo",
  "/redirects",
  "/settings",
];

// Fallback фичефлагов: при ошибке загрузки ничего не скрываем.
const ALL_FEATURES_ON: FeatureFlags = {
  news: true,
  faq: true,
  advantages: true,
  partners: true,
  team: true,
  documents: true,
  calculator: true,
  seo_admin: true,
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [role, setRole] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureFlags | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const newLeads = useNewLeadsCount();
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);

  // Мобильное меню закрывается при переходе на другую страницу.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Открытый drawer: блокируем прокрутку фона, Escape закрывает,
  // фокус — в меню при открытии и обратно на гамбургер при закрытии.
  // Уход за брейкпоинт (ресайз/поворот экрана) закрывает drawer: выше 768px
  // сайдбар и так виден, а гамбургер скрыт — иначе блокировка прокрутки
  // осталась бы навсегда.
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    const wide = window.matchMedia("(min-width: 769px)");
    function onWide() {
      if (wide.matches) setMenuOpen(false);
    }
    onWide();
    wide.addEventListener("change", onWide);
    document.addEventListener("keydown", onKey);
    const hamburger = hamburgerRef.current;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      hamburger?.focus();
    };
  }, [menuOpen]);

  // Публичные фичефлаги (без токена): скрываем пункты меню для выключенных фич.
  useEffect(() => {
    let cancelled = false;
    apiFetch<FeatureFlags>("/api/v1/features", { auth: false })
      .then((data) => {
        if (!cancelled) setFeatures(data);
      })
      .catch(() => {
        if (!cancelled) setFeatures(ALL_FEATURES_ON);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Guard: проверяем токен и роль до отрисовки контента.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      // Возвратный URL: после входа пользователь попадает туда, куда шёл
      // (например, /leads?lead=… из Telegram-уведомления).
      const here = pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(here)}`);
      return;
    }
    const storedRole = getRole();
    setRole(storedRole);

    // Оптимистичная предварительная проверка по роли из localStorage:
    // менеджер не имеет доступа к контентным разделам.
    if (
      storedRole === "manager" &&
      ADMIN_ONLY.some((p) => pathname === p || pathname.startsWith(p + "/"))
    ) {
      router.replace("/leads?denied=1");
      return;
    }

    // Подтверждаем сессию и получаем email/роль (401 → редирект внутри apiFetch).
    let cancelled = false;
    setError(null);
    apiFetch<Me>("/api/v1/admin/auth/me")
      .then((data) => {
        if (cancelled) return;
        setMe(data);
        setRole(data.role);
        // Повторная проверка ADMIN_ONLY уже по ПОДТВЕРЖДЁННОЙ роли.
        if (
          data.role === "manager" &&
          ADMIN_ONLY.some((p) => pathname === p || pathname.startsWith(p + "/"))
        ) {
          router.replace("/leads?denied=1");
          return;
        }
        setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // 401 обрабатывается внутри apiFetch (чистит сессию + редирект на /login),
        // здесь ничего не рендерим. Для прочих ошибок — показываем экран ошибки.
        if (err instanceof ApiError && err.status === 401) return;
        setError(
          err instanceof Error ? err.message : "Не удалось загрузить профиль"
        );
      });

    return () => {
      cancelled = true;
    };
  }, [router, pathname, attempt]);

  function logout() {
    clearAuth();
    router.replace("/login");
  }

  // Ошибка ПЕРВИЧНОЙ проверки сессии (любая, кроме 401) — не оставляем вечный
  // спиннер. Когда сессия уже подтверждена (ready), сбой повторной проверки
  // при навигации показываем неразрушающим баннером внутри шелла ниже.
  if (error && !ready) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          padding: "var(--sp-5)",
        }}
      >
        <div style={{ maxWidth: 420, width: "100%" }}>
          <div className="alert alert-error">{error}</div>
          <div className="row-gap">
            <button
              className="btn btn-primary"
              onClick={() => {
                setError(null);
                setAttempt((n) => n + 1);
              }}
            >
              Повторить
            </button>
            <button className="btn" onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ждём и сессию, и фичефлаги: иначе пункты меню «допрыгивают» после
  // ответа /features и уводят клик не туда. Запрос флагов всегда завершается
  // (при ошибке — fallback ALL_FEATURES_ON), вечного спиннера не будет.
  if (!ready || !features) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <span className="spin" aria-label="Загрузка" />
      </div>
    );
  }

  // Фильтрация пункта: роль + фичефлаг (как раньше, но по группам).
  function itemVisible(item: NavItem): boolean {
    if (!role || !item.roles.includes(role as Role)) return false;
    // Пункт с фичефлагом виден только при включённой фиче
    // (пока флаги не загружены — прячем такие пункты).
    if (item.feature) {
      if (!features) return false;
      if (!features[item.feature]) return false;
    }
    return true;
  }

  // Группы без видимых пунктов не показываем (у менеджера — только «Продажи»).
  const visibleGroups = NAV_GROUPS.map((g) => ({
    title: g.title,
    items: g.items.filter(itemVisible),
  })).filter((g) => g.items.length > 0);

  // Название текущего раздела + крошка «Создание/Редактирование».
  const currentSection = NAV_FLAT.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  let crumb: string | null = null;
  if (currentSection && pathname !== currentSection.href) {
    crumb = pathname === `${currentSection.href}/new` ? "Создание" : "Редактирование";
  }

  return (
    <div className="shell">
      {menuOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        ref={sidebarRef}
        tabIndex={-1}
        className={"sidebar" + (menuOpen ? " open" : "")}
      >
        <div className="sidebar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt=""
            width={26}
            height={30}
            className="sidebar-logo"
          />
          <span>
            Алые Паруса
            <small>Админка</small>
          </span>
        </div>
        <nav className="nav">
          {visibleGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              <div className="nav-group-title">{group.title}</div>
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const showBadge =
                  item.href === "/leads" &&
                  typeof newLeads === "number" &&
                  newLeads > 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={"nav-link" + (active ? " active" : "")}
                  >
                    <Icon name={item.icon} className="nav-ico" />
                    <span>{item.label}</span>
                    {showBadge && (
                      <span
                        className="nav-badge"
                        title={`Новых заявок: ${newLeads}`}
                      >
                        {newLeads}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <a
            className="nav-link"
            href={SITE}
            target="_blank"
            rel="noreferrer"
          >
            <span>Открыть сайт ↗</span>
          </a>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            ref={hamburgerRef}
            type="button"
            className="hamburger"
            aria-label={
              menuOpen
                ? "Закрыть меню"
                : typeof newLeads === "number" && newLeads > 0
                ? `Открыть меню, новых заявок: ${newLeads}`
                : "Открыть меню"
            }
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
            {/* На телефоне сайдбар с бейджем скрыт — счётчик новых заявок
                виден прямо на гамбургере. */}
            {!menuOpen && typeof newLeads === "number" && newLeads > 0 && (
              <span className="nav-badge nav-badge--hamburger" aria-hidden="true">
                {newLeads}
              </span>
            )}
          </button>
          <div className="topbar-title">
            {currentSection?.label ?? ""}
            {crumb && <span className="topbar-crumb"> / {crumb}</span>}
          </div>
          <div className="spacer" />
          <div className="topbar-user">
            <div className="email">{me?.email}</div>
            <div className="role">{me ? roleLabel(me.role) : ""}</div>
          </div>
          <button className="btn btn-sm" onClick={logout}>
            Выйти
          </button>
        </header>
        <main className="content">
          {/* Сбой повторной проверки сессии при навигации: шелл и страница
              остаются, ошибка — неразрушающим баннером с «Повторить». */}
          {error && (
            <div className="alert alert-warn">
              <div className="row-gap">
                <span>Не удалось проверить сессию: {error}</span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setError(null);
                    setAttempt((n) => n + 1);
                  }}
                >
                  Повторить
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  aria-label="Скрыть предупреждение"
                  onClick={() => setError(null)}
                >
                  Скрыть
                </button>
              </div>
            </div>
          )}
          {/* Раздел выключен фичефлагом, но открыт по прямой ссылке:
              редактор должен знать, что правки не видны посетителям. */}
          {currentSection?.feature &&
            features &&
            !features[currentSection.feature] && (
              <div className="alert alert-warn">
                Раздел сейчас выключен на сайте — изменения сохраняются, но
                посетителям не видны
              </div>
            )}
          {children}
        </main>
      </div>
    </div>
  );
}
