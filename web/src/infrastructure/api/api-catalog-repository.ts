import type { CatalogRepository } from "@/application";
import type { Floorplan, InstallmentParams, PlanCategory } from "@/domain";

import { apiFetch } from "./api-client";
import type { CalculatorParamsDto, FloorplanDto, PlanCategoryDto } from "./dto";
import {
  activeSorted,
  calculatorParamsFromDto,
  floorplanFromDto,
  planCategoryFromDto,
} from "./mappers";

const FLOORPLANS = { revalidate: 60, tags: ["floorplans"] };
const META = { revalidate: 300, tags: ["meta"] };

/** CMS catalog adapter. Lists never throw (dead backend → empty results and
 *  soft empty states); the slug lookup propagates ApiUnavailableError. */
export class ApiCatalogRepository implements CatalogRepository {
  async listCategories(): Promise<PlanCategory[]> {
    try {
      const rows = await apiFetch<PlanCategoryDto[]>("/plan-categories", FLOORPLANS);
      if (!rows) return [];
      return activeSorted(rows).map(planCategoryFromDto);
    } catch {
      return [];
    }
  }

  async listFloorplans(categorySlug?: string): Promise<Floorplan[]> {
    try {
      const rows = await apiFetch<FloorplanDto[]>("/floorplans", {
        ...FLOORPLANS,
        searchParams: categorySlug ? { category: categorySlug } : undefined,
      });
      // null = 404 category_not_found for an unknown slug → empty catalog.
      if (!rows) return [];
      return activeSorted(rows).map(floorplanFromDto);
    } catch {
      return [];
    }
  }

  /** 404 → null (честный notFound); сеть/5xx пробрасываются (ApiUnavailableError). */
  async getFloorplanBySlug(slug: string): Promise<Floorplan | null> {
    const row = await apiFetch<FloorplanDto>(
      `/floorplans/${encodeURIComponent(slug)}`,
      FLOORPLANS,
    );
    return row ? floorplanFromDto(row) : null;
  }

  async getCalculatorParams(): Promise<InstallmentParams | null> {
    try {
      const dto = await apiFetch<CalculatorParamsDto>("/calculator", META);
      return dto ? calculatorParamsFromDto(dto) : null;
    } catch {
      return null;
    }
  }
}
