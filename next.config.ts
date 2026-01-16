import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
    webpack: (config) => {
        return config; // ensures Webpack is used (not Turbopack)
          },
          };

          export default nextConfig;
          