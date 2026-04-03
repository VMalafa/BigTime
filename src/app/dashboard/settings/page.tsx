"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="font-serif text-3xl text-text-primary">Settings</h1>

      <Card>
        <h2 className="font-serif text-xl mb-4">Account</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Email</span>
            <span>user@example.com</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Name</span>
            <span>Not set</span>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-serif text-xl mb-4">Partner Mode</h2>
        <p className="text-text-secondary text-sm mb-4">
          Link with a partner to build your Rich Life together.
        </p>
        <Button variant="secondary" size="sm">
          Invite Partner
        </Button>
      </Card>

      <Card>
        <h2 className="font-serif text-xl mb-4">Privacy</h2>
        <p className="text-text-secondary text-sm mb-4">
          Control what your partner can see.
        </p>
        <div className="space-y-3">
          {[
            "Share Money Scripts",
            "Share Individual Debts",
            "Share Income Details",
            "Share Money Dials",
          ].map((label) => (
            <label key={label} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-accent-gold"
              />
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-serif text-xl mb-4">Data</h2>
        <div className="space-y-3">
          <Button variant="secondary" size="sm">
            Export My Data
          </Button>
          <Button variant="ghost" size="sm" className="text-error">
            Delete Account
          </Button>
        </div>
      </Card>
    </div>
  );
}
