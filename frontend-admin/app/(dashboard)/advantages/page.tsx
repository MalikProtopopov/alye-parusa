"use client";

import ResourceList from "../../components/ResourceList";
import { advantagesConfig } from "../../lib/resources";

export default function Page() {
  return <ResourceList config={advantagesConfig} />;
}
