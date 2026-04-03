"use client";

import { Card } from "@/components/ui/Card";

interface AuthorQuoteProps {
  author: string;
  quote: string;
}

export function AuthorQuote({ author, quote }: AuthorQuoteProps) {
  return (
    <Card padding="lg" className="bg-bg-secondary/40">
      <blockquote className="font-serif text-lg text-text-primary italic leading-relaxed">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <p className="text-text-secondary text-sm mt-3 font-sans">
        &mdash; {author}
      </p>
    </Card>
  );
}
