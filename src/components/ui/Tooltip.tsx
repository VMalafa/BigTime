"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence, type TargetAndTransition } from "framer-motion";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  position?: TooltipPosition;
  children: ReactNode;
  className?: string;
}

const positionClasses: Record<TooltipPosition, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const arrowClasses: Record<TooltipPosition, string> = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-text-primary border-x-transparent border-b-transparent border-4",
  bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-text-primary border-x-transparent border-t-transparent border-4",
  left: "left-full top-1/2 -translate-y-1/2 border-l-text-primary border-y-transparent border-r-transparent border-4",
  right: "right-full top-1/2 -translate-y-1/2 border-r-text-primary border-y-transparent border-l-transparent border-4",
};

const motionOrigin: Record<TooltipPosition, { initial: TargetAndTransition; animate: TargetAndTransition }> = {
  top: { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 } },
  bottom: { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 } },
  left: { initial: { opacity: 0, x: 4 }, animate: { opacity: 1, x: 0 } },
  right: { initial: { opacity: 0, x: -4 }, animate: { opacity: 1, x: 0 } },
};

export function Tooltip({
  content,
  position = "top",
  children,
  className = "",
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            role="tooltip"
            initial={motionOrigin[position].initial}
            animate={motionOrigin[position].animate}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 pointer-events-none ${positionClasses[position]}`}
          >
            <div className="bg-text-primary text-white text-xs font-sans rounded-lg px-3 py-1.5 whitespace-nowrap shadow-[0_4px_12px_rgba(61,43,31,0.15)]">
              {content}
            </div>
            <div className={`absolute w-0 h-0 ${arrowClasses[position]}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
