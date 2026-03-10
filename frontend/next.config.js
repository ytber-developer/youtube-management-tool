/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // API backend URL
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006',
  },
  // Enable standalone output for deployment
  output: 'standalone',
}

module.exports = nextConfig
