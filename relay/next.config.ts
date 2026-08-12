import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  transpilePackages: ["tldraw", "@tldraw/editor", "@tldraw/store", "@tldraw/tlschema"],
};

export default withNextIntl(nextConfig);
