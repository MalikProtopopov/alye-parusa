import type { InvestmentMetric } from "@/domain";
import type { ContentRepository } from "../ports/content-repository";

export interface InvestmentCaseView {
  metrics: InvestmentMetric[];
  narrative: string[];
}

export async function getInvestmentCase(
  repo: ContentRepository,
): Promise<InvestmentCaseView> {
  const [metrics, narrative] = await Promise.all([
    repo.getInvestmentMetrics(),
    repo.getInvestmentNarrative(),
  ]);
  return { metrics, narrative };
}
