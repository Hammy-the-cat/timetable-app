import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/timetable-app',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  // @ts-ignore
  eslint: {
    ignoreDuringBuilds: true,
  },
  // @ts-ignore
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
