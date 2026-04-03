"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { isValidEmail } from "@/lib/utils/validation";

interface PendingInvite {
  id: string;
  email: string;
  sentAt: string;
  status: "pending" | "accepted" | "expired";
}

export default function PartnerInvitePage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  const handleSendInvite = async () => {
    setError("");
    setSuccessMessage("");

    if (!email.trim()) {
      setError("Please enter an email address.");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch("/api/partner/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        const newInvite: PendingInvite = {
          id: crypto.randomUUID(),
          email,
          sentAt: new Date().toISOString(),
          status: "pending",
        };
        setPendingInvites((prev) => [newInvite, ...prev]);
        setSuccessMessage(`Invite sent to ${email}!`);
        setEmail("");
      }
    } catch {
      setError("Failed to send invite. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-12">
      <div className="mx-auto max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h1 className="font-serif text-4xl text-text-primary mb-3">
            Partner Mode
          </h1>
          <p className="text-lg text-text-secondary font-sans">
            Build your Rich Life together.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Card className="mb-8">
            <h2 className="font-serif text-xl text-text-primary mb-4">
              Invite Your Partner
            </h2>
            <div className="flex flex-col gap-4">
              <Input
                label="Partner's email"
                type="email"
                placeholder="partner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error}
              />
              <Button
                onClick={handleSendInvite}
                disabled={isSending}
                className="w-full"
              >
                {isSending ? "Sending..." : "Send Invite"}
              </Button>
              {successMessage && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-success font-sans text-center"
                >
                  {successMessage}
                </motion.p>
              )}
            </div>
          </Card>
        </motion.div>

        {pendingInvites.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <Card className="mb-8">
              <h2 className="font-serif text-xl text-text-primary mb-4">
                Pending Invites
              </h2>
              <div className="flex flex-col gap-3">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between rounded-lg bg-bg-secondary/50 px-4 py-3"
                  >
                    <div>
                      <p className="font-sans text-sm text-text-primary">
                        {invite.email}
                      </p>
                      <p className="font-sans text-xs text-text-secondary">
                        Sent {new Date(invite.sentAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="default">
                      {invite.status === "pending"
                        ? "Pending"
                        : invite.status === "accepted"
                          ? "Accepted"
                          : "Expired"}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <Card className="border-accent-gold/20">
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">
                🔒
              </span>
              <div>
                <h3 className="font-serif text-lg text-text-primary mb-1">
                  Your Privacy Matters
                </h3>
                <p className="font-sans text-sm text-text-secondary leading-relaxed">
                  Your individual data stays private. Sharing is always opt-in.
                  Only the information you explicitly choose to share will be
                  visible to your partner.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
