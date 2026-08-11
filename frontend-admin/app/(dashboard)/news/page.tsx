"use client";

import ResourceList from "../../components/ResourceList";
import { newsConfig } from "../../lib/resources";

export default function Page() {
  return <ResourceList config={newsConfig} />;
}
