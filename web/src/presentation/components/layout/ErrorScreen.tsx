import type { ReactNode } from "react";
import { Sail } from "../brand/Sail";
import { Button } from "../primitives/Button";
import styles from "./ErrorScreen.module.css";

/** Full-height service screen for 404 / runtime errors, in the monograph style. */
export function ErrorScreen({
  code,
  title,
  text,
  actions,
}: {
  code?: string;
  title: string;
  text?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <Sail className={styles.sail} />
        {code ? <p className={styles.code}>{code}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        {text ? <p className={styles.text}>{text}</p> : null}
        <div className={styles.actions}>
          {actions ?? <Button href="/">На главную</Button>}
        </div>
      </div>
    </div>
  );
}
