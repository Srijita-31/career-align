"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { Navbar } from "@/components/ui/Navbar";
import DashboardContent from "../../dashboard/DashboardContent";

export default function StudentDashboard() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('careerAlignUser') || 'null');
    if (!token || !user) return router.push('/login');
    const role = (user.role || 'student').toLowerCase();
    if (role !== 'student') {
      // Redirect other roles to their landing
      if (role === 'company' || role === 'recruiter') return router.push('/recruiter/dashboard');
      if (role === 'admin') return router.push('/admin/dashboard');
      return router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen bg-gray-50 flex-col font-sans">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <DashboardContent />
        </main>
      </div>
    </div>
  );
}
