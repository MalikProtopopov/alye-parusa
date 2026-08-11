import type { Metadata } from "next";
import { catalog, content, publications, siteMeta } from "@/composition/container";
import { buildPageMetadata } from "@/presentation/lib/seo";
import { Hero } from "@/presentation/components/hero/Hero";
import { Advantages } from "@/presentation/components/sections/Advantages";
import { CallToActionSection } from "@/presentation/components/sections/CallToActionSection";
import { CalculatorSection } from "@/presentation/components/sections/CalculatorSection";
import { FactBand } from "@/presentation/components/sections/FactBand";
import { FaqSection } from "@/presentation/components/sections/FaqSection";
import { FloorplansSection } from "@/presentation/components/sections/FloorplansSection";
import { Interlude } from "@/presentation/components/sections/Interlude";
import { InfrastructureSection } from "@/presentation/components/sections/InfrastructureSection";
import { InvestmentSection } from "@/presentation/components/sections/InvestmentSection";
import { LocationSection } from "@/presentation/components/sections/LocationSection";
import { NewsSection } from "@/presentation/components/sections/NewsSection";
import { PartnersSection } from "@/presentation/components/sections/PartnersSection";
import { ResidencesSection } from "@/presentation/components/sections/ResidencesSection";
import { ScrollStory } from "@/presentation/components/sections/ScrollStory";
import { TeamSection } from "@/presentation/components/sections/TeamSection";
import { JsonLd } from "@/presentation/components/seo/JsonLd";
import { faqJsonLd } from "@/presentation/lib/structured-data";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    slug: "/",
    // Главная — тот же сегмент, что и layout: title.template к ней не
    // применяется (поведение Next), поэтому полный бренд-заголовок целиком.
    fallbackTitle: "Алые Паруса — апарт-комплекс на первой линии Каспия",
    fallbackDescription:
      "Апарт-комплекс «Алые Паруса» на первой береговой линии Каспийского моря, Дагестан. 46 корпусов, апартаменты 22–79 м², аренда через УК, окупаемость от 3 лет.",
    canonicalPath: "/",
  });
}

export default async function HomePage() {
  const [
    experience,
    overview,
    story,
    infrastructure,
    residences,
    investment,
    contact,
    trustSignals,
    proximity,
    scrollStory,
  ] = await Promise.all([
    content.heroExperience(),
    content.projectOverview(),
    content.locationStory(),
    content.infrastructure(),
    content.residences(),
    content.investmentCase(),
    content.contact(),
    content.trustSignals(),
    content.proximity(),
    content.scrollStory(),
  ]);

  const [features, featured, calcParams, news, team, faq, partners, policy] =
    await Promise.all([
      siteMeta.features(),
      catalog.featured(6),
      catalog.calculatorParams(),
      publications.news(),
      publications.team(),
      publications.faq(),
      publications.partners(),
      publications.policy(),
    ]);

  const [
    aboutText,
    trustText,
    locationText,
    nearbyText,
    infrastructureText,
    scrollStoryText,
    residencesText,
    floorplansText,
    calculatorText,
    investmentText,
    newsText,
    teamText,
    faqText,
    partnersText,
    ctaText,
  ] = await Promise.all([
    content.sectionText("about"),
    content.sectionText("trust_band"),
    content.sectionText("location"),
    content.sectionText("nearby_band"),
    content.sectionText("infrastructure"),
    content.sectionText("scroll_story"),
    content.sectionText("residences"),
    content.sectionText("floorplans"),
    content.sectionText("calculator"),
    content.sectionText("investment"),
    content.sectionText("news"),
    content.sectionText("team"),
    content.sectionText("faq"),
    content.sectionText("partners"),
    content.sectionText("cta"),
  ]);

  const policyHref = policy ? `/dokumenty/${policy.slug}` : "/dokumenty";
  const showFloorplans = featured.length > 0;
  const showCalculator = features.calculator && calcParams !== null;
  const showNews = features.news && news.length > 0;
  const showTeam = features.team && team.length > 0;
  const showFaq = features.faq && faq.length > 0;
  const showPartners = features.partners && partners.length > 0;

  // Фолио-нумерация — только у «глав» проекта (О комплексе, Локация,
  // Инфраструктура, Апартаменты, Инвестиции). Служебные разделы идут без
  // номера: одиннадцать пронумерованных секций подряд читались как шаблон,
  // а «11» у формы заявки выглядела опечаткой.
  let sheet = 0;
  const folio = () => String(++sheet).padStart(2, "0");

  return (
    <main>
      {showFaq ? <JsonLd data={faqJsonLd(faq)} /> : null}
      <Hero experience={experience} />
      <Advantages overview={overview} text={aboutText} index={folio()} />
      <FactBand chips={trustSignals} label={trustText.title} />
      <LocationSection story={story} text={locationText} index={folio()} />
      <FactBand chips={proximity} label={nearbyText.title} tone="sand" />
      <InfrastructureSection
        data={infrastructure}
        text={infrastructureText}
        index={folio()}
      />
      <ScrollStory
        story={{
          ...scrollStory,
          eyebrow: scrollStoryText.eyebrow ?? scrollStory.eyebrow,
        }}
      />
      <ResidencesSection data={residences} text={residencesText} index={folio()} />
      <Interlude
        image="/media/renders/alley.jpg"
        alt="Центральная аллея квартала, ведущая к морю"
        eyebrow="750 метров до воды"
      >
        Аллея начинается у дома и заканчивается морем.
      </Interlude>
      {showFloorplans ? (
        <FloorplansSection floorplans={featured} text={floorplansText} />
      ) : null}
      {showCalculator && calcParams ? (
        <CalculatorSection
          params={calcParams}
          floorplans={featured}
          text={calculatorText}
          policyHref={policyHref}
        />
      ) : null}
      <Interlude
        image="/media/renders/fishing-pier.jpg"
        alt="Пирс на закате"
        eyebrow="Первая линия"
        align="right"
      >
        Вечером здесь считают не метры, а закаты.
      </Interlude>
      <InvestmentSection data={investment} text={investmentText} index={folio()} />
      {showNews ? <NewsSection items={news} text={newsText} /> : null}
      {showTeam ? <TeamSection members={team} text={teamText} /> : null}
      {showFaq ? <FaqSection items={faq} text={faqText} /> : null}
      {showPartners ? (
        <PartnersSection partners={partners} text={partnersText} />
      ) : null}
      <CallToActionSection
        contact={contact}
        text={ctaText}
        policyHref={policyHref}
      />
    </main>
  );
}
