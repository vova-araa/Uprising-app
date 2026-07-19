import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function heroImagePreload(): Plugin {
  return {
    name: "hero-image-preload",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        const preloadAssets = ["hero-studio", "studio-a"];
        let tags = "";
        for (const [fileName] of Object.entries(bundle)) {
          if (fileName.endsWith(".webp") && preloadAssets.some(a => fileName.includes(a))) {
            const priority = fileName.includes("hero-studio") ? ' fetchpriority="high"' : "";
            tags += `  <link rel="preload" as="image" type="image/webp" href="/${fileName}"${priority} />\n`;
          }
        }
        return tags ? html.replace("</head>", `${tags}  </head>`) : html;
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    sourcemap: mode !== "production",
    target: "es2020",
    cssCodeSplit: true,
    cssMinify: true,
    minify: "esbuild",
    rollupOptions: {
      output: {
        // Keep a single shared vendor chunk to avoid cross-chunk React runtime ordering issues
        // that can cause `__SECRET_INTERNALS...` errors in production.
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
  plugins: [react(), heroImagePreload(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));