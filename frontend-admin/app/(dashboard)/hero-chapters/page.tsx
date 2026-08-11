"use client";

import ResourceList from "../../components/ResourceList";
import { heroChaptersConfig } from "../../lib/resources";

export default function Page() {
  return <ResourceList config={heroChaptersConfig} />;
}
