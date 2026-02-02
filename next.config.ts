import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // experimental: {},
  // Remove `output: 'export'` to allow server-side routes/api to run on Vercel.
  // Static export disables Next.js server functions and causes API routes to return 405.
  images: { unoptimized: true }, // If you use next/image
  // basePath: '/novated-calculator', // Uncomment if deploying to a subpath
};

export default nextConfig;