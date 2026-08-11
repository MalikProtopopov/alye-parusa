"use client";

import ResourceList from "../../components/ResourceList";
import { teamConfig } from "../../lib/resources";

export default function Page() {
  return <ResourceList config={teamConfig} />;
}
