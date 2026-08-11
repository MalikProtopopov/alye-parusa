"use client";

import ResourceList from "../../components/ResourceList";
import { planCategoriesConfig } from "../../lib/resources";

export default function Page() {
  return <ResourceList config={planCategoriesConfig} />;
}
