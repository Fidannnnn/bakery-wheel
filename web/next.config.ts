// web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ✅ don't fail the build on ESLint errors
  },
  // If type errors ever block builds, you can temporarily enable:
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
