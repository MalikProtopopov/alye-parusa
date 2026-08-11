import type { SiteDocument } from "@/domain";
import { Button } from "../primitives/Button";
import { RichText } from "../primitives/RichText";
import styles from "./DocumentDetail.module.css";

/** Body of a document page: rich description + download / external actions. */
export function DocumentDetail({ document }: { document: SiteDocument }) {
  return (
    <div className={styles.detail}>
      {document.descriptionHtml ? (
        <RichText html={document.descriptionHtml} className={styles.body} />
      ) : (
        <p className={styles.fallback}>
          Полный текст документа доступен по ссылке ниже.
        </p>
      )}
      <div className={styles.actions}>
        {document.fileUrl ? (
          <Button href={document.fileUrl}>Скачать PDF</Button>
        ) : null}
        {document.url ? (
          <Button href={document.url} variant={document.fileUrl ? "ghost" : "primary"}>
            Перейти по ссылке
          </Button>
        ) : null}
      </div>
    </div>
  );
}
