"use client";

import { Suspense, useState, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { signUp, signInWithGoogle } from "@/app/actions/auth";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";
  const [password, setPassword] = useState("");

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      formData.set("redirectTo", redirectTo);
      const result = await signUp(formData);
      return result ?? null;
    },
    null
  );

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="w-full">
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <h1 className="font-serif text-3xl text-text-primary mb-2">
                Start Your Rich Life
              </h1>
              <p className="text-text-secondary text-sm">
                Create an account to save your plan and track progress.
              </p>
            </div>

            {state?.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {state.error}
              </div>
            )}

            <form action={formAction} className="flex flex-col gap-4">
              <Input
                label="Name"
                name="name"
                type="text"
                placeholder="Your name"
                required
              />
              <Input
                label="Email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
              <Input
                label="Password"
                name="password"
                type="password"
                placeholder="Create a passphrase"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                helperText="At least 12 characters — a passphrase of a few random words works great"
              />

              <Button
                type="submit"
                variant="primary"
                disabled={pending || password.length < 12}
                className="w-full mt-2"
              >
                {pending ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-bg-secondary" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-3 text-text-secondary">or</span>
              </div>
            </div>

            <form action={signInWithGoogle}>
              <Button
                type="submit"
                variant="secondary"
                className="w-full"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Sign up with Google
              </Button>
            </form>

            <p className="text-center text-sm text-text-secondary">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-accent-gold-deep hover:text-accent-gold font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
