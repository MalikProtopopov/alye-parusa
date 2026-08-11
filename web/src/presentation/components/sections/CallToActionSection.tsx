import type { ContactView } from "@/application";
import type { SectionText } from "@/domain";
import { multiline } from "@/presentation/lib/multiline";
import { LeadCoupon } from "../lead/LeadCoupon";
import { Container } from "../primitives/Container";
import { Reveal } from "../primitives/Reveal";
import { Section } from "../primitives/Section";
import styles from "./CallToActionSection.module.css";

/**
 * Финал страницы — не центрированный хвост лендинга: слева обращение и колофон
 * (кто строит, кто продаёт, кто проектировал), справа купон с бланком заявки.
 * Номера главы здесь нет намеренно — CTA служебная секция, не глава.
 */
export function CallToActionSection({
  contact,
  text,
  policyHref,
}: {
  contact: ContactView;
  text: SectionText;
  /** Принимается ради совместимости вызовов; фолио в CTA не рисуем. */
  index?: string;
  policyHref?: string;
}) {
  const { brands, location, cadastralNumber } = contact;

  return (
    <Section id="contact" tone="elevated">
      <Container>
        <div className={styles.cta}>
          <div className={styles.pitch}>
            {text.eyebrow ? <p className={styles.eyebrow}>{text.eyebrow}</p> : null}
            <span className={styles.waterline} aria-hidden="true" />
            <h2 className={styles.title}>{multiline(text.title)}</h2>
            {text.lead ? <p className={styles.lead}>{text.lead}</p> : null}
          </div>

          {/* Купон идёт до колофона в потоке — на узком экране бланк не должен
              оказаться под списком брендов и правовой сноской. На широком его
              переносит в правую колонку grid-area. */}
          <Reveal variant="rise" className={styles.couponCell}>
            <LeadCoupon
              kind="simple_callback"
              sourceBlock="cta"
              sourceButton="Оставить заявку"
              policyHref={policyHref}
            />
          </Reveal>

          <div className={styles.colophon}>
            <ul className={styles.brands}>
              {brands.map((brand) => (
                <li key={brand.id} className={styles.brand}>
                  <span className={styles.brandName}>{brand.name}</span>
                  <span className={styles.brandRole}>{brand.roleLabel}</span>
                </li>
              ))}
            </ul>

            <p className={styles.legal}>
              Кадастровый номер участка {cadastralNumber} · {location.region},{" "}
              {location.district}. Материалы не являются публичной офертой.
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
