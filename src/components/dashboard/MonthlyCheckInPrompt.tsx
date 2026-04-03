"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface MonthlyCheckInPromptProps {
  lastCheckInDate?: string;
}

export function MonthlyCheckInPrompt({
  lastCheckInDate,
}: MonthlyCheckInPromptProps) {
  return (
    <Card padding="lg" className="bg-bg-secondary/30">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <h3 className="font-serif text-lg text-text-primary">
            Time for your monthly check-in?
          </h3>
          <p className="text-text-secondary text-sm font-sans italic">
            &ldquo;Spend less than 1 hour per month on your money.&rdquo;
            <span className="not-italic"> &mdash; Ramit Sethi</span>
          </p>
          {lastCheckInDate && (
            <p className="text-text-secondary text-xs font-sans">
              Last check-in: {lastCheckInDate}
            </p>
          )}
        </div>
        <Link href="/dashboard/check-in">
          <Button variant="primary" size="md">
            Start Check-In
          </Button>
        </Link>
      </div>
    </Card>
  );
}
