import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ember — AI Accountability Coach",
    short_name: "Ember",
    description: "AI accountability coach that roasts you into taking action",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0A0A",
    theme_color: "#FF3D00",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
