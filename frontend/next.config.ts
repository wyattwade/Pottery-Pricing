import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/Pottery-Pricing',
  env: {
    NEXT_PUBLIC_BASE_PATH: '/Pottery-Pricing',
  },
  images: { unoptimized: true }
};

export default nextConfig;
