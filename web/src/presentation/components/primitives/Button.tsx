import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/presentation/lib/cn";
import styles from "./Button.module.css";

/** Same-origin path → client-side navigation; everything else stays a plain <a>. */
const isInternal = (href: string) => href.startsWith("/") && !href.startsWith("//");

export function Button({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  const classes = cn(styles.button, styles[variant], className);

  if (isInternal(href)) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={classes}>
      {children}
    </a>
  );
}
