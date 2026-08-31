import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The frontend imports the contract ABIs (../artifacts-manual/*.json) and the
// local deployment (../deployment.json) DIRECTLY from the repo root, so there's
// a single source of truth and no copy/sync step that can drift. Vite's dev
// server only serves files under its root by default, so we widen fs.allow to
// include the parent (repo root). This is a dev-server concern only; production
// builds bundle the imported JSON regardless.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: { allow: [".."] },
  },
});
