"use client";

import ResourceList from "../../components/ResourceList";
import { faqConfig } from "../../lib/resources";

export default function Page() {
  return <ResourceList config={faqConfig} />;
}
