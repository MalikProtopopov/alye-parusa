"use client";

import ResourceForm from "../../../components/ResourceForm";
import { partnersConfig } from "../../../lib/resources";

export default function Page() {
  return <ResourceForm config={partnersConfig} />;
}
