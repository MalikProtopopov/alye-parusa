import type { Brand, GeoLocation } from "@/domain";
import type { ContentRepository } from "../ports/content-repository";

export interface ContactView {
  brands: Brand[];
  location: GeoLocation;
  cadastralNumber: string;
}

export async function getContact(repo: ContentRepository): Promise<ContactView> {
  const [brands, project] = await Promise.all([repo.getBrands(), repo.getProject()]);
  return {
    brands,
    location: project.location,
    cadastralNumber: project.cadastralNumber,
  };
}
