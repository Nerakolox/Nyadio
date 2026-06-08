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
        target: "http://localhost:3000",
        bypass(req) {
          if (req.method === "GET" && req.headers.accept?.includes("text/html")) {
            return "/index.html";
          }
          return undefined;
        }
      },
      "/api": "http://localhost:3000",
      "/stream": "http://localhost:3000",
      "/health": "http://localhost:3000"
    }
  }
});
