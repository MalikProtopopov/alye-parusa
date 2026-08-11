// Server-side API origin: SSR fetches and the /cms-media rewrite target.
const apiUrl =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://backend:8000";
// Browser-side API origin — CMS media may be linked absolutely against it.
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Build next/image remotePatterns for every distinct API origin. */
function remotePatterns() {
  const origins = new Set();
  for (const url of [apiUrl, publicApiUrl, "http://backend:8000"]) {
    try {
      origins.add(new URL(url).origin);
    } catch {
      /* ignore malformed env values */
    }
  }
  return [...origins].map((origin) => {
    const { protocol, hostname, port } = new URL(origin);
    return {
      protocol: protocol.replace(":", ""),
      hostname,
      ...(port ? { port } : {}),
      pathname: "/media/**",
    };
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for a minimal Docker runtime image.
  output: "standalone",
  reactStrictMode: true,
  // Значок сборки Next в dev садится в левый нижний угол страницы
  // и попадает в скриншоты. В продакшене его нет — выключаем и в dev.
  devIndicators: false,
  poweredByHeader: false,
  // Lint is enforced via `npm run lint` / CI, not the container build, so an
  // isolated Docker build can never fail on a style rule.
  eslint: { ignoreDuringBuilds: true },
  // Type errors DO fail the build — the domain contracts must hold.
  typescript: { ignoreBuildErrors: false },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: remotePatterns(),
  },
  // CMS uploads are proxied through the site's own origin so next/image and
  // plain <img> work identically in dev, Docker and production.
  async rewrites() {
    return [
      {
        source: "/cms-media/:path*",
        destination: `${apiUrl}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
