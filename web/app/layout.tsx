import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Manrope, Unbounded } from "next/font/google";

import "@/presentation/styles/tokens.css";
import "@/presentation/styles/globals.css";

import { content, publications, siteMeta } from "@/composition/container";
import { YandexMetrika } from "@/presentation/components/analytics/YandexMetrika";
import { CookieConsent } from "@/presentation/components/consent/CookieConsent";
import { ScrollProgress } from "@/presentation/components/layout/ScrollProgress";
import { SiteFooter } from "@/presentation/components/layout/SiteFooter";
import { SiteHeader } from "@/presentation/components/layout/SiteHeader";
import { SmoothScroll } from "@/presentation/components/layout/SmoothScroll";
import { JsonLd } from "@/presentation/components/seo/JsonLd";
import { SITE_NAME, SITE_URL } from "@/presentation/lib/site-url";
import {
  organizationJsonLd,
  webSiteJsonLd,
} from "@/presentation/lib/structured-data";
import {
  DEFAULT_OG_HEIGHT,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_WIDTH,
} from "@/presentation/lib/seo";

const display = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const DEFAULT_TITLE = "Алые Паруса — апарт-комплекс на первой линии Каспия";
const DEFAULT_DESCRIPTION =
  "Апарт-комплекс «Алые Паруса» на первой береговой линии Каспийского моря, Дагестан. 46 корпусов, апартаменты 22–79 м², аренда через УК, окупаемость от 3 лет.";

export async function generateMetadata(): Promise<Metadata> {
  const analytics = await siteMeta.analytics();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: DEFAULT_TITLE,
      template: `%s — ${SITE_NAME}`,
    },
    description: DEFAULT_DESCRIPTION,
    openGraph: {
      type: "website",
      locale: "ru_RU",
      siteName: SITE_NAME,
      url: "/",
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: DEFAULT_OG_WIDTH,
          height: DEFAULT_OG_HEIGHT,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [DEFAULT_OG_IMAGE],
    },
    verification: {
      ...(analytics.yandexVerification ? { yandex: analytics.yandexVerification } : {}),
      ...(analytics.googleVerification ? { google: analytics.googleVerification } : {}),
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#f3efe6",
  colorScheme: "light",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [contact, { project }, heroExperience, contacts, policy, analytics] =
    await Promise.all([
      content.contact(),
      content.projectOverview(),
      content.heroExperience(),
      siteMeta.contacts(),
      publications.policy(),
      siteMeta.analytics(),
    ]);
  return (
    <html lang="ru" className={`${display.variable} ${sans.variable}`}>
      <body>
        <JsonLd data={organizationJsonLd(contacts)} />
        <JsonLd data={webSiteJsonLd()} />
          <SmoothScroll>
            <ScrollProgress />
            <SiteHeader
              brand={project.wordmark}
              contacts={
                contacts
                  ? {
                      phone: contacts.phone,
                      whatsapp: contacts.whatsapp,
                      telegram: contacts.telegram,
                    }
                  : null
              }
            />
            {children}
            <SiteFooter
              wordmark={project.wordmark}
              tagline={project.tagline}
              brands={contact.brands}
              location={contact.location}
              cadastralNumber={contact.cadastralNumber}
              contacts={contacts}
              policy={policy ? { title: policy.title, slug: policy.slug } : null}
            />
          </SmoothScroll>
        <CookieConsent
          policyHref={policy ? `/dokumenty/${policy.slug}` : "/dokumenty"}
        />
        <YandexMetrika id={analytics.metrikaId} />
      </body>
    </html>
  );
}
