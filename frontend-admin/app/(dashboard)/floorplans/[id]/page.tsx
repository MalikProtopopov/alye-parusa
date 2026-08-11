"use client";

import { useParams } from "next/navigation";
import FloorplanForm from "../FloorplanForm";

export default function EditFloorplanPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <FloorplanForm id={id} />;
}
