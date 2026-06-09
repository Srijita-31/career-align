"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { apiFetch } from "@/lib/api";
import DashboardCard from "@/components/ui/DashboardCard";

export default function StudentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch<{ status: string; data: any }>("/api/dashboard/student", { method: "GET" });
        if (res.status === "ok") {
          setData(res.data);
        } else {
          setError("Failed to load dashboard.");
        }
      } catch (e: any) {
        setError(e.message || "Network error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;

  return (
    <ProtectedRoute requiredRole="student">
      <div className="min-h-screen bg-gray-50 p-8">
        <h1 className="text-3xl font-bold mb-6">{data?.welcome}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DashboardCard title="Applications" value={data?.stats?.applications ?? 0} />
          <DashboardCard title="Interviews" value={data?.stats?.interviews ?? 0} />
        </div>
      </div>
    </ProtectedRoute>
  );
}
