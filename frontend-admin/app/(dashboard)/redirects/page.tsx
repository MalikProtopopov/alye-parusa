"use client";

import ResourceList from "../../components/ResourceList";
import { redirectsConfig } from "../../lib/resources";

export default function Page() {
  return <ResourceList config={redirectsConfig} />;
}
