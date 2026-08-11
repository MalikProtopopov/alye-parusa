"use client";

import ResourceForm from "../../../components/ResourceForm";
import { teamConfig } from "../../../lib/resources";

export default function Page() {
  return <ResourceForm config={teamConfig} />;
}
