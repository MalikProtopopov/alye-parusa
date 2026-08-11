import type { FaqItem, NewsItem, Partner, SiteDocument, TeamMember } from "@/domain";
import type { PublicationsRepository } from "../ports/publications-repository";

export async function getNewsList(repo: PublicationsRepository): Promise<NewsItem[]> {
  return repo.listNews();
}

export async function getNewsItem(
  repo: PublicationsRepository,
  slug: string,
): Promise<NewsItem | null> {
  return repo.getNewsBySlug(slug);
}

export async function getDocumentsList(
  repo: PublicationsRepository,
): Promise<SiteDocument[]> {
  return repo.listDocuments();
}

export async function getDocumentItem(
  repo: PublicationsRepository,
  slug: string,
): Promise<SiteDocument | null> {
  return repo.getDocumentBySlug(slug);
}

export async function getPolicyDocument(
  repo: PublicationsRepository,
): Promise<SiteDocument | null> {
  return repo.getPolicyDocument();
}

export async function getFaqList(repo: PublicationsRepository): Promise<FaqItem[]> {
  return repo.listFaq();
}

export async function getTeamList(repo: PublicationsRepository): Promise<TeamMember[]> {
  return repo.listTeam();
}

export async function getPartnersList(repo: PublicationsRepository): Promise<Partner[]> {
  return repo.listPartners();
}
