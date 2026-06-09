// src/app/register/admin/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function AdminRegister() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ status: string; token: string; user: { id?: number; email?: string; role?: string } }>(
        "/api/auth/register",
        {
          method: "POST",
          body: JSON.stringify({ full_name: fullName, email, password, role: "admin" }),
        }
      );
      localStorage.setItem("jwt", data.token);
      localStorage.setItem("careerAlignUser", JSON.stringify(data.user));
      router.push("/admin/dashboard");
    } catch (err: any) {
      setError(err.message || "Network error. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Left branding panel */}
      <div className="hidden lg:flex w-1/2 bg-[#0A192F] flex-col relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 flex flex-col justify-center h-full p-12 xl:p-24">
          <div className="flex items-center gap-3 mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xl">A</div>
            <span className="font-bold text-2xl tracking-tight text-white">Career Align</span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-bold text-white tracking-tight mb-6">
            Admin Registration
          </h1>
          <p className="text-slate-300 text-lg max-w-md font-medium">
            Create an administrator account to manage the platform.
          </p>
        </div>
      </div>

      {/* Right side: Registration form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-slate-50 relative">
        <div className="absolute inset-0 z-0 lg:hidden overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-400/20 rounded-full blur-[80px]" />
        </div>
        <div className="w-full max-w-md relative z-10">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/40 p-8 sm:p-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">Create Admin Account</h2>
            <form onSubmit={handleRegister} className="space-y-5">
              <Input label="Full Name" type="text" required placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} />
              <Input label="Email address" type="email" required placeholder="admin@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              <Input label="Password" type="password" required placeholder="Minimum 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 flex items-center gap-2">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full h-11" isLoading={loading}>Create Admin</Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
