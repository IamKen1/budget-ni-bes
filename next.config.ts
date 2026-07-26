import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Dynamic routes (e.g. /transactions) default to a 0s client cache, so
    // every tab switch re-fetches from Prisma even seconds after the last
    // visit. Mutations already call revalidatePath, so a short client cache
    // here trades a few seconds of staleness for much snappier nav.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
