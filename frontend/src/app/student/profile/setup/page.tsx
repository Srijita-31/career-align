// frontend/src/app/student/profile/setup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function StudentProfileSetup() {
  const [resume, setResume] = useState("");
  const [skills, setSkills] = useState("");
  const [education, setEducation] = useState("");
  const [projects, setProjects] = useState("");
  const [experience, setExperience] = useState("");
  const [targetRoles, setTargetRoles] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch<{ status: string }>("/api/student/profile/setup", {
        method: "POST",
        body: JSON.stringify({
          resume_text: resume,
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
              <Input label="Resume Text" required value={resume} onChange={(e) => setResume(e.target.value)} />
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
