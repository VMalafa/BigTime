import { type ReactNode } from "react";

// Post-#73 this layout hosts only the "know yourselves" side-quest pair
// (Money Scripts → Money Type) — the setup walk itself lives on the
// canonical dashboard pages.
export default function FlowLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-bg-primary">{children}</div>;
}
