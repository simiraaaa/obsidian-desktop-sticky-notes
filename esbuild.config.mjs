import esbuild from "esbuild";
import process from "node:process";

const watch = process.argv.includes("--watch");
const context = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  outfile: "main.js",
  format: "cjs",
  platform: "node",
  target: "es2022",
  external: ["obsidian", "electron"],
  sourcemap: "inline",
  logLevel: "info"
});

if (watch) {
  await context.watch();
  console.log("Watching for changes...");
} else {
  await context.rebuild();
  await context.dispose();
}
