"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";

interface AdminJob {
  id: number;
  title: string;
  company: string;
  company_name: string | null;
  location: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await apiFetch<AdminJob[]>("/api/admin/jobs");
        setJobs(data);
      } catch (e: any) {
        setError(e.message || "Failed to load jobs");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/admin/dashboard" className="text-sm text-blue-600 hover:underline">&larr; Back</Link>
            <h1 className="text-3xl font-bold text-gray-900">Jobs</h1>
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
                    <th className="text-left py-3 px-4 font-medium">Title</th>
                    <th className="text-left py-3 px-4 font-medium">Company</th>
                    <th className="text-left py-3 px-4 font-medium">Location</th>
                    <th className="text-center py-3 px-4 font-medium">Active</th>
                    <th className="text-left py-3 px-4 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{job.title}</td>
                      <td className="py-3 px-4 text-gray-600">{job.company_name || job.company}</td>
                      <td className="py-3 px-4 text-gray-600">{job.location || "Remote"}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          job.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {job.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500">{new Date(job.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {jobs.length === 0 && <p className="p-6 text-gray-500 text-center">No jobs posted.</p>}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
