import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['node:sqlite'],
  outputFileTracingIncludes: { '/*': ['./.demo/casting.sqlite'] },
};

export default nextConfig;
