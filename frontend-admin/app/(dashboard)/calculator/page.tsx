"use client";

import ResourceForm from "../../components/ResourceForm";
import { calculatorConfig } from "../../lib/resources";
import InstallmentPreview from "./InstallmentPreview";

export default function Page() {
  return (
    <ResourceForm
      config={calculatorConfig}
      aside={(form) => <InstallmentPreview form={form} />}
    />
  );
}
