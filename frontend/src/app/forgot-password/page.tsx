"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resetLink, setResetLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isResetMode, setIsResetMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const searchToken = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
    setToken(searchToken);
    setIsResetMode(Boolean(searchToken));
    if (searchToken) {
      setSuccess("Please choose a new password for your account.");
    }
  }, []);

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<{ status: string; message: string; resetUrl?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSuccess(data.message || "Password reset instructions have been sent.");
      if (data.resetUrl) {
        setResetLink(data.resetUrl);
      }
    } catch (err: any) {
      setError(err.message || "Unable to send reset instructions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!token) {
      setError("Invalid reset link.");
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<{ status: string; message: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setSuccess(data.message || "Password reset successfully.");
      window.setTimeout(() => router.push("/login"), 1400);
    } catch (err: any) {
      setError(err.message || "Unable to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-slate-50 relative">
        <div className="w-full max-w-md">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/60 p-8 sm:p-10">
            <div className="mb-8 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-2">
                {isResetMode ? "Reset your password" : "Forgot password"}
              </h2>
              <p className="text-slate-500 text-sm">
                {isResetMode
                  ? "Set a new password using the reset link you received."
                  : "Enter your email to receive a password reset link."}
              </p>
            </div>

            <form onSubmit={isResetMode ? handleReset : handleRequest} className="space-y-5">
              {!isResetMode ? (
                <Input
                  label="Email address"
                  type="email"
                  required
                  placeholder="name@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              ) : null}

              {isResetMode ? (
                <>
                  <Input
                    label="New password"
                    type="password"
                    required
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    required
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </>
              ) : null}

              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-emerald-50 text-emerald-700 text-sm p-3 rounded-lg border border-emerald-100">
                  {success}
                </div>
              )}

              {resetLink ? (
                <p className="text-sm text-slate-700">
                  Reset link for testing: <a className="text-blue-600 underline" href={resetLink}>{resetLink}</a>
                </p>
              ) : null}

              <Button type="submit" className="w-full h-11 text-[15px]" isLoading={loading}>
                {loading ? "Processing..." : isResetMode ? "Reset password" : "Send reset link"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Remembered your password?{' '}
              <a href="/login" className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
