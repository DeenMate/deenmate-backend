import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for serving via NestJS
  output: 'export',
  trailingSlash: true,
  distDir: 'dist',
  assetPrefix: '/admin',
  
  // Disable ESLint during build for POC
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript checking during build for POC
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Configure webpack for better integration
  webpack: (config, { isServer }) => {
    // Handle Node.js modules in client-side code
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    
    return config;
  },
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/v4',
  },
};

export default nextConfig;
