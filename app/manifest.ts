import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Merchvision",
    short_name: "Merchvision",
    description: "Conservative, explainable Old School RuneScape market research.",
    start_url: "/flips",
    scope: "/",
    display: "standalone",
    background_color: "#18232e",
    theme_color: "#18232e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }
    ]
  };
}
