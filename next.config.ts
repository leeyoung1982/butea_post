import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating "N" dev tools button — Butea has its own settings UI
  // in the rail bottom; the Next overlay just confuses users who think it's
  // part of the app.
  devIndicators: false,
};

export default nextConfig;
