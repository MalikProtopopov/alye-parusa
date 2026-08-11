"use client";

import ResourceForm from "../../../components/ResourceForm";
import { newsConfig } from "../../../lib/resources";

export default function Page() {
  return <ResourceForm config={newsConfig} />;
}
