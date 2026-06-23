"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getApiUrl } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function StudentProfileSetup() {
  const [fullName, setFullName] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [skills, setSkills] = useState("");
  const [targetRoles, setTargetRoles] = useState("");
  const [workPreference, setWorkPreference] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [locationPreference, setLocationPreference] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await apiFetch<{ status: string; profile: any }>("/api/student/profile");
        if (res.profile) {
          setFullName(res.profile.full_name || "");
          if (Array.isArray(res.profile.skills)) setSkills(res.profile.skills.join(", "));
          if (Array.isArray(res.profile.target_roles)) setTargetRoles(res.profile.target_roles.join(", "));
          setWorkPreference(res.profile.work_preference || "");
          setExperienceLevel(res.profile.experience_level || "");
          setLocationPreference(res.profile.location_preference || "");
        }
      } catch {
        // Profile doesn't exist yet, that's fine
      }
    };
    loadProfile();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeFile(file);
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("resume", file);
      const response = await fetch(getApiUrl("/api/match"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to parse resume");
      if (data.profile?.extracted_skills?.length) {
        setSkills(data.profile.extracted_skills.join(", "));
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload resume");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const skillsArr = skills.split(",").map((s) => s.trim()).filter(Boolean);
      const rolesArr = targetRoles.split(",").map((r) => r.trim()).filter(Boolean);
      await apiFetch<{ status: string }>("/api/student/profile/setup", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          skills: skillsArr,
          target_roles: rolesArr,
          work_preference: workPreference,
          experience_level: experienceLevel,
          location_preference: locationPreference,
        }),
      });
      router.push("/student/dashboard");
    } catch (err: any) {
      setError(err.message || "Setup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="student">
      <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
        <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-slate-50">
          <div className="w-full max-w-2xl space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Complete Your Profile</h2>
              <p className="text-slate-500 mt-1">Upload your resume and tell us your preferences</p>
            </div>

            <Card className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Full Name */}
                <Input
                  label="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                />

                {/* Resume Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Upload Resume (PDF/DOCX/TXT)</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-300 transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    {resumeFile ? (
                      <div>
                        <p className="text-green-600 font-medium">{resumeFile.name}</p>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-sm text-blue-600 hover:text-blue-500 mt-1"
                        >
                          Change file
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full"
                      >
                        <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-slate-500 mt-2">
                          <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-slate-400 mt-1">PDF, DOCX or TXT</p>
                      </button>
                    )}
                  </div>
                  {uploading && (
                    <div className="flex items-center gap-2 text-sm text-blue-600 mt-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Parsing resume...
                    </div>
                  )}
                </div>

                {/* Skills (auto-extracted from resume) */}
                <Input
                  label="Skills (comma separated)"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. JavaScript, Python, React, Node.js"
                />

                {/* Target Roles */}
                <Input
                  label="Target Roles (comma separated)"
                  value={targetRoles}
                  onChange={(e) => setTargetRoles(e.target.value)}
                  placeholder="e.g. Frontend Developer, Software Engineer"
                />

                {/* Work Mode Preference */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Work Mode Preference</label>
                  <div className="grid grid-cols-3 gap-3">
                    {["Remote", "Hybrid", "On-site"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setWorkPreference(opt.toLowerCase().replace("-", ""))}
                        className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                          workPreference === opt.toLowerCase().replace("-", "")
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location Preference */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Location Preference</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "india", label: "Within India" },
                      { value: "outside india", label: "Outside India" },
                      { value: "anywhere", label: "Anywhere" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLocationPreference(opt.value)}
                        className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                          locationPreference === opt.value
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Experience / Seniority Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Seniority Level</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { value: "intern", label: "Intern" },
                      { value: "fresher", label: "Fresher" },
                      { value: "mid", label: "Mid Level" },
                      { value: "senior", label: "Senior" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setExperienceLevel(opt.value)}
                        className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                          experienceLevel === opt.value
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 text-[15px]" isLoading={loading}>
                  Save Profile
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}