"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { grantConsent, hasConsent } from "@/presentation/lib/consent";
import styles from "./CookieConsent.module.css";

/**
 * Bottom consent notice (152-ФЗ): cookies/Метрика start only after «Принять».
 * Hidden until mounted so SSR markup never flashes for consenting visitors.
 */
export function CookieConsent({ policyHref = "/dokumenty" }: { policyHref?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasConsent()) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.bar} role="region" aria-label="Использование cookie">
      <p className={styles.text}>
        Мы используем cookie и Яндекс.Метрику, чтобы сайт работал лучше. Подробнее —
        в{" "}
        <Link href={policyHref} className={styles.link}>
          политике конфиденциальности
        </Link>
        .
      </p>
      <button
        type="button"
        className={styles.accept}
        onClick={() => {
          grantConsent();
          setVisible(false);
        }}
      >
        Принять
      </button>
    </div>
  );
}
