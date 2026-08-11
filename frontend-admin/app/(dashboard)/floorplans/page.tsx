"use client";

import ResourceList from "../../components/ResourceList";
import { floorplansListConfig } from "../../lib/resources";

export default function FloorplansPage() {
  return <ResourceList config={floorplansListConfig} />;
}
