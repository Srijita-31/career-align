"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { Navbar } from "@/components/ui/Navbar";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

function RecruiterContent() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await apiFetch<{ status: string; jobs: any[] }>("/api/company/jobs");
        if (active) setJobs(data.jobs || []);
      } catch (err: any) {
        if (active) setError(err.message || "Unable to load jobs");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  if (loading) return <div className="p-6">Loading jobs...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Your Jobs</h2>
        <Button onClick={() => window.location.href = '/recruiter/jobs/new'}>Create Job</Button>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-xl bg-white border p-6 text-center">You have no active jobs. Create one to start receiving applicants.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {jobs.map(job => (
            <div key={job.id} className="bg-white rounded-xl border p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold">{job.title}</h3>
                  <div className="text-sm text-gray-600">{job.location} • {job.company}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">{job.posted_date || ''}</div>
                  <div className="mt-2 flex gap-2">
                    <Button onClick={() => window.location.href = `/recruiter/jobs/${job.id}`}>View</Button>
                    <Button onClick={async () => {
                      if (!confirm('Delete this job?')) return;
                      try {
                        await apiFetch(`/api/company/jobs/${job.id}`, { method: 'DELETE' });
                        setJobs(prev => prev.filter(j => j.id !== job.id));
                      } catch (e) { alert('Unable to delete job'); }
                    }}>Delete</Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useRouter } from "next/navigation";

export default function RecruiterDashboard() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('jwt');
    const user = JSON.parse(localStorage.getItem('careerAlignUser') || 'null');
    if (!token || !user) return router.push('/login');
    const role = (user.role || 'student').toLowerCase();
    if (!(role === 'company' || role === 'recruiter')) {
      // Redirect students/admins to their dashboards
      if (role === 'admin') return router.push('/admin/dashboard');
      return router.push('/student/dashboard');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen bg-gray-50 flex-col font-sans">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <RecruiterContent />
        </main>
      </div>
    </div>
  );
}
