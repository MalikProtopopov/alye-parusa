"use client";

import ResourceForm from "../../../components/ResourceForm";
import { documentsConfig } from "../../../lib/resources";

export default function Page() {
  return <ResourceForm config={documentsConfig} />;
}
