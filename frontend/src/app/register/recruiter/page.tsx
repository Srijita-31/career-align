"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function RecruiterRegister() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<{ status: string; token: string; user: any }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          role: "recruiter",
          company_name: companyName,
          designation,
          phone,
          website,
        }),
      });
      localStorage.setItem("jwt", data.token);
      const user = data.user || { email, role: "recruiter" };
      localStorage.setItem("careerAlignUser", JSON.stringify(user));
      router.push("/recruiter/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Recruiter Registration</h2>
          <form onSubmit={handleRegister} className="space-y-4">
            <Input label="Full Name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input label="Company Name" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            <Input label="Designation" required value={designation} onChange={(e) => setDesignation(e.target.value)} />
            <Input label="Phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Company Website (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} />
            {error && <div className="bg-red-50 text-red-600 p-2 rounded">{error}</div>}
            <Button type="submit" className="w-full" isLoading={loading}>Create Account</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
