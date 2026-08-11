/** CMS-managed contacts + requisites. Every field may be unfilled — the
 *  presentation must degrade gracefully (e.g. no phone in the seed yet). */
export interface SiteContacts {
  phone: string | null;
  email: string | null;
  telegram: string | null;
  whatsapp: string | null;
  address: string | null;
  workHours: string | null;
  mapEmbed: string | null;
  inn: string | null;
  ogrn: string | null;
  cadastralNumber: string | null;
}
