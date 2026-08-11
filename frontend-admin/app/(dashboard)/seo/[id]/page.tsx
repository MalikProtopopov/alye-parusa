"use client";

import { useParams } from "next/navigation";
import ResourceForm from "../../../components/ResourceForm";
import { seoConfig } from "../../../lib/resources";
import SerpPreview from "../SerpPreview";

export default function Page() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return (
    <ResourceForm
      config={seoConfig}
      id={id}
      aside={(form) => <SerpPreview form={form} />}
    />
  );
}
