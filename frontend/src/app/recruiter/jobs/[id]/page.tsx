"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Sidebar } from "@/components/ui/Sidebar";
import { Navbar } from "@/components/ui/Navbar";
import { Button } from "@/components/ui/Button";

interface Applicant {
  id: number;
  email: string;
  full_name: string;
  match_score: number;
  current_status: string;
  applied_at: string;
  matched_skills: string[];
  missing_skills: string[];
}

export default function JobApplicantsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchApplicants = async () => {
      try {
        const data = await apiFetch<Applicant[]>(`/api/recruiter/job/${params.id}/applicants`);
        if (active) setApplicants(data || []);
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load applicants");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchApplicants();
    return () => { active = false; };
  }, [params.id]);

  const updateStatus = async (applicationId: number, status: string) => {
    try {
      await apiFetch(`/api/recruiter/application/${applicationId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      setApplicants(prev => prev.map(a => a.id === applicationId ? { ...a, current_status: status } : a));
    } catch (err) {
      alert("Failed to update status");
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 flex-col font-sans">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => router.push('/recruiter/dashboard')}>&larr; Back to Dashboard</Button>
              <h1 className="text-2xl font-bold text-slate-900">Applicants</h1>
            </div>

            {loading ? (
              <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">Loading applicants...</div>
            ) : error ? (
              <div className="p-6 bg-white rounded-xl shadow-sm border border-red-200 text-red-600">{error}</div>
            ) : applicants.length === 0 ? (
              <div className="p-12 bg-white rounded-2xl shadow-sm border border-slate-200 text-center">
                <h3 className="text-lg font-medium text-slate-700">No applicants yet</h3>
                <p className="text-slate-500 mt-1">Students will appear here once they apply to this job.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {applicants.map(applicant => (
                  <div key={applicant.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{applicant.full_name || 'Anonymous Student'}</h3>
                        <p className="text-sm text-slate-500">{applicant.email}</p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">AI Match Score: <span className="text-blue-600">{Math.round(applicant.match_score * 100)}%</span></h4>
                        <div className="space-y-2">
                          {applicant.matched_skills && applicant.matched_skills.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-xs font-medium text-slate-500 mr-1 mt-1">Matched:</span>
                              {applicant.matched_skills.map(s => (
                                <span key={s} className="px-2 py-0.5 bg-green-50 text-green-700 rounded-md text-xs border border-green-100">{s}</span>
                              ))}
                            </div>
                          )}
                          {applicant.missing_skills && applicant.missing_skills.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-xs font-medium text-slate-500 mr-1 mt-1">Missing:</span>
                              {applicant.missing_skills.map(s => (
                                <span key={s} className="px-2 py-0.5 bg-red-50 text-red-700 rounded-md text-xs border border-red-100">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="w-full sm:w-48 flex flex-col gap-3 border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                        <select
                          className="w-full text-sm border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 bg-slate-50"
                          value={applicant.current_status}
                          onChange={(e) => updateStatus(applicant.id, e.target.value)}
                        >
                          <option value="applied">Applied</option>
                          <option value="under_review">Under Review</option>
                          <option value="shortlisted">Shortlisted</option>
                          <option value="interview">Interviewing</option>
                          <option value="selected">Selected</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                      <div className="text-xs text-slate-400 mt-auto">
                        Applied: {new Date(applicant.applied_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
