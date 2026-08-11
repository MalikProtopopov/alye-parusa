"use client";

import ResourceForm from "../../../components/ResourceForm";
import { planCategoriesConfig } from "../../../lib/resources";

export default function Page() {
  return <ResourceForm config={planCategoriesConfig} />;
}
