import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache la pastille « N » de Next.js en bas de l'écran en développement (elle n'existe pas en production).
  devIndicators: false,
};

export default nextConfig;
