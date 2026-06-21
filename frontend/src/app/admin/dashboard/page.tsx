"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";

interface AdminDashboardData {
  totalStudents: number;
  totalRecruiters: number;
  totalJobs: number;
  totalApplications: number;
  applicationStatusSummary: Record<string, number>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch<AdminDashboardData>("/api/admin/dashboard");
        setData(res);
      } catch (e: any) {
        setError(e.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;

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
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Link href="/admin/students" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <p className="text-sm text-gray-500 mb-1">Total Students</p>
              <p className="text-4xl font-bold text-blue-600">{data?.totalStudents ?? 0}</p>
            </Link>
            <Link href="/admin/recruiters" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <p className="text-sm text-gray-500 mb-1">Total Recruiters</p>
              <p className="text-4xl font-bold text-indigo-600">{data?.totalRecruiters ?? 0}</p>
            </Link>
            <Link href="/admin/jobs" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <p className="text-sm text-gray-500 mb-1">Active Jobs</p>
              <p className="text-4xl font-bold text-green-600">{data?.totalJobs ?? 0}</p>
            </Link>
            <Link href="/admin/applications" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <p className="text-sm text-gray-500 mb-1">Applications</p>
              <p className="text-4xl font-bold text-purple-600">{data?.totalApplications ?? 0}</p>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Application Status Breakdown</h2>
            {data?.applicationStatusSummary && Object.keys(data.applicationStatusSummary).length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(data.applicationStatusSummary).map(([status, count]) => (
                  <div key={status} className={`rounded-lg px-4 py-3 ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
                    <p className="text-sm font-medium capitalize">{status.replace(/_/g, " ")}</p>
                    <p className="text-2xl font-bold mt-1">{count}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No applications yet.</p>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
