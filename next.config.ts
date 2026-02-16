import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "inaturalist-open-data.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "static.inaturalist.org",
      },
      {
        protocol: "https",
        hostname: "api.gbif.org",
      },
      {
        protocol: "https",
        hostname: "rs.gbif.org",
      },
      {
        protocol: "https",
        hostname: "images.gbif.org",
      },
    ],
  },
};

export default nextConfig;
