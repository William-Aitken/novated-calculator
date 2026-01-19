import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // experimental: {},
  output: 'export', // Enable static export
  images: { unoptimized: true }, // If you use next/image
  // basePath: '/novated-calculator', // Uncomment if deploying to a subpath
};

export default nextConfig;