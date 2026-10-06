// @ts-check

import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders } from "astro/config";
import { voidPlugin } from "void";

// https://astro.build/config
export default defineConfig({
  // Used for canonical URLs, RSS links and the sitemap. Update when a custom
  // domain is bound to the Worker.
  site: "https://website.2157429750.workers.dev",
  output: "server",
  // Void's Astro integration (framework mode): Astro owns the build and the
  // Cloudflare adapter owns the output, while Void plugs into Vite for
  // bindings/deploy. This is the supported deploy path (the `appType: "static"`
  // pre-built-site path could not bootstrap a Worker).
  adapter: cloudflare({ configPath: "./.void-wrangler.jsonc" }),
  integrations: [mdx(), sitemap()],
  vite: { plugins: [voidPlugin()] },
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Atkinson",
      cssVariable: "--font-atkinson",
      fallbacks: ["sans-serif"],
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/atkinson-regular.woff"],
            weight: 400,
            style: "normal",
            display: "swap",
          },
          {
            src: ["./src/assets/fonts/atkinson-bold.woff"],
            weight: 700,
            style: "normal",
            display: "swap",
          },
        ],
      },
    },
  ],
});
