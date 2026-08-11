// Слаги: RU-транслитерация — точное зеркало backend/app/slug.py.
// Один алгоритм на клиенте и сервере: авто-слаг в форме совпадает с тем,
// что сгенерировал бы бэкенд.

const RU_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e",
  ж: "zh", з: "z", и: "i", й: "j", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** «Проектная декларация» → "proektnaya-deklaraciya". Пустой вход → "". */
export function slugify(title: string): string {
  const lower = (title || "").toLowerCase();
  let out = "";
  for (const ch of lower) {
    out += ch in RU_MAP ? RU_MAP[ch] : ch;
  }
  return out.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Валидный слаг: латиница, цифры, дефис. */
export const SLUG_RE = /^[a-z0-9-]+$/;
