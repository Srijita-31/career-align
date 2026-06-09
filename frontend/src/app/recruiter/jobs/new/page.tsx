"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

import { Sidebar } from "@/components/ui/Sidebar";
import { Navbar } from "@/components/ui/Navbar";

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState("Remote");
  const [jobType, setJobType] = useState("Full Time");
  const [skills, setSkills] = useState(""); // comma‑separated
  const [experience, setExperience] = useState("");
  const [salary, setSalary] = useState("");
  const [description, setDescription] = useState("");
  const [applyUrl, setApplyUrl] = useState("");

  // Load recruiter profile to get company info
  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const data = await apiFetch<any>("/api/recruiter/profile");
        setCompanyName(data.company?.name || "");
        setCompanyId(data.recruiterProfile?.company_id || null);
      } catch (e) {
        alert("Failed to load recruiter profile");
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !applyUrl) {
      alert("Title and Apply URL are required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title,
        company_id: companyId,
        location,
        work_mode: workMode,
        job_type: jobType,
        skills: skills.split(",").map(s => s.trim()).filter(Boolean),
        minimum_experience_years: experience,
        salary,
        description,
        apply_url: applyUrl,
      };
      await apiFetch<any>("/api/company/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      alert("Job created successfully");
      router.push("/recruiter/dashboard");
    } catch (err: any) {
      alert(err?.message || "Failed to create job");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 flex-col font-sans">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Post a New Job</h1>
            {loading ? (
              <div className="py-4 text-slate-500">Loading your profile...</div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="Job Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Frontend Engineer" required />
                  <Input label="Company Name" value={companyName} disabled className="bg-slate-50 text-slate-500 cursor-not-allowed" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="Location" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. San Francisco, CA" />
                  <Input label="Salary / Stipend" value={salary} onChange={e => setSalary(e.target.value)} placeholder="e.g. $120k - $150k" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">Work Mode</label>
                    <select
                      className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 bg-white border"
                      value={workMode}
                      onChange={e => setWorkMode(e.target.value)}
                    >
                      <option>Remote</option>
                      <option>Hybrid</option>
                      <option>Onsite</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">Job Type</label>
                    <select
                      className="w-full border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 bg-white border"
                      value={jobType}
                      onChange={e => setJobType(e.target.value)}
                    >
                      <option>Full Time</option>
                      <option>Part Time</option>
                      <option>Contract</option>
                      <option>Internship</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="Required Skills (comma separated)" value={skills} onChange={e => setSkills(e.target.value)} placeholder="React, Node.js, TypeScript" />
                  <Input label="Experience Required (years)" type="number" value={experience} onChange={e => setExperience(e.target.value)} placeholder="e.g. 3" />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Application URL</label>
                  <Input label="" value={applyUrl} onChange={e => setApplyUrl(e.target.value)} placeholder="https://company.com/careers/apply" required />
                  <p className="text-xs text-slate-500">Students will be redirected here if you don't use internal applications.</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Job Description</label>
                  <textarea
                    className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Describe the role, responsibilities, and ideal candidate..."
                    rows={6}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <Button type="button" variant="outline" onClick={() => router.push('/recruiter/dashboard')}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Posting Job..." : "Post Job"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
