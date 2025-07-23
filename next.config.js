/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  distDir: '.next',
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;