import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Suppress ESLint rule violations during production compilation
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Suppress TypeScript warnings/errors during production builds
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
