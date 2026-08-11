"use client";

import ResourceForm from "../../../components/ResourceForm";
import { advantagesConfig } from "../../../lib/resources";

export default function Page() {
  return <ResourceForm config={advantagesConfig} />;
}
