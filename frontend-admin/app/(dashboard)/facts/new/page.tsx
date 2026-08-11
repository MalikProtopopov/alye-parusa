"use client";

import ResourceForm from "../../../components/ResourceForm";
import { factsConfig } from "../../../lib/resources";

export default function Page() {
  return <ResourceForm config={factsConfig} />;
}
