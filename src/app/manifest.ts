import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bledify",
    short_name: "Bledify",
    description: "Gérez vos commandes en paiement à la livraison.",
    start_url: "/seller",
    display: "standalone",
    background_color: "#f7f3ec",
    theme_color: "#1c4430",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
