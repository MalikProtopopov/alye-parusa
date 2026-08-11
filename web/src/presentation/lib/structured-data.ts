import type {
  AvailabilityStatus,
  FaqItem,
  Floorplan,
  NewsItem,
  SiteContacts,
} from "@/domain";
import { stripHtml } from "@/domain";
import { telegramHref, whatsappHref } from "./contact-links";
import { SITE_NAME, SITE_URL, absoluteUrl } from "./site-url";

/**
 * Чистые билдеры schema.org JSON-LD. Ноль fetch — работают на уже загруженных
 * данных страницы; сериализация — через <JsonLd/>.
 */

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

const SCHEMA_CONTEXT = "https://schema.org";

export interface BreadcrumbItem {
  label: string;
  /** Отсутствует у последней (текущей) крошки. */
  href?: string;
}

export function organizationJsonLd(contacts: SiteContacts | null): object {
  const sameAs = [
    contacts?.telegram ? telegramHref(contacts.telegram) : null,
    contacts?.whatsapp ? whatsappHref(contacts.whatsapp) : null,
  ].filter((url): url is string => Boolean(url));

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    ...(contacts?.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: contacts.address,
            addressCountry: "RU",
          },
        }
      : {}),
    ...(contacts?.phone ? { telephone: contacts.phone } : {}),
    ...(contacts?.email ? { email: contacts.email } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export function webSiteJsonLd(): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: "ru-RU",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export function breadcrumbsJsonLd(items: BreadcrumbItem[]): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      // Последняя крошка — текущая страница: item опускается (Google OK).
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

export function faqJsonLd(items: FaqItem[]): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: stripHtml(item.answerHtml),
      },
    })),
  };
}

export function newsArticleJsonLd(item: NewsItem): object {
  const url = absoluteUrl(`/novosti/${item.slug}`);
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "NewsArticle",
    headline: item.title,
    ...(item.excerpt ? { description: item.excerpt } : {}),
    ...(item.publishedAt ? { datePublished: item.publishedAt } : {}),
    ...(item.updatedAt || item.publishedAt
      ? { dateModified: item.updatedAt ?? item.publishedAt }
      : {}),
    ...(item.coverImageUrl ? { image: [absoluteUrl(item.coverImageUrl)] } : {}),
    mainEntityOfPage: url,
    author: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    inLanguage: "ru-RU",
  };
}

const OFFER_AVAILABILITY: Record<AvailabilityStatus, string> = {
  available: "https://schema.org/InStock",
  reserved: "https://schema.org/LimitedAvailability",
  sold: "https://schema.org/SoldOut",
};

export function floorplanJsonLd(floorplan: Floorplan, showOffer: boolean): object {
  const url = absoluteUrl(`/planirovki/${floorplan.slug}`);
  const additionalProperty = [
    {
      "@type": "PropertyValue",
      name: "Площадь",
      value: floorplan.areaM2,
      unitText: "м²",
    },
    ...(floorplan.floor !== null
      ? [{ "@type": "PropertyValue", name: "Этаж", value: floorplan.floor }]
      : []),
    ...(floorplan.ceilingHeight !== null
      ? [
          {
            "@type": "PropertyValue",
            name: "Потолки",
            value: floorplan.ceilingHeight,
            unitText: "м",
          },
        ]
      : []),
  ];

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Product",
    name: floorplan.title,
    ...(floorplan.descriptionHtml
      ? { description: stripHtml(floorplan.descriptionHtml) }
      : {}),
    ...(floorplan.imageUrl ? { image: [absoluteUrl(floorplan.imageUrl)] } : {}),
    sku: floorplan.slug,
    ...(floorplan.category ? { category: floorplan.category.title } : {}),
    additionalProperty,
    brand: { "@id": ORGANIZATION_ID },
    ...(showOffer && floorplan.price !== null
      ? {
          offers: {
            "@type": "Offer",
            price: floorplan.price,
            priceCurrency: "RUB",
            availability: OFFER_AVAILABILITY[floorplan.availability],
            url,
          },
        }
      : {}),
  };
}

export function itemListJsonLd(floorplans: Floorplan[], basePath: string): object {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "ItemList",
    itemListElement: floorplans.map((floorplan, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: floorplan.title,
      url: absoluteUrl(`${basePath}/${floorplan.slug}`),
    })),
  };
}
