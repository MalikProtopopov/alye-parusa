import type { ReactNode } from "react";
import { SafeImage } from "../primitives/SafeImage";
import styles from "./Interlude.module.css";

/**
 * Полноширинная врезка между секциями: кадр во всю ширину и одна фраза.
 * Ломает монотонный ритм «отбивка → сетка → отбивка → сетка», из-за которого
 * страница читалась как шаблон. Контент художественный, из статики.
 */
export function Interlude({
  image,
  alt,
  eyebrow,
  children,
  align = "left",
}: {
  image: string;
  alt: string;
  eyebrow?: string;
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <section className={`${styles.interlude} ${styles[align]}`}>
      <div className={styles.media}>
        <SafeImage
          src={image}
          alt={alt}
          fill
          sizes="100vw"
          className={styles.img}
        />
        <span className={styles.scrim} aria-hidden="true" />
      </div>
      <div className={styles.body}>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <p className={styles.phrase}>{children}</p>
      </div>
    </section>
  );
}
