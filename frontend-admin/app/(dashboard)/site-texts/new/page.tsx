"use client";

import ResourceForm from "../../../components/ResourceForm";
import { useSiteTextsFormConfig } from "../useSiteTextsFormConfig";

export default function Page() {
  // Ждём занятость ключей: форма создания монтируется сразу с первой
  // свободной секцией в селекте, а не с занятой disabled-опцией.
  const { config, ready } = useSiteTextsFormConfig();
  if (!ready) {
    return (
      <div className="row-gap" style={{ color: "var(--ink-45)" }}>
        <span className="spin" /> Загрузка…
      </div>
    );
  }
  return <ResourceForm config={config} />;
}
