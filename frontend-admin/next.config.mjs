/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Линтер не должен блокировать production-сборку админки.
  eslint: { ignoreDuringBuilds: true },
  // Значок сборки Next в dev садится в левый нижний угол — ровно поверх
  // ссылки «Открыть сайт ↗» в сайдбаре, и её нельзя нажать.
  devIndicators: false,
};

export default nextConfig;
