"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { Briefcase, Building, Users } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ status: string; token: string; user: { id?: number; email?: string; role?: string } }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("jwt", data.token);
      const user = data.user || { email };
      const role = (user.role || 'student').toLowerCase();
      localStorage.setItem("careerAlignUser", JSON.stringify(user));
      // Role based redirect
      if (role === 'company' || role === 'recruiter') {
        router.push('/recruiter/dashboard');
      } else if (role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/student/dashboard');
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Left side: Branding */}
      <div className="hidden lg:flex w-1/2 bg-[#0A192F] flex-col relative overflow-hidden">
        {/* Abstract background elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 flex flex-col justify-center h-full p-12 xl:p-24">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 font-bold text-xl leading-none">
                C
              </div>
              <span className="font-bold text-2xl tracking-tight text-white">Career Align</span>
            </div>
            
            <h1 className="text-4xl xl:text-5xl font-bold text-white tracking-tight leading-tight mb-6">
              Find jobs that match your skills
            </h1>
            <p className="text-slate-300 text-lg max-w-md font-medium leading-relaxed">
              Connect your academic background with the perfect career opportunities using our intelligent AI matching engine.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 max-w-lg mt-8">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
              <Building className="w-6 h-6 text-blue-400 mb-3" />
              <div className="text-lg font-semibold text-white mb-1">Real matches from your skills</div>
              <div className="text-sm text-slate-300 font-medium">Sign in to connect your resume to the latest jobs available in the system.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Login Card */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative bg-slate-50">
        
        {/* Mobile background elements */}
        <div className="absolute inset-0 z-0 lg:hidden overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-400/20 rounded-full blur-[80px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-400/20 rounded-full blur-[80px]" />
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xl leading-none">
              C
            </div>
            <span className="font-bold text-2xl tracking-tight text-slate-900">Career Align</span>
          </div>

          {/* Glassmorphism Card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/40 p-8 sm:p-10">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-2">Welcome back</h2>
              <p className="text-slate-500">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <Input
                label="Email address"
                type="email"
                required
                placeholder="name@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="bg-white/50 focus:bg-white transition-colors"
              />

              <div>
                <Input
                  label="Password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="bg-white/50 focus:bg-white transition-colors"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white/50"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-slate-700">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <a href="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                    Forgot password?
                  </a>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 flex items-center">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full h-11 text-[15px]" isLoading={loading}>
                Sign in
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-600">
              Don't have an account?{" "}
              <a href="/register" className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
                Register here
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
