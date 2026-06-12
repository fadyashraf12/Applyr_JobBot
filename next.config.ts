// @ts-nocheck
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Configures heavy packages as external so they are resolved correctly in serverless functions
  serverExternalPackages: ['mammoth', 'pdf-parse'],
  reactStrictMode: true,
  /* Other production deployment settings if needed */
};

export default nextConfig;
