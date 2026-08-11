import type { Metadata } from "next";
import { content, publications } from "@/composition/container";
import { PageIntro } from "@/presentation/components/layout/PageIntro";
import { NewsGrid } from "@/presentation/components/news/NewsGrid";
import { Container } from "@/presentation/components/primitives/Container";
import { Section } from "@/presentation/components/primitives/Section";
import { buildPageMetadata } from "@/presentation/lib/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    slug: "/novosti",
    fallbackTitle: "Новости",
    fallbackDescription:
      "Новости строительства и жизни апарт-комплекса «Алые Паруса» на первой линии Каспийского моря.",
    canonicalPath: "/novosti",
  });
}

export default async function NewsPage() {
  const [items, text] = await Promise.all([
    publications.news(),
    content.sectionText("news"),
  ]);

  return (
    <main>
      <PageIntro
        crumbs={[{ label: "Главная", href: "/" }, { label: "Новости" }]}
        eyebrow={text.title}
        title="Новости"
        lead="События проекта: ход строительства, запуск продаж, жизнь квартала."
      />
      <Section tone="base">
        <Container>
          <NewsGrid items={items} />
        </Container>
      </Section>
    </main>
  );
}
