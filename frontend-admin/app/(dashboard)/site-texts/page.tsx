"use client";

import ResourceList from "../../components/ResourceList";
import { siteTextsConfig } from "../../lib/resources";

export default function Page() {
  return <ResourceList config={siteTextsConfig} />;
}
