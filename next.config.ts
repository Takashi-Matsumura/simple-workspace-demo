import type { NextConfig } from "next";

// Next.js 16 + React 19 + @excalidraw/excalidraw@0.18 の組み合わせで Strict Mode 有効時に
// Excalidraw のデスクトップ UI (.layer-ui__wrapper) が描画されないため、無効化する。
const nextConfig: NextConfig = {
  reactStrictMode: false,
  // dockerode は ssh2 (native cpu-features) を間接依存。Turbopack がバンドル時に
  // ssh2/lib/protocol/crypto.js を "non-ecmascript placeable asset" として弾くため、
  // Server Components / Route Handlers では Node の require に逃がす。
  serverExternalPackages: ["dockerode", "docker-modem", "ssh2"],
};

export default nextConfig;
