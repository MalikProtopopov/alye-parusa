import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { stripHtml } from "@/domain";
import { publications, siteMeta } from "@/composition/container";
import { DocumentDetail } from "@/presentation/components/docs/DocumentDetail";
import { DOC_TYPE_LABELS } from "@/presentation/components/docs/doc-type";
import { PageIntro } from "@/presentation/components/layout/PageIntro";
import { Container } from "@/presentation/components/primitives/Container";
import { Section } from "@/presentation/components/primitives/Section";
import { buildPageMetadata } from "@/presentation/lib/seo";

export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const documents = await publications.documents();
    return documents.map((doc) => ({ slug: doc.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const document = await publications.documentItem(slug);
  if (!document) return { title: "Документы" };
  return buildPageMetadata({
    slug: `/dokumenty/${slug}`,
    fallbackTitle: document.title,
    fallbackDescription: document.descriptionHtml
      ? stripHtml(document.descriptionHtml)
      : `${DOC_TYPE_LABELS[document.docType]} апарт-комплекса «Алые Паруса».`,
    canonicalPath: `/dokumenty/${slug}`,
  });
}

export default async function DocumentPage({ params }: Params) {
  const { slug } = await params;
  const document = await publications.documentItem(slug);
  if (!document) {
    // Слаг сменился в CMS → админский 301 на новый адрес; иначе честный 404.
    const dest = await siteMeta.resolveRedirect(`/dokumenty/${slug}`);
    if (dest) permanentRedirect(dest);
    notFound();
  }

  return (
    <main>
      <PageIntro
        crumbs={[
          { label: "Главная", href: "/" },
          { label: "Документы", href: "/dokumenty" },
          { label: document.title },
        ]}
        eyebrow={DOC_TYPE_LABELS[document.docType]}
        title={document.title}
      />
      <Section tone="base">
        <Container>
          <DocumentDetail document={document} />
        </Container>
      </Section>
    </main>
  );
}
