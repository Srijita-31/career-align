"use client";

import { useEffect, useMemo, useState } from "react";
import { JobCard } from "@/components/ui/JobCard";
import { AnalyticsChart } from "@/components/ui/AnalyticsChart";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";

interface StudentProfile {
  full_name?: string;
  resume_text?: string;
  resume_path?: string;
  skills?: string[];
  extracted_skills?: string[];
  target_roles?: string[];
}

interface JobRecommendation {
  title: string;
  company: string;
  location: string;
  salary?: string;
  score: number;
  work_mode?: string;
  remote_type?: string;
  apply_url?: string;
  required_skills?: string[];
  skills?: string[];
  nice_to_have_skills?: string[];
}

const normalizeSkills = (skills: any): string[] => {
  if (!Array.isArray(skills)) return [];
  return skills.map((skill) => String(skill || "").trim()).filter(Boolean);
};

const buildSkillRadar = (profile: StudentProfile | null, jobs: JobRecommendation[]) => {
  const extracted = normalizeSkills(profile?.extracted_skills || profile?.skills || []);
  const scoreValues = jobs.map((job) => Number(job.score || 0));
  const strongMatches = jobs.filter((job) => Number(job.score || 0) >= 75).length;
  const averageScore = scoreValues.length ? Math.round(scoreValues.reduce((sum, val) => sum + val, 0) / scoreValues.length) : 0;
  const readiness = extracted.length ? Math.min(100, extracted.length * 12) : 0;
  const demand = Math.min(100, jobs.length * 8);

  return [
    { subject: "Profile Skills", A: readiness, fullMark: 100 },
    { subject: "Average Fit", A: averageScore, fullMark: 100 },
    { subject: "Strong Matches", A: Math.round((strongMatches / Math.max(jobs.length, 1)) * 100), fullMark: 100 },
    { subject: "Opportunity", A: demand, fullMark: 100 },
    { subject: "Resume Strength", A: profile?.resume_path ? 90 : 50, fullMark: 100 },
  ];
};

const deriveSkillGapItems = (profile: StudentProfile | null, jobs: JobRecommendation[]) => {
  const extracted = new Set(normalizeSkills(profile?.extracted_skills || profile?.skills || []).map((skill) => skill.toLowerCase()));
  const missingCount = new Map<string, number>();

  jobs.forEach((job) => {
    const required = normalizeSkills(job.required_skills || job.skills || []);
    required.forEach((skill) => {
      const normalized = skill.toLowerCase();
      if (normalized && !extracted.has(normalized)) {
        missingCount.set(skill, (missingCount.get(skill) || 0) + 1);
      }
    });
  });

  return Array.from(missingCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([skill, count]) => ({ skill, count }));
};

export default function DashboardContent() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [jobs, setJobs] = useState<JobRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        try {
          const profileResponse = await apiFetch<{ status: string; profile: StudentProfile }>("/api/student/profile");
          if (active) setProfile(profileResponse.profile);
        } catch (err: any) {
          if (!/profile not found/i.test(err.message)) {
            throw err;
          }
          if (active) setProfile(null);
        }

        try {
          const matchesResponse = await apiFetch<{ status: string; jobs: JobRecommendation[] }>("/api/student/matches");
          if (active) setJobs(matchesResponse.jobs || []);
        } catch (err: any) {
          if (!/student profile not found/i.test(err.message)) {
            throw err;
          }
          if (active) setJobs([]);
        }
      } catch (err: any) {
        if (active) setError(err.message || "Unable to load dashboard data.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const chartData = useMemo(() => buildSkillRadar(profile, jobs), [profile, jobs]);
  const skillGapItems = useMemo(() => deriveSkillGapItems(profile, jobs), [profile, jobs]);
  const profileSkills = normalizeSkills(profile?.extracted_skills || profile?.skills || []);

  if (loading) {
    return (
      <div className="rounded-3xl bg-white shadow-sm border border-gray-200 p-10 text-center">
        <p className="text-gray-600">Loading your workspace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl bg-white shadow-sm border border-red-200 p-10">
        <h2 className="text-xl font-semibold text-red-700 mb-3">Unable to load dashboard</h2>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-500 mt-1">Your personalized recommendations and skills summary are loaded from the backend.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Recommended Jobs</h2>
              <p className="text-sm text-gray-500">Jobs matched to your profile and skill set.</p>
            </div>
          </div>

          <div className="space-y-4">
            {jobs.length ? (
              jobs.slice(0, 3).map((job) => {
                const extractedSkills = new Set(profileSkills.map((skill) => skill.toLowerCase()));
                const required = normalizeSkills(job.required_skills || job.skills || []);
                const matched = required.filter((skill) => extractedSkills.has(skill.toLowerCase()));
                const missing = required.filter((skill) => !extractedSkills.has(skill.toLowerCase()));

                return (
                  <JobCard
                    key={`${job.title}-${job.company}-${job.location}`}
                    title={job.title}
                    company={job.company}
                    location={job.location || "Remote"}
                    salary={job.salary}
                    matchPercentage={Math.round(Number(job.score || 0))}
                    workMode={job.work_mode || job.remote_type || "Flexible"}
                    matchedSkills={matched}
                    missingSkills={missing}
                    applyUrl={job.apply_url}
                  />
                );
              })
            ) : (
              <div className="rounded-3xl bg-white border border-gray-200 p-8 text-center">
                <p className="text-gray-600">No job matches found yet. Complete your profile to improve recommendations.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <AnalyticsChart data={chartData} />

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Skill Gap Analysis</h3>
            {skillGapItems.length ? (
              <div className="space-y-4">
                {skillGapItems.map((item) => (
                  <div key={item.skill}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{item.skill}</span>
                      <span className="text-gray-500">Appears in {item.count} recommended jobs</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(100, item.count * 25)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">Upload your resume or add skills to see gaps and demand directly from matched jobs.</div>
            )}
            <button className="w-full mt-6 py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              Update Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
