"use client";

import { useParams } from "next/navigation";
import ResourceForm from "../../../components/ResourceForm";
import { documentsConfig } from "../../../lib/resources";

export default function Page() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <ResourceForm config={documentsConfig} id={id} />;
}
