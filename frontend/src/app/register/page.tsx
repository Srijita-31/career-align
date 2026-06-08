"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ status: string; token: string; user: { id?: number; email?: string; role?: string } }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, role: "student" }),
      });
      localStorage.setItem("jwt", data.token);
      const user = data.user || { email };
      const role = (user.role || 'student').toLowerCase();
      localStorage.setItem("careerAlignUser", JSON.stringify(user));
      if (role === 'company' || role === 'recruiter') {
        router.push('/recruiter/dashboard');
      } else if (role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/student/dashboard');
      }
    } catch (err: any) {
      setError(err.message || "Network error. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex w-1/2 bg-[#0A192F] flex-col relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" />
        </div>
        <div className="relative z-10 flex flex-col justify-center h-full p-12 xl:p-24">
          <div className="flex items-center gap-3 mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xl">C</div>
            <span className="font-bold text-2xl tracking-tight text-white">Career Align</span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-bold text-white tracking-tight leading-tight mb-6">
            Start your career journey today
          </h1>
          <p className="text-slate-300 text-lg max-w-md font-medium leading-relaxed">
            Upload your resume and let our AI match you with the best internships and jobs that fit your unique skillset.
          </p>
          <div className="mt-12 space-y-4">
            {["AI-powered resume analysis", "Personalized job recommendations", "Real-time skill gap insights"].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-slate-300 text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Register Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-slate-50 relative">
        <div className="absolute inset-0 z-0 lg:hidden overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-400/20 rounded-full blur-[80px]" />
        </div>

        <div className="w-full max-w-md relative z-10">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 justify-center mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xl">C</div>
            <span className="font-bold text-2xl tracking-tight text-slate-900">Career Align</span>
          </div>

          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/60 p-8 sm:p-10">
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-1">Create an account</h2>
              <p className="text-slate-500 text-sm">Free forever. No credit card required.</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
              <Input
                label="Email address"
                type="email"
                required
                placeholder="name@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <Input
                label="Password"
                type="password"
                required
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <Input
                label="Confirm Password"
                type="password"
                required
                placeholder="Re-enter your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />

              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full h-11 text-[15px] mt-2" isLoading={loading}>
                Create Account
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{" "}
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
