"use client";

import type { ReactNode } from "react";
import { useInView, useMotionReady } from "@/presentation/hooks/use-in-view";
import { cn } from "@/presentation/lib/cn";
import styles from "./SectionHeading.module.css";

/**
 * Отбивка секции. Три подачи вместо одной — иначе двенадцать секций подряд
 * читаются как один бесконечный шаблон:
 *  chapter — «глава» проекта: фолио-номер, линия во всю ширину, крупный
 *            заголовок (О комплексе, Локация, Инфраструктура, Апартаменты,
 *            Инвестиции);
 *  aside   — служебный раздел: заголовок в левой колонке, лид — в правой,
 *            без номера (Планировки, Рассрочка, Новости…);
 *  plain   — короткая отбивка без линии и номера, для мелких блоков.
 */
export type SectionHeadingVariant = "chapter" | "aside" | "plain";

export function SectionHeading({
  index,
  eyebrow,
  title,
  lead,
  align = "left",
  variant = "chapter",
  action,
}: {
  /** Номер главы, напр. «01» — как на чертёжном листе. Только для chapter. */
  index?: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  variant?: SectionHeadingVariant;
  /** Правый угол отбивки: ссылка «Все планировки» и т.п. */
  action?: ReactNode;
}) {
  const ready = useMotionReady();
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.25 });
  const showFolio = variant === "chapter" && Boolean(index);

  return (
    <header
      ref={ref}
      className={cn(
        styles.heading,
        styles[variant],
        styles[align],
        ready && styles.armed,
        inView && styles.in
      )}
    >
      <div className={styles.side}>
        {showFolio || eyebrow ? (
          <div className={styles.kicker}>
            {showFolio ? <span className={styles.folio}>{index}</span> : null}
            {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
          </div>
        ) : null}
        {variant === "chapter" ? (
          <span className={styles.waterline} aria-hidden="true" />
        ) : null}
        <h2 className={styles.title}>{title}</h2>
      </div>
      {lead || action ? (
        <div className={styles.trail}>
          {lead ? <p className={styles.lead}>{lead}</p> : null}
          {action ? <div className={styles.action}>{action}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
