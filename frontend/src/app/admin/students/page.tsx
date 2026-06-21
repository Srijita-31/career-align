"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";

interface Student {
  id: number;
  email: string;
  created_at: string;
  full_name: string | null;
  college: string | null;
  profile_completion_percentage: number;
}

export default function AdminStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await apiFetch<Student[]>("/api/admin/students");
        setStudents(data);
      } catch (e: any) {
        setError(e.message || "Failed to load students");
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
            <h1 className="text-3xl font-bold text-gray-900">Students</h1>
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
                    <th className="text-left py-3 px-4 font-medium">College</th>
                    <th className="text-center py-3 px-4 font-medium">Profile %</th>
                    <th className="text-left py-3 px-4 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{s.full_name || "N/A"}</td>
                      <td className="py-3 px-4 text-gray-600">{s.email}</td>
                      <td className="py-3 px-4 text-gray-600">{s.college || "N/A"}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          s.profile_completion_percentage >= 80 ? "bg-green-100 text-green-800" :
                          s.profile_completion_percentage >= 40 ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {s.profile_completion_percentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500">{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {students.length === 0 && <p className="p-6 text-gray-500 text-center">No students registered.</p>}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
