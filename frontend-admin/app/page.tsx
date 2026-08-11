"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "./lib/api";

// Корневой маршрут: сразу уводим в раздел заявок либо на вход.
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getToken() ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div style={{ padding: 40, color: "var(--ink-45)" }}>Загрузка…</div>
  );
}
