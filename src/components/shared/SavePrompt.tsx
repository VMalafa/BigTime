"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function SavePrompt() {
  return (
    <Card padding="lg" className="text-center">
      <h3 className="font-serif text-xl text-text-primary mb-2">
        Save your Rich Life plan
      </h3>
      <p className="text-text-secondary text-sm mb-6 max-w-md mx-auto">
        Create an account to save your plan and track progress over time. Your
        data stays here until you do.
      </p>
      <Link href="/auth/signup">
        <Button variant="primary" size="lg">
          Create Your Free Account
        </Button>
      </Link>
    </Card>
  );
}
