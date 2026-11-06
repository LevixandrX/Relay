import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // A 20 MiB asset is ~27 MiB as JSON/base64; routes still enforce their own limits.
  experimental: { proxyClientMaxBodySize: '32mb' },
  turbopack: {
    root: path.join(__dirname),
  },
  transpilePackages: ["@quickdrawjs/react", "@quickdrawjs/core"],
};

export default withNextIntl(nextConfig);
