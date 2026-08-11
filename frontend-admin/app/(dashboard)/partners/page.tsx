"use client";

import ResourceList from "../../components/ResourceList";
import { partnersConfig } from "../../lib/resources";

export default function Page() {
  return <ResourceList config={partnersConfig} />;
}
