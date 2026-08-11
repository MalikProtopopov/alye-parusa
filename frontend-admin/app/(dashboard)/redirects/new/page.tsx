"use client";

import ResourceForm from "../../../components/ResourceForm";
import { redirectsConfig } from "../../../lib/resources";

export default function Page() {
  return <ResourceForm config={redirectsConfig} />;
}
