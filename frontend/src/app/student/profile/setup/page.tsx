// frontend/src/app/student/profile/setup/page.tsx
"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getApiUrl } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function StudentProfileSetup() {
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [skills, setSkills] = useState("");
  const [education, setEducation] = useState("");
  const [projects, setProjects] = useState("");
  const [experience, setExperience] = useState("");
  const [targetRoles, setTargetRoles] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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
      if (data.profile?.resume_text) setResumeText(data.profile.resume_text);
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
      await apiFetch<{ status: string }>("/api/student/profile/setup", {
        method: "POST",
        body: JSON.stringify({
          resume_text: resumeText,
          skills,
          education,
          projects,
          experience,
          target_roles: targetRoles,
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
          <div className="w-full max-w-2xl bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">Complete Your Profile</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Resume (PDF/DOCX/TXT)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {resumeFile && (
                  <p className="text-xs text-green-600 mt-1">Uploaded: {resumeFile.name}</p>
                )}
                {uploading && <p className="text-xs text-blue-600 mt-1">Parsing resume...</p>}
              </div>
              <Input label="Resume Text" value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
              <Input label="Skills (comma separated)" required value={skills} onChange={(e) => setSkills(e.target.value)} />
              <Input label="Education" required value={education} onChange={(e) => setEducation(e.target.value)} />
              <Input label="Projects" required value={projects} onChange={(e) => setProjects(e.target.value)} />
              <Input label="Experience" required value={experience} onChange={(e) => setExperience(e.target.value)} />
              <Input label="Target Roles" required value={targetRoles} onChange={(e) => setTargetRoles(e.target.value)} />
              {error && <div className="bg-red-50 text-red-600 p-2 rounded">{error}</div>}
              <Button type="submit" className="w-full" isLoading={loading}>Save Profile</Button>
            </form>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
