"use client";

import ResourceList from "../../components/ResourceList";
import { factsConfig } from "../../lib/resources";

export default function Page() {
  return <ResourceList config={factsConfig} />;
}
