import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "qmeruxblmhxvrftdbyke.supabase.co" }],
  },
  turbopack: {},
};

export default nextConfig;
