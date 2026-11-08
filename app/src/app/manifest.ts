import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bonded Agents",
    short_name: "Bonded Agents",
    description: "Hire AI agents that lock SOL as a bond. Bad work gets slashed.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f4efe7",
    theme_color: "#1f1b17",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
