import { describe, expect, it } from "vitest";
import type { Floorplan, SiteContacts } from "@/domain";
import {
  ORGANIZATION_ID,
  breadcrumbsJsonLd,
  faqJsonLd,
  floorplanJsonLd,
  itemListJsonLd,
  newsArticleJsonLd,
  organizationJsonLd,
  webSiteJsonLd,
} from "@/presentation/lib/structured-data";
import { SITE_URL } from "@/presentation/lib/site-url";

const CONTACTS: SiteContacts = {
  phone: "+7 999 123-45-67",
  email: "sales@example.com",
  telegram: "@alyeparusa",
  whatsapp: "79991234567",
  address: "Дагестан, Каспийское побережье",
  workHours: null,
  mapEmbed: null,
  inn: null,
  ogrn: null,
  cadastralNumber: null,
};

function makeFloorplan(overrides: Partial<Floorplan> = {}): Floorplan {
  return {
    id: "fp-1",
    title: "Студия 22",
    slug: "studiya-22",
    descriptionHtml: "<p>Компактная <b>студия</b> у моря</p>",
    areaM2: 22.4,
    price: 3_500_000,
    availability: "available",
    floor: 3,
    ceilingHeight: 3,
    imageUrl: "/cms-media/uploads/plan.jpg",
    category: {
      id: "cat-1",
      title: "Студии",
      slug: "studii",
    },
    updatedAt: "2026-08-01T10:00:00Z",
    ...overrides,
  };
}

describe("organizationJsonLd", () => {
  it("полный вариант: адрес, телефон, email, sameAs-ссылки", () => {
    const data = organizationJsonLd(CONTACTS) as Record<string, unknown>;
    expect(data["@id"]).toBe(ORGANIZATION_ID);
    expect(data.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: CONTACTS.address,
      addressCountry: "RU",
    });
    expect(data.telephone).toBe(CONTACTS.phone);
    expect(data.email).toBe(CONTACTS.email);
    expect(data.sameAs).toEqual([
      "https://t.me/alyeparusa",
      "https://wa.me/79991234567",
    ]);
  });

  it("без контактов опциональные поля отсутствуют", () => {
    const data = organizationJsonLd(null) as Record<string, unknown>;
    expect(data.name).toBe("Алые Паруса");
    expect(data).not.toHaveProperty("address");
    expect(data).not.toHaveProperty("telephone");
    expect(data).not.toHaveProperty("email");
    expect(data).not.toHaveProperty("sameAs");
  });
});

describe("webSiteJsonLd", () => {
  it("ссылается на организацию как издателя", () => {
    const data = webSiteJsonLd() as Record<string, unknown>;
    expect(data["@type"]).toBe("WebSite");
    expect(data.publisher).toEqual({ "@id": ORGANIZATION_ID });
  });
});

describe("breadcrumbsJsonLd", () => {
  it("нумерует позиции с 1 и не даёт item последней крошке", () => {
    const data = breadcrumbsJsonLd([
      { label: "Главная", href: "/" },
      { label: "Новости", href: "/novosti" },
      { label: "Запуск продаж" },
    ]) as { itemListElement: Array<Record<string, unknown>> };

    expect(data.itemListElement).toHaveLength(3);
    expect(data.itemListElement[0].position).toBe(1);
    expect(data.itemListElement[0].item).toBe(`${SITE_URL}/`);
    expect(data.itemListElement[1].position).toBe(2);
    expect(data.itemListElement[1].item).toBe(`${SITE_URL}/novosti`);
    expect(data.itemListElement[2].position).toBe(3);
    expect(data.itemListElement[2].name).toBe("Запуск продаж");
    expect(data.itemListElement[2]).not.toHaveProperty("item");
  });
});

describe("faqJsonLd", () => {
  it("вычищает HTML из ответов", () => {
    const data = faqJsonLd([
      { id: "1", question: "Как купить?", answerHtml: "<p>Оставьте <b>заявку</b></p>" },
    ]) as { mainEntity: Array<{ acceptedAnswer: { text: string } }> };
    expect(data.mainEntity[0].acceptedAnswer.text).toBe("Оставьте заявку");
  });
});

describe("newsArticleJsonLd", () => {
  it("собирает даты, обложку и издателя", () => {
    const data = newsArticleJsonLd({
      id: "n1",
      title: "Запуск продаж",
      slug: "zapusk-prodazh",
      excerpt: "Старт продаж первой очереди",
      bodyHtml: "<p>Текст</p>",
      coverImageUrl: "/cms-media/uploads/cover.jpg",
      publishedAt: "2026-07-01T09:00:00Z",
      updatedAt: "2026-07-15T09:00:00Z",
    }) as Record<string, unknown>;

    expect(data.headline).toBe("Запуск продаж");
    expect(data.datePublished).toBe("2026-07-01T09:00:00Z");
    expect(data.dateModified).toBe("2026-07-15T09:00:00Z");
    expect(data.image).toEqual([`${SITE_URL}/cms-media/uploads/cover.jpg`]);
    expect(data.mainEntityOfPage).toBe(`${SITE_URL}/novosti/zapusk-prodazh`);
    expect(data.publisher).toEqual({ "@id": ORGANIZATION_ID });
  });
});

describe("floorplanJsonLd", () => {
  it("Product с Offer при showOffer и цене; статус мапится в availability", () => {
    const data = floorplanJsonLd(makeFloorplan(), true) as Record<string, unknown>;
    expect(data["@type"]).toBe("Product");
    expect(data.sku).toBe("studiya-22");
    expect(data.category).toBe("Студии");
    expect(data.description).toBe("Компактная студия у моря");
    expect(data.brand).toEqual({ "@id": ORGANIZATION_ID });
    expect(data.offers).toEqual({
      "@type": "Offer",
      price: 3_500_000,
      priceCurrency: "RUB",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/planirovki/studiya-22`,
    });
  });

  it("статусы reserved/sold → LimitedAvailability/SoldOut", () => {
    const reserved = floorplanJsonLd(makeFloorplan({ availability: "reserved" }), true) as {
      offers: { availability: string };
    };
    const sold = floorplanJsonLd(makeFloorplan({ availability: "sold" }), true) as {
      offers: { availability: string };
    };
    expect(reserved.offers.availability).toBe("https://schema.org/LimitedAvailability");
    expect(sold.offers.availability).toBe("https://schema.org/SoldOut");
  });

  it("без цены или без showOffer — Offer отсутствует («цена по запросу»)", () => {
    expect(floorplanJsonLd(makeFloorplan({ price: null }), true)).not.toHaveProperty(
      "offers",
    );
    expect(floorplanJsonLd(makeFloorplan(), false)).not.toHaveProperty("offers");
  });

  it("additionalProperty: площадь всегда, этаж/потолки по наличию", () => {
    const full = floorplanJsonLd(makeFloorplan(), true) as {
      additionalProperty: Array<{ name: string }>;
    };
    expect(full.additionalProperty.map((p) => p.name)).toEqual([
      "Площадь",
      "Этаж",
      "Потолки",
    ]);

    const bare = floorplanJsonLd(
      makeFloorplan({ floor: null, ceilingHeight: null }),
      true,
    ) as { additionalProperty: Array<{ name: string }> };
    expect(bare.additionalProperty.map((p) => p.name)).toEqual(["Площадь"]);
  });
});

describe("itemListJsonLd", () => {
  it("нумерует планировки и строит абсолютные URL", () => {
    const data = itemListJsonLd(
      [makeFloorplan(), makeFloorplan({ slug: "lux-79", title: "Люкс 79" })],
      "/planirovki",
    ) as { itemListElement: Array<Record<string, unknown>> };

    expect(data.itemListElement).toHaveLength(2);
    expect(data.itemListElement[0].position).toBe(1);
    expect(data.itemListElement[1].url).toBe(`${SITE_URL}/planirovki/lux-79`);
  });
});
