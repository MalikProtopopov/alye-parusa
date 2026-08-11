import type { Floorplan, PlanCategory, SiteDocument } from "@/domain";
import { PageIntro } from "../layout/PageIntro";
import { LeadCtaSection } from "../lead/LeadCtaSection";
import { Container } from "../primitives/Container";
import { RichText } from "../primitives/RichText";
import { JsonLd } from "../seo/JsonLd";
import { itemListJsonLd } from "@/presentation/lib/structured-data";
import { CatalogGrid } from "./CatalogGrid";
import { FilterChips } from "./FilterChips";
import styles from "./CatalogPageContent.module.css";

export function policyHrefOf(policy: SiteDocument | null): string {
  return policy ? `/dokumenty/${policy.slug}` : "/dokumenty";
}

/** Shared body of /planirovki and its category-filtered ЧПУ variant. */
export function CatalogPageContent({
  categories,
  floorplans,
  activeCategory,
  eyebrow,
  title,
  policy,
}: {
  categories: PlanCategory[];
  floorplans: Floorplan[];
  activeCategory: PlanCategory | null;
  eyebrow?: string;
  title: string;
  policy: SiteDocument | null;
}) {
  const crumbs = activeCategory
    ? [
        { label: "Главная", href: "/" },
        { label: "Планировки", href: "/planirovki" },
        { label: activeCategory.title },
      ]
    : [{ label: "Главная", href: "/" }, { label: "Планировки" }];

  return (
    <main>
      {floorplans.length > 0 ? (
        <JsonLd data={itemListJsonLd(floorplans, "/planirovki")} />
      ) : null}
      <PageIntro
        crumbs={crumbs}
        eyebrow={eyebrow}
        title={activeCategory ? activeCategory.title : title}
        // Общий lead — только на корневом каталоге; у категории своё интро из CMS.
        lead={
          activeCategory
            ? undefined
            : "Выберите формат — от компактных студий до семейных апартаментов у моря."
        }
      >
        {activeCategory?.descriptionHtml ? (
          <RichText
            html={activeCategory.descriptionHtml}
            className={styles.categoryIntro}
          />
        ) : null}
      </PageIntro>
      {/* Фильтр прижат к шапке страницы: раньше между ними пустовал целый
          экран, и чипсы висели в воздухе */}
      <div className={styles.filterBar}>
        <Container>
          <div className={styles.filterRow}>
            <FilterChips categories={categories} activeSlug={activeCategory?.slug} />
            <span className={styles.count}>
              {floorplans.length}
              {" "}
              {floorplans.length % 10 === 1 && floorplans.length % 100 !== 11
                ? "планировка"
                : [2, 3, 4].includes(floorplans.length % 10) &&
                    ![12, 13, 14].includes(floorplans.length % 100)
                  ? "планировки"
                  : "планировок"}
            </span>
          </div>
        </Container>
      </div>
      {/* Сетка идёт сразу за полосой фильтра: полный отступ секции оставлял
          между ними пустой экран */}
      <div className={styles.gridWrap}>
        <Container>
          <CatalogGrid floorplans={floorplans} />
        </Container>
      </div>
      <LeadCtaSection
        title="Не нашли свой формат?"
        lead="Оставьте заявку — менеджер BUYHOUSE подберёт планировку под ваши задачи."
        sourceBlock="catalog"
        policyHref={policyHrefOf(policy)}
      />
    </main>
  );
}
