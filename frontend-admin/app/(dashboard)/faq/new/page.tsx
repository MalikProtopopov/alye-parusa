"use client";

import ResourceForm from "../../../components/ResourceForm";
import { faqConfig } from "../../../lib/resources";

export default function Page() {
  return <ResourceForm config={faqConfig} />;
}
