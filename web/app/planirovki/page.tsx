import type { Metadata } from "next";
import { catalog, content, publications } from "@/composition/container";
import { CatalogPageContent } from "@/presentation/components/catalog/CatalogPageContent";
import { buildPageMetadata } from "@/presentation/lib/seo";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    slug: "/planirovki",
    fallbackTitle: "Планировки апартаментов",
    fallbackDescription:
      "Каталог планировок апарт-комплекса «Алые Паруса»: студии и апартаменты 22–79 м² на первой береговой линии Каспийского моря.",
    canonicalPath: "/planirovki",
  });
}

export default async function FloorplansPage() {
  const [{ categories, floorplans }, policy, text] = await Promise.all([
    catalog.overview(),
    publications.policy(),
    content.sectionText("floorplans"),
  ]);

  return (
    <CatalogPageContent
      categories={categories}
      floorplans={floorplans}
      activeCategory={null}
      eyebrow={text.eyebrow}
      title={text.title}
      policy={policy}
    />
  );
}
