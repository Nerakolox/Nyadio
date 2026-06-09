import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "nyadio-spa-admin-fallback",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const acceptsHtml = req.headers.accept?.includes("text/html");
          if (req.method === "GET" && acceptsHtml && req.url?.startsWith("/admin")) {
            req.url = "/index.html";
          }
          next();
        });
      }
    },
    react(),
    tailwindcss()
  ],
  server: {
    proxy: {
      "/admin": {
        target: "https://nyadio.feedra.org",
        // target: "http://127.0.0.1:13001",
        bypass(req) {
          if (req.method === "GET" && req.headers.accept?.includes("text/html")) {
            return "/index.html";
          }
          return undefined;
        }
      },
      "/api": "https://nyadio.feedra.org",
      "/stream": "https://nyadio.feedra.org",
      "/health": "https://nyadio.feedra.org"
      // "/api": "http://127.0.0.1:13001",
      // "/stream": "http://127.0.0.1:13001",
      // "/health": "http://127.0.0.1:13001"
    }
  }
});
