"use client";

import ResourceForm from "../../../components/ResourceForm";
import { heroChaptersConfig } from "../../../lib/resources";

export default function Page() {
  return <ResourceForm config={heroChaptersConfig} />;
}
