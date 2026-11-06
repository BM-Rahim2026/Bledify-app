import { Suspense } from "react";
import { TrackView } from "@/components/TrackView";

export const metadata = { title: "Suivi de commande" };

export default function TrackPage() {
  return <Suspense><TrackView /></Suspense>;
}
