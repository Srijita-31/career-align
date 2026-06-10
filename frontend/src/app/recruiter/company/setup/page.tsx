// frontend/src/app/recruiter/company/setup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function CompanySetup() {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [foundedYear, setFoundedYear] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch<{ status: string }>("/api/recruiter/company/setup", {
        method: "POST",
        body: JSON.stringify({
          name,
          website,
          industry,
          size,
          founded_year: foundedYear,
        }),
      });
      router.push("/recruiter/dashboard");
    } catch (err: any) {
      setError(err.message || "Company setup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="recruiter">
      <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
        <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-slate-50">
          <div className="w-full max-w-2xl bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">Company Setup</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Company Name" required value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Website (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} />
              <Input label="Industry" required value={industry} onChange={(e) => setIndustry(e.target.value)} />
              <Input label="Company Size" required value={size} onChange={(e) => setSize(e.target.value)} />
              <Input label="Founded Year" type="number" required value={foundedYear} onChange={(e) => setFoundedYear(e.target.value)} />
              {error && <div className="bg-red-50 text-red-600 p-2 rounded">{error}</div>}
              <Button type="submit" className="w-full" isLoading={loading}>Save Company</Button>
            </form>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
