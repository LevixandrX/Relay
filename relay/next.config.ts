import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  transpilePackages: ["tldraw", "@tldraw/editor", "@tldraw/store", "@tldraw/tlschema"],
};

export default nextConfig;
