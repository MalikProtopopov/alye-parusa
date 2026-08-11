import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { stripHtml } from "@/domain";
import { catalog, content, publications, siteMeta } from "@/composition/container";
import {
  CatalogPageContent,
  policyHrefOf,
} from "@/presentation/components/catalog/CatalogPageContent";
import { FloorplanDetail } from "@/presentation/components/catalog/FloorplanDetail";
import { PageIntro } from "@/presentation/components/layout/PageIntro";
import { LeadCtaSection } from "@/presentation/components/lead/LeadCtaSection";
import { Container } from "@/presentation/components/primitives/Container";
import { Section } from "@/presentation/components/primitives/Section";
import { JsonLd } from "@/presentation/components/seo/JsonLd";
import { formatAreaM2 } from "@/presentation/lib/format";
import { buildPageMetadata } from "@/presentation/lib/seo";
import { floorplanJsonLd } from "@/presentation/lib/structured-data";

export const revalidate = 60;

type Params = { params: Promise<{ slug: string }> };

/** Docker builds run without a backend — an empty list keeps them green;
 *  runtime requests fall back to on-demand ISR (dynamicParams default). */
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const { categories, floorplans } = await catalog.overview();
    const slugs = new Set<string>([
      ...categories.map((c) => c.slug),
      ...floorplans.map((f) => f.slug),
    ]);
    return [...slugs].map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { activeCategory } = await catalog.overview(slug);
  if (activeCategory) {
    return buildPageMetadata({
      slug: `/planirovki/${slug}`,
      fallbackTitle: `${activeCategory.title} — планировки`,
      fallbackDescription: activeCategory.descriptionHtml
        ? stripHtml(activeCategory.descriptionHtml)
        : `Планировки категории «${activeCategory.title}» в апарт-комплексе «Алые Паруса» на первой линии Каспия.`,
      canonicalPath: `/planirovki/${slug}`,
    });
  }
  const floorplan = await catalog.floorplan(slug);
  if (floorplan) {
    const description = floorplan.descriptionHtml
      ? stripHtml(floorplan.descriptionHtml)
      : `Апартамент «${floorplan.title}» площадью ${formatAreaM2(floorplan.areaM2)} в апарт-комплексе «Алые Паруса».`;
    return buildPageMetadata({
      slug: `/planirovki/${slug}`,
      fallbackTitle: `${floorplan.title} — ${formatAreaM2(floorplan.areaM2)}`,
      fallbackDescription: description,
      ogImage: floorplan.imageUrl ?? undefined,
      ogImageAlt: `Планировка «${floorplan.title}»`,
      canonicalPath: `/planirovki/${slug}`,
    });
  }
  return { title: "Планировки" };
}

export default async function FloorplanSlugPage({ params }: Params) {
  const { slug } = await params;

  // ЧПУ resolution: category slug → filtered catalog; floorplan slug → detail.
  const overview = await catalog.overview(slug);
  const [policy, text] = await Promise.all([
    publications.policy(),
    content.sectionText("floorplans"),
  ]);

  if (overview.activeCategory) {
    return (
      <CatalogPageContent
        categories={overview.categories}
        floorplans={overview.floorplans}
        activeCategory={overview.activeCategory}
        eyebrow={text.eyebrow}
        title={text.title}
        policy={policy}
      />
    );
  }

  const floorplan = await catalog.floorplan(slug);
  if (!floorplan) {
    // Слаг сменился в CMS → админский 301 на новый адрес; иначе честный 404.
    const dest = await siteMeta.resolveRedirect(`/planirovki/${slug}`);
    if (dest) permanentRedirect(dest);
    notFound();
  }

  const features = await siteMeta.features();
  const teaser = features.calculator
    ? await catalog.installmentTeaser(floorplan.price)
    : null;

  const lead = [
    formatAreaM2(floorplan.areaM2),
    floorplan.floor !== null ? `${floorplan.floor} этаж` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main>
      <JsonLd data={floorplanJsonLd(floorplan, floorplan.price !== null)} />
      <PageIntro
        crumbs={[
          { label: "Главная", href: "/" },
          { label: "Планировки", href: "/planirovki" },
          { label: floorplan.title },
        ]}
        eyebrow={floorplan.category?.title ?? "Апартаменты"}
        title={floorplan.title}
        lead={lead}
      />
      <Section tone="base">
        <Container>
          <FloorplanDetail floorplan={floorplan} teaser={teaser} />
        </Container>
      </Section>
      <LeadCtaSection
        title="Забронировать этот апартамент"
        lead="Оставьте контакты — менеджер подтвердит доступность и условия рассрочки."
        kind="floorplan"
        sourceBlock="floorplan_detail"
        floorplanId={floorplan.id}
        policyHref={policyHrefOf(policy)}
        submitLabel="Отправить заявку"
      />
    </main>
  );
}
