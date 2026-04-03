"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { addPartnerProfile } from "@/app/actions/profile";
import { useState } from "react";

export function AddPartnerPrompt() {
  const [showForm, setShowForm] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await addPartnerProfile(formData);
      return result ?? null;
    },
    null
  );

  if (state?.success) {
    return (
      <Card className="text-center">
        <p className="text-text-primary font-sans font-medium">
          Partner profile added! Switch profiles to have them go through the flow.
        </p>
      </Card>
    );
  }

  if (!showForm) {
    return (
      <Card className="text-center">
        <p className="text-text-secondary text-sm mb-3">
          Want your partner to go through this too? Build your Rich Life together.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowForm(true)}
        >
          Add Partner Profile
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-text-primary font-sans font-medium mb-3">
        Add your partner
      </p>
      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">
          {state.error}
        </div>
      )}
      <form action={formAction} className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            label="Partner's name"
            name="name"
            type="text"
            placeholder="Their first name"
            required
          />
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Adding..." : "Add"}
        </Button>
      </form>
    </Card>
  );
}
