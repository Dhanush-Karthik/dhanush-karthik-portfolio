import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  ssr: {
    // CommonJS-only packages that need bundling for the prerender step.
    noExternal: ["react-helmet-async"],
  },
  build: {
    outDir: isSsrBuild ? "dist-ssr" : "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: isSsrBuild ? {} : {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          three: ["three", "@react-three/fiber"],
        },
      },
    },
  },
}));
