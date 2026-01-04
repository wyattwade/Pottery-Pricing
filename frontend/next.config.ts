import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';
const repoName = '/Pottery-Pricing';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: isProd ? repoName : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: isProd ? repoName : '',
  },
  images: { unoptimized: true }
};

export default nextConfig;
