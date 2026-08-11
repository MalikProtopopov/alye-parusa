import Link from "next/link";
import type { Brand, GeoLocation, SiteContacts } from "@/domain";
import { telHref, telegramHref, whatsappHref } from "@/presentation/lib/contact-links";
import { Container } from "../primitives/Container";
import styles from "./SiteFooter.module.css";

export function SiteFooter({
  wordmark,
  tagline,
  brands,
  location,
  cadastralNumber,
  contacts,
  policy,
}: {
  wordmark: string;
  tagline: string;
  brands: Brand[];
  location: GeoLocation;
  /** Static fallback — the CMS value wins when filled. */
  cadastralNumber: string;
  contacts?: SiteContacts | null;
  policy?: { title: string; slug: string } | null;
}) {
  const year = new Date().getFullYear();
  const cadastre = contacts?.cadastralNumber?.trim() || cadastralNumber;
  const hasContacts = Boolean(
    contacts &&
      (contacts.phone ||
        contacts.email ||
        contacts.whatsapp ||
        contacts.telegram ||
        contacts.address ||
        contacts.workHours),
  );

  return (
    <footer className={styles.footer}>
      <Container>
        <div className={styles.top}>
          <div className={styles.identity}>
            <p className={styles.wordmark}>{wordmark}</p>
            <p className={styles.tagline}>{tagline}</p>
          </div>

          <div className={styles.columns}>
            <dl className={styles.brands}>
              {brands.map((brand) => (
                <div key={brand.id} className={styles.brand}>
                  <dt className={styles.brandName}>{brand.name}</dt>
                  <dd className={styles.brandRole}>{brand.roleLabel}</dd>
                </div>
              ))}
            </dl>

            {hasContacts && contacts ? (
              <div className={styles.col}>
                <p className={styles.colTitle}>Контакты</p>
                <ul className={styles.colList}>
                  {contacts.phone ? (
                    <li>
                      <a className={styles.colLink} href={telHref(contacts.phone)}>
                        {contacts.phone}
                      </a>
                    </li>
                  ) : null}
                  {contacts.email ? (
                    <li>
                      <a className={styles.colLink} href={`mailto:${contacts.email}`}>
                        {contacts.email}
                      </a>
                    </li>
                  ) : null}
                  {contacts.whatsapp ? (
                    <li>
                      <a
                        className={styles.colLink}
                        href={whatsappHref(contacts.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp
                      </a>
                    </li>
                  ) : null}
                  {contacts.telegram ? (
                    <li>
                      <a
                        className={styles.colLink}
                        href={telegramHref(contacts.telegram)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Telegram
                      </a>
                    </li>
                  ) : null}
                  {contacts.address ? <li className={styles.colText}>{contacts.address}</li> : null}
                  {contacts.workHours ? (
                    <li className={styles.colText}>{contacts.workHours}</li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            <div className={styles.col}>
              <p className={styles.colTitle}>Разделы</p>
              <ul className={styles.colList}>
                <li>
                  <Link className={styles.colLink} href="/planirovki">
                    Планировки
                  </Link>
                </li>
                <li>
                  <Link className={styles.colLink} href="/novosti">
                    Новости
                  </Link>
                </li>
                <li>
                  <Link className={styles.colLink} href="/dokumenty">
                    Документы
                  </Link>
                </li>
              </ul>
            </div>

            <div className={styles.col}>
              <p className={styles.colTitle}>Документы</p>
              <ul className={styles.colList}>
                <li>
                  <Link className={styles.colLink} href="/dokumenty">
                    Все документы
                  </Link>
                </li>
                {policy ? (
                  <li>
                    <Link className={styles.colLink} href={`/dokumenty/${policy.slug}`}>
                      Политика конфиденциальности
                    </Link>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <p>
            {location.region}, {location.district} · {location.seaLine}
          </p>
          <p>Кадастровый номер: {cadastre}</p>
          {contacts?.inn ? <p>ИНН {contacts.inn}</p> : null}
          {contacts?.ogrn ? <p>ОГРН {contacts.ogrn}</p> : null}
          <p>© {year} CHERKESOV GROUP</p>
        </div>
      </Container>
    </footer>
  );
}
