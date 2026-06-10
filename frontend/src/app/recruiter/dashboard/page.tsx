"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { Navbar } from "@/components/ui/Navbar";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

function RecruiterContent() {
  const [data, setData] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [dashData, jobsData] = await Promise.all([
          apiFetch<any>("/api/recruiter/dashboard"),
          apiFetch<{ status: string; jobs: any[] }>("/api/company/jobs")
        ]);
        if (active) {
          setData(dashData);
          setJobs(jobsData.jobs || []);
        }
      } catch (err: any) {
        if (active) setError(err.message || "Unable to load dashboard data");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  if (loading) return <div className="p-6">Loading your workspace...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Recruiter Dashboard</h2>
        <Button onClick={() => window.location.href = '/recruiter/jobs/new'}>Post a New Job</Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
          <div className="text-4xl font-extrabold text-blue-600 mb-2">{data?.activeJobs || 0}</div>
          <div className="text-slate-500 font-medium">Active Jobs</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
          <div className="text-4xl font-extrabold text-indigo-600 mb-2">{data?.totalApplicants || 0}</div>
          <div className="text-slate-500 font-medium">Total Applicants</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
          <div className="text-4xl font-extrabold text-green-600 mb-2">{data?.hiringFunnel?.shortlisted || 0}</div>
          <div className="text-slate-500 font-medium">Shortlisted Candidates</div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold text-slate-800 mb-4">Your Posted Jobs</h3>
        {jobs.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-12 text-center">
            <h4 className="text-lg font-semibold text-slate-700 mb-2">No active jobs</h4>
            <p className="text-slate-500 mb-6">You have not posted any jobs yet. Create one to start receiving applicants.</p>
            <Button onClick={() => window.location.href = '/recruiter/jobs/new'}>Post your first job</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {jobs.map(job => (
              <div key={job.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 transition-all hover:shadow-md">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{job.title}</h3>
                    <div className="text-sm text-slate-500 mt-1 flex flex-wrap gap-2">
                      <span className="bg-slate-100 px-2 py-1 rounded-md">{job.location || 'Remote'}</span>
                      <span className="bg-slate-100 px-2 py-1 rounded-md">{job.work_mode || 'Full-time'}</span>
                      {job.salary && <span className="text-slate-600 px-2 py-1">{job.salary}</span>}
                    </div>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => window.location.href = `/recruiter/jobs/${job.id}`}>View Applicants</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RecruiterDashboard() {
  return (
    <ProtectedRoute requiredRole="recruiter">
      <div className="flex min-h-screen bg-gray-50 flex-col font-sans">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6 lg:p-8">
            <RecruiterContent />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
