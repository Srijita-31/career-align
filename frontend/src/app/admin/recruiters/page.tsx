"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";

interface Recruiter {
  id: number;
  email: string;
  created_at: string;
  full_name: string | null;
  company_name: string | null;
  is_verified: boolean;
}

export default function AdminRecruiters() {
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await apiFetch<Recruiter[]>("/api/admin/recruiters");
        setRecruiters(data);
      } catch (e: any) {
        setError(e.message || "Failed to load recruiters");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleVerify = async (recruiterId: number) => {
    try {
      await apiFetch(`/api/admin/recruiters/${recruiterId}/verify`, { method: "PUT" });
      setRecruiters(prev => prev.map(r => r.id === recruiterId ? { ...r, is_verified: true } : r));
    } catch (e: any) {
      alert(e.message || "Failed to verify");
    }
  };

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/admin/dashboard" className="text-sm text-blue-600 hover:underline">&larr; Back</Link>
            <h1 className="text-3xl font-bold text-gray-900">Recruiters</h1>
          </div>
          {loading ? (
            <p>Loading...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium">Name</th>
                    <th className="text-left py-3 px-4 font-medium">Email</th>
                    <th className="text-left py-3 px-4 font-medium">Company</th>
                    <th className="text-center py-3 px-4 font-medium">Verified</th>
                    <th className="text-left py-3 px-4 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recruiters.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{r.full_name || "N/A"}</td>
                      <td className="py-3 px-4 text-gray-600">{r.email}</td>
                      <td className="py-3 px-4 text-gray-600">{r.company_name || "N/A"}</td>
                      <td className="py-3 px-4 text-center">
                        {r.is_verified ? (
                          <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Verified</span>
                        ) : (
                          <button
                            onClick={() => handleVerify(r.id)}
                            className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                          >
                            Verify
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recruiters.length === 0 && <p className="p-6 text-gray-500 text-center">No recruiters registered.</p>}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
