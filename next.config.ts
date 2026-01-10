import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/timetable-app',
  assetPrefix: '/timetable-app',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
