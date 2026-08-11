"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/presentation/lib/cn";
import { telHref, telegramHref, whatsappHref } from "@/presentation/lib/contact-links";
import { Container } from "../primitives/Container";
import styles from "./SiteHeader.module.css";

/** Разделы сайта. `inBar` — четыре пункта, которые помещаются в бар при
 *  контейнере 1240px; якоря главной живут в выдвижном меню (кнопка «Меню»
 *  видна всегда), иначе пункты налезали бы друг на друга. */
const NAV: { href: string; label: string; inBar?: boolean }[] = [
  { href: "/#about", label: "О комплексе" },
  { href: "/#location", label: "Локация" },
  { href: "/#infrastructure", label: "Инфраструктура" },
  { href: "/planirovki", label: "Планировки", inBar: true },
  { href: "/#calculator", label: "Рассрочка", inBar: true },
  { href: "/novosti", label: "Новости", inBar: true },
  { href: "/dokumenty", label: "Документы", inBar: true },
];

export interface HeaderContacts {
  phone: string | null;
  whatsapp: string | null;
  telegram: string | null;
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}

export function SiteHeader({
  brand,
  contacts,
}: {
  brand: string;
  contacts?: HeaderContacts | null;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Переход по ссылке закрывает меню (в т.ч. якорь на той же странице).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const close = useCallback(() => {
    setMenuOpen(false);
    burgerRef.current?.focus();
  }, []);

  // Открытое меню: фон не прокручивается, Escape закрывает, фокус внутри.
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, close]);

  // Внутренние страницы: под баром нет видео — он сразу непрозрачный.
  const solid = scrolled || pathname !== "/" || menuOpen;

  const isActive = (href: string) =>
    href.startsWith("/#")
      ? false
      : pathname === href || pathname.startsWith(href + "/");

  const phoneLink = contacts?.phone ? (
    <a href={telHref(contacts.phone)} className={styles.phone}>
      <span className={styles.phoneIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5z" />
        </svg>
      </span>
      <span className={styles.phoneText}>{contacts.phone}</span>
    </a>
  ) : null;

  const messengers = (
    <>
      {contacts?.whatsapp ? (
        <a
          href={whatsappHref(contacts.whatsapp)}
          className={styles.messenger}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Написать в WhatsApp"
          title="WhatsApp"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z" />
            <path d="M8.8 8.4c.3-.7.6-.7.9-.7h.7l1 2.3-.9.9a7 7 0 0 0 3 3l.9-.9 2.3 1v.7c0 .3 0 .6-.7.9-.8.3-2 .3-3.6-.5a11 11 0 0 1-4.1-4.1c-.8-1.6-.8-2.8-.5-3.6z" />
          </svg>
        </a>
      ) : null}
      {contacts?.telegram ? (
        <a
          href={telegramHref(contacts.telegram)}
          className={styles.messenger}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Написать в Telegram"
          title="Telegram"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 4.5 2.8 11.3l5 1.5 1.9 5.8 2.6-3.3 4.4 3.2z" />
            <path d="m7.8 12.8 9-5.6-6.2 6.4" />
          </svg>
        </a>
      ) : null}
    </>
  );

  return (
    <>
      <header id="top" className={cn(styles.header, solid && styles.scrolled)}>
      <Container>
        <div className={styles.bar}>
          <Link href="/" className={styles.brand} aria-label={`${brand} — на главную`}>
            <span className={styles.brandMark} aria-hidden="true">
              <svg viewBox="0 0 24 28">
                <path d="M12 2C7 8 5.5 17 7 25h5z" />
                <path d="M12 5c4 4.5 5 13 3.6 20H12z" />
                <path d="M4 25h16" />
              </svg>
            </span>
            <span className={styles.brandText}>{brand}</span>
          </Link>

          <nav className={styles.nav} aria-label="Основная навигация">
            {NAV.filter((item) => item.inBar).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  styles.link,
                  isActive(item.href) && styles.linkActive
                )}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={styles.actions}>
            {phoneLink}
            <div className={styles.messengers}>{messengers}</div>
            <Link href="/#contact" className={styles.cta}>
              Забронировать
            </Link>
            <button
              ref={burgerRef}
              type="button"
              className={styles.burger}
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MenuIcon open={menuOpen} />
            </button>
          </div>
        </div>
        </Container>
      </header>

      {/* Меню — СНАРУЖИ <header>: backdrop-filter шапки делает её контейнером
          для fixed-потомков, и панель схлопывалась до высоты бара. */}
      <div
        className={cn(styles.overlay, menuOpen && styles.overlayOpen)}
        onClick={close}
        aria-hidden="true"
      />
      <div
        id="site-menu"
        ref={panelRef}
        className={cn(styles.panel, menuOpen && styles.panelOpen)}
        role="dialog"
        aria-modal="true"
        aria-label="Меню сайта"
        // inert, а не hidden: hidden = display:none и убил бы анимацию, но без
        // него закрытая панель ловила бы Tab и торчала за правым краем
        inert={!menuOpen}
      >
        {/* Крестик: на тач-устройствах Escape недоступен, а бургер
            перекрыт панелью */}
        <button
          type="button"
          className={styles.panelClose}
          aria-label="Закрыть меню"
          onClick={close}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <nav className={styles.panelNav} aria-label="Разделы сайта">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                styles.panelLink,
                isActive(item.href) && styles.panelLinkActive
              )}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.panelFoot}>
          {contacts?.phone ? (
            <a href={telHref(contacts.phone)} className={styles.panelPhone}>
              {contacts.phone}
            </a>
          ) : null}
          <div className={styles.panelMessengers}>{messengers}</div>
          <Link
            href="/#contact"
            className={styles.panelCta}
            onClick={() => setMenuOpen(false)}
          >
            Забронировать апартамент
          </Link>
        </div>
      </div>
    </>
  );
}
