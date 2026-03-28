/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Evita importar o barrel gigante do lucide (menos chance de chunk/HMR quebrado no webpack).
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
