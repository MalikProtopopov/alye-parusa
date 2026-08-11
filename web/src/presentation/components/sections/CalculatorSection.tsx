import type { Floorplan, InstallmentParams, SectionText } from "@/domain";
import { multiline } from "@/presentation/lib/multiline";
import { InstallmentCalculator } from "../calculator/InstallmentCalculator";
import type { CalculatorPlanOption } from "../calculator/InstallmentCalculator";
import { Container } from "../primitives/Container";
import { Section } from "../primitives/Section";
import { SectionHeading } from "../primitives/SectionHeading";

/** Server wrapper: narrows floorplans to serializable options for the client. */
export function CalculatorSection({
  params,
  floorplans,
  text,
  index,
  policyHref,
}: {
  params: InstallmentParams;
  floorplans: Floorplan[];
  text: SectionText;
  index?: string;
  policyHref?: string;
}) {
  const plans: CalculatorPlanOption[] = floorplans.map((floorplan) => ({
    id: floorplan.id,
    title: floorplan.title,
    areaM2: floorplan.areaM2,
    price: floorplan.price,
  }));

  return (
    <Section id="calculator" tone="elevated">
      <Container>
        <SectionHeading
          index={index}
          eyebrow={text.eyebrow}
          title={multiline(text.title)}
          lead={text.lead ?? "Беспроцентная рассрочка от застройщика — подберите комфортные условия."}
        />
        <InstallmentCalculator params={params} plans={plans} policyHref={policyHref} />
      </Container>
    </Section>
  );
}
