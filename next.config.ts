import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pacotes nativos (ONNX Runtime do FastEmbed) precisam rodar fora do bundle.
  serverExternalPackages: ["fastembed", "onnxruntime-node", "@anush008/tokenizers"],
  outputFileTracingExcludes: { "*": [".cache/**"] },
};

export default nextConfig;
