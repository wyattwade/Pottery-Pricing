import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/Pottery-Pricing',
  images: { unoptimized: true }
};

export default nextConfig;
