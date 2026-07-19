import { redirect } from "next/navigation";

// The old step-flow root (#73): setup now lives as a guided walk over the
// canonical dashboard pages. Old bookmarks land on Home, where the walk
// banner picks them up mid-journey.
export default function FlowPage() {
  redirect("/dashboard");
}
