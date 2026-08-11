"use client";

import Link from "next/link";
import ResourceList from "../../components/ResourceList";
import { seoConfig } from "../../lib/resources";
import { useKnownPaths } from "../../lib/useKnownPaths";

// Сворачиваемая панель «Страницы без SEO»: known-paths с has_seo=false →
// ссылки на /seo/new?slug=… (префилл через проп initial формы).
function PagesWithoutSeo() {
  const known = useKnownPaths();
  if (!known) return null;
  const missing = known.filter((p) => !p.has_seo);
  if (missing.length === 0) return null;
  return (
    <details className="card seo-missing">
      <summary>
        Страницы без SEO — {missing.length}
        <span className="muted"> (нажмите, чтобы раскрыть)</span>
      </summary>
      <ul className="seo-missing-list">
        {missing.map((p) => (
          <li key={p.path}>
            <Link href={`/seo/new?slug=${encodeURIComponent(p.path)}`}>
              {p.label}
            </Link>{" "}
            <span className="mono muted">{p.path}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function Page() {
  return (
    <div>
      <PagesWithoutSeo />
      <ResourceList config={seoConfig} />
    </div>
  );
}
