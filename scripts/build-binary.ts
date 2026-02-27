import { $ } from "bun";
import { readFileSync, writeFileSync, cpSync } from "fs";

// 1. Build the SvelteKit app
await $`bun run build`;

// 2. Patch handler.js so the compiled binary resolves asset paths
//    relative to the executable, not import.meta.url
const handler = "build/handler.js";
writeFileSync(
  handler,
  readFileSync(handler, "utf8").replace(
    "path.dirname(fileURLToPath(new URL(import.meta.url)))",
    "path.dirname(process.execPath)",
  ),
);

// 3. Compile to standalone binary
await $`cd build && bun build --compile --minify ./index.js --outfile ../dist/mailnick`;

// 4. Copy client assets alongside binary
cpSync("build/client", "dist/client", { recursive: true });
