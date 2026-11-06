import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bledify",
    short_name: "Bledify",
    description: "Gérez vos commandes en paiement à la livraison.",
    start_url: "/seller",
    display: "standalone",
    background_color: "#f7f3ec",
    theme_color: "#b4532a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
