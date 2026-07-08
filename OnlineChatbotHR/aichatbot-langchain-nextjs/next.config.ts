import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],

  // Build optimizations to prevent memory issues
  typescript: {
    // Skip type checking during build (we already check in dev)
    ignoreBuildErrors: true,
  },
  eslint: {
    // Skip ESLint during build
    ignoreDuringBuilds: true,
  },
  // Reduce build parallelism to save memory
  experimental: {
    // Use fewer workers
    webpackBuildWorker: false,
  },

  // เสิร์ฟรูปหลังอัปโหลดผ่าน Route Handler (อ่านไฟล์จากดิสก์) ก่อนตรวจ static ใน public
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/uploads/:path*", destination: "/api/public-upload/uploads/:path*" },
        { source: "/users/:path*", destination: "/api/public-upload/users/:path*" },
      ],
    }
  },

  images: {
    localPatterns: [
      { pathname: "/**" },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
    domains: ["localhost", "pub-4ba4abe950044991959557d0a6a0613b.r2.dev"],
  },
}

export default nextConfig
