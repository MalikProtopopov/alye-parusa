"use client";

import { useEffect, useState } from "react";
import ResourceForm from "../../../components/ResourceForm";
import { seoConfig } from "../../../lib/resources";
import SerpPreview from "../SerpPreview";

export default function Page() {
  // ?slug=… из панели «Страницы без SEO» — префилл поля «Страница».
  // Читаем на маунте (window.location, без useSearchParams —
  // не требует Suspense-обёртки при сборке).
  const [initial, setInitial] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug");
    setInitial(slug ? { slug } : {});
  }, []);

  if (initial === null) {
    return (
      <div className="row-gap" style={{ color: "var(--ink-45)" }}>
        <span className="spin" /> Загрузка…
      </div>
    );
  }

  return (
    <ResourceForm
      config={seoConfig}
      initial={initial}
      aside={(form) => <SerpPreview form={form} />}
    />
  );
}
