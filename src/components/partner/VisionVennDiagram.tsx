"use client";

import { motion } from "framer-motion";

interface VisionVennDiagramProps {
  partnerAValues: string[];
  partnerBValues: string[];
  sharedValues: string[];
}

export function VisionVennDiagram({
  partnerAValues,
  partnerBValues,
  sharedValues,
}: VisionVennDiagramProps) {
  return (
    <div className="w-full">
      {/* Visual circles representation */}
      <div className="relative flex items-center justify-center mb-8 h-48">
        {/* Partner A circle */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 0.2, x: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute w-44 h-44 rounded-full bg-cat-blue"
          style={{ left: "calc(50% - 120px)" }}
        />
        {/* Partner B circle */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 0.2, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="absolute w-44 h-44 rounded-full bg-cat-terra"
          style={{ left: "calc(50% - 24px)" }}
        />
        {/* Overlap */}
        {sharedValues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.35, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="absolute w-24 h-44 bg-accent-gold rounded-full"
            style={{ left: "calc(50% - 48px)" }}
          />
        )}
        {/* Labels on circles */}
        <span className="absolute font-sans text-xs font-medium text-cat-blue" style={{ left: "calc(50% - 110px)", top: "4px" }}>
          You
        </span>
        <span className="absolute font-sans text-xs font-medium text-cat-terra" style={{ right: "calc(50% - 110px)", top: "4px" }}>
          Partner
        </span>
        {sharedValues.length > 0 && (
          <span className="absolute font-sans text-xs font-semibold text-accent-gold-deep" style={{ top: "4px" }}>
            Shared
          </span>
        )}
      </div>

      {/* Value columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <h4 className="font-sans text-sm font-semibold text-cat-blue mb-3 text-center">
            Only You
          </h4>
          <div className="flex flex-col gap-2">
            {partnerAValues.length === 0 ? (
              <p className="font-sans text-xs text-text-secondary text-center italic">
                None yet
              </p>
            ) : (
              partnerAValues.map((value, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-lg bg-cat-blue/10 px-3 py-2 text-center"
                >
                  <span className="font-sans text-xs text-text-primary">
                    {value}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div>
          <h4 className="font-sans text-sm font-semibold text-accent-gold-deep mb-3 text-center">
            Shared
          </h4>
          <div className="flex flex-col gap-2">
            {sharedValues.length === 0 ? (
              <p className="font-sans text-xs text-text-secondary text-center italic">
                None yet
              </p>
            ) : (
              sharedValues.map((value, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-lg bg-accent-gold/15 px-3 py-2 text-center border border-accent-gold/20"
                >
                  <span className="font-sans text-xs text-text-primary font-medium">
                    {value}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div>
          <h4 className="font-sans text-sm font-semibold text-cat-terra mb-3 text-center">
            Only Partner
          </h4>
          <div className="flex flex-col gap-2">
            {partnerBValues.length === 0 ? (
              <p className="font-sans text-xs text-text-secondary text-center italic">
                None yet
              </p>
            ) : (
              partnerBValues.map((value, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-lg bg-cat-terra/10 px-3 py-2 text-center"
                >
                  <span className="font-sans text-xs text-text-primary">
                    {value}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
