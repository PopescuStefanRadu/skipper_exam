import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, API calls go to the backend of this worktree's stack (see scripts/stack.sh).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: process.env.API_URL ? { "/api": process.env.API_URL } : undefined,
  },
});
