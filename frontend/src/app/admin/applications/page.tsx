"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";

interface AdminApplication {
  id: number;
  student_id: number;
  job_id: number;
  match_score: number;
  current_status: string;
  created_at: string;
  email: string;
  title: string;
  company: string;
}

export default function AdminApplications() {
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await apiFetch<AdminApplication[]>("/api/admin/applications");
        setApplications(data);
      } catch (e: any) {
        setError(e.message || "Failed to load applications");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const statusColors: Record<string, string> = {
    applied: "bg-blue-100 text-blue-800",
    under_review: "bg-yellow-100 text-yellow-800",
    shortlisted: "bg-indigo-100 text-indigo-800",
    interview: "bg-purple-100 text-purple-800",
    selected: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    withdrawn: "bg-gray-100 text-gray-800",
  };

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/admin/dashboard" className="text-sm text-blue-600 hover:underline">&larr; Back</Link>
            <h1 className="text-3xl font-bold text-gray-900">Applications</h1>
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
                    <th className="text-left py-3 px-4 font-medium">Student</th>
                    <th className="text-left py-3 px-4 font-medium">Job</th>
                    <th className="text-left py-3 px-4 font-medium">Company</th>
                    <th className="text-center py-3 px-4 font-medium">Match</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Applied</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{app.email}</td>
                      <td className="py-3 px-4 text-gray-600">{app.title}</td>
                      <td className="py-3 px-4 text-gray-600">{app.company}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          app.match_score >= 0.75 ? "bg-green-100 text-green-800" :
                          app.match_score >= 0.4 ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {Math.round(app.match_score * 100)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[app.current_status] || "bg-gray-100 text-gray-800"}`}>
                          {app.current_status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500">{new Date(app.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {applications.length === 0 && <p className="p-6 text-gray-500 text-center">No applications yet.</p>}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
