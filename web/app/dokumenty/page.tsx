import type { Metadata } from "next";
import { publications } from "@/composition/container";
import { DocumentsGrid } from "@/presentation/components/docs/DocumentsGrid";
import { PageIntro } from "@/presentation/components/layout/PageIntro";
import { Container } from "@/presentation/components/primitives/Container";
import { Section } from "@/presentation/components/primitives/Section";
import { buildPageMetadata } from "@/presentation/lib/seo";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    slug: "/dokumenty",
    fallbackTitle: "Документы",
    fallbackDescription:
      "Разрешительная документация, проектная декларация и политика конфиденциальности апарт-комплекса «Алые Паруса».",
    canonicalPath: "/dokumenty",
  });
}

export default async function DocumentsPage() {
  const documents = await publications.documents();

  return (
    <main>
      <PageIntro
        crumbs={[{ label: "Главная", href: "/" }, { label: "Документы" }]}
        eyebrow="Правовая информация"
        title="Документы"
        lead="Разрешительная документация проекта и официальные материалы застройщика."
      />
      <Section tone="base">
        <Container>
          <DocumentsGrid documents={documents} />
        </Container>
      </Section>
    </main>
  );
}
