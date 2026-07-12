import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Proxy all /api calls to the FastAPI backend — this eliminates CORS in dev
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
    watch: {
      // Exclude other projects from being watched
      ignored: [
        '**/kenya-landlord-link/**',
        '**/node_modules/**',
        '**/.git/**',
        '**/../kenya-landlord-link/**',
      ],
    },
    fs: {
      // Restrict file system access to project root only
      strict: true,
      allow: [__dirname],
    },
  },

  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent resolving imports from other projects
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // Ensure proper cache busting
    rollupOptions: {
      output: {
        // Add timestamp to chunk names for aggressive cache busting
        chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        entryFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-[hash]-${Date.now()}.[ext]`,
        manualChunks: {
          // Core React (140KB)
          vendor: ["react", "react-dom"],
          router: ["react-router-dom"],
          
          // UI Components (109KB)
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-tabs",
            "@radix-ui/react-popover",
          ],
          
          // Supabase (157KB)
          supabase: ["@supabase/supabase-js"],
          
          // Query & State Management (60KB)
          query: ["@tanstack/react-query"],
          
          // Charts & Analytics
          charts: ["recharts"],
          
          // Utilities
          utils: ["date-fns", "lucide-react"],
        },
      },
    },
    // Enable source maps for production debugging
    sourcemap: mode === "development",
    // Set chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@supabase/supabase-js",
      "@tanstack/react-query",
      "recharts",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-dialog",
      "@radix-ui/react-select",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-tooltip",
      "@upstash/redis",
    ],
    force: true,
  },
  // Define global variables for browser compatibility
  define: {
    // Polyfill process for packages that expect it (like @upstash/redis)
    'process.env.NODE_ENV': JSON.stringify(mode),
    'process.env': '{}',
    'global': 'globalThis',
  },
}));
