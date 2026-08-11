import { cn } from "@/presentation/lib/cn";
import styles from "./RichText.module.css";

/**
 * Renders CMS rich text. The ONLY dangerouslySetInnerHTML in the app — the
 * backend sanitizes editor HTML before it ever reaches the API.
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(styles.rich, className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
