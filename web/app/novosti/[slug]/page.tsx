import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { stripHtml } from "@/domain";
import { publications, siteMeta } from "@/composition/container";
import { PageIntro } from "@/presentation/components/layout/PageIntro";
import { NewsArticle } from "@/presentation/components/news/NewsArticle";
import { NewsGrid } from "@/presentation/components/news/NewsGrid";
import { Container } from "@/presentation/components/primitives/Container";
import { Section } from "@/presentation/components/primitives/Section";
import { SectionHeading } from "@/presentation/components/primitives/SectionHeading";
import { JsonLd } from "@/presentation/components/seo/JsonLd";
import { formatDateRu } from "@/presentation/lib/format";
import { buildPageMetadata } from "@/presentation/lib/seo";
import { newsArticleJsonLd } from "@/presentation/lib/structured-data";

export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const items = await publications.news();
    return items.map((item) => ({ slug: item.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const item = await publications.newsItem(slug);
  if (!item) return { title: "Новости" };
  return buildPageMetadata({
    slug: `/novosti/${slug}`,
    fallbackTitle: item.title,
    fallbackDescription: item.excerpt ?? stripHtml(item.bodyHtml),
    ogImage: item.coverImageUrl ?? undefined,
    ogImageAlt: `Обложка новости «${item.title}»`,
    canonicalPath: `/novosti/${slug}`,
    ogType: "article",
    publishedTime: item.publishedAt ?? undefined,
    modifiedTime: item.updatedAt ?? item.publishedAt ?? undefined,
  });
}

export default async function NewsItemPage({ params }: Params) {
  const { slug } = await params;
  const item = await publications.newsItem(slug);
  if (!item) {
    // Слаг сменился в CMS → админский 301 на новый адрес; иначе честный 404.
    const dest = await siteMeta.resolveRedirect(`/novosti/${slug}`);
    if (dest) permanentRedirect(dest);
    notFound();
  }

  const others = (await publications.news())
    .filter((other) => other.slug !== item.slug)
    .slice(0, 3);
  const date = formatDateRu(item.publishedAt);

  return (
    <main>
      <JsonLd data={newsArticleJsonLd(item)} />
      <PageIntro
        crumbs={[
          { label: "Главная", href: "/" },
          { label: "Новости", href: "/novosti" },
          { label: item.title },
        ]}
        eyebrow={date ?? "Новости"}
        title={item.title}
        lead={item.excerpt ?? undefined}
      />
      <Section tone="base">
        <Container>
          <NewsArticle item={item} />
        </Container>
      </Section>
      {others.length > 0 ? (
        <Section tone="elevated">
          <Container>
            <SectionHeading eyebrow="Ещё из жизни проекта" title="Другие новости" />
            <NewsGrid items={others} spaced />
          </Container>
        </Section>
      ) : null}
    </main>
  );
}
