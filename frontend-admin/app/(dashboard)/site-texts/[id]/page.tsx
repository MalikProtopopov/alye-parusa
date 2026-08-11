"use client";

import { useParams } from "next/navigation";
import ResourceForm from "../../../components/ResourceForm";
import { useSiteTextsFormConfig } from "../useSiteTextsFormConfig";

export default function Page() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { config } = useSiteTextsFormConfig(id);
  return <ResourceForm config={config} id={id} />;
}
