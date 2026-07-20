import { type HTMLAttributes, type ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

// The entrance is pure CSS since #109 (card-enter in globals.css) — the
// fade-up was framer-motion's only job here, and as a shared primitive it
// dragged the library into every route. No directive: the card renders
// server-side when its parent does.
export function Card({
  header,
  footer,
  children,
  padding = "md",
  className = "",
  ...rest
}: CardProps) {
  return (
    <div
      className={`card-enter bg-white rounded-xl border border-bg-secondary shadow-[0_2px_12px_rgba(61,43,31,0.08)] ${className}`}
      {...rest}
    >
      {header && (
        <div className="px-6 py-4 border-b border-bg-secondary font-serif text-text-primary">
          {header}
        </div>
      )}
      <div className={paddingClasses[padding]}>{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t border-bg-secondary">
          {footer}
        </div>
      )}
    </div>
  );
}
