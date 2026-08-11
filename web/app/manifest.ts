import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/presentation/lib/site-url";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description:
      "Апарт-комплекс «Алые Паруса» на первой береговой линии Каспийского моря.",
    lang: "ru",
    start_url: "/",
    display: "browser",
    theme_color: "#f3efe6",
    background_color: "#f3efe6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
