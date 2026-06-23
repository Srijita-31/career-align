"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MapPin, DollarSign, Briefcase, Building, TrendingUp, Send, Eye } from "lucide-react";

const SOURCE_COLORS: Record<string, string> = {
  linkedin: "bg-blue-100 text-blue-700",
  indeed: "bg-indigo-100 text-indigo-700",
  naukri: "bg-orange-100 text-orange-700",
  glassdoor: "bg-green-100 text-green-700",
  internshala: "bg-purple-100 text-purple-700",
  "weworkremotely": "bg-teal-100 text-teal-700",
  remoteok: "bg-cyan-100 text-cyan-700",
  wellfound: "bg-pink-100 text-pink-700",
  foundit: "bg-yellow-100 text-yellow-700",
};

const getSourceColor = (source: string) => {
  const key = source?.toLowerCase().replace(/\s+/g, "");
  return SOURCE_COLORS[key] || "bg-gray-100 text-gray-700";
};

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
  source_platform?: string;
  source?: string;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [jobs, setJobs] = useState<JobRecommendation[]>([]);
  const [appliedCount, setAppliedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState("");

  const loadAll = useCallback(async (isPoll = false) => {
    try {
      // Check scrape status
      const scrapeRes = await apiFetch<any>("/api/scrape-status").catch(() => null);
      const isRunning = scrapeRes?.scrape?.running === true;
      const jobCount = scrapeRes?.jobCount || 0;
      const hasJobs = jobCount > 0;
      setScraping(isRunning && !hasJobs);

      if (!isPoll || !isRunning || hasJobs) {
        const [profileRes, matchesRes, appsRes] = await Promise.allSettled([
          apiFetch<any>("/api/student/profile").catch(() => null),
          apiFetch<any>("/api/student/matches").catch(() => null),
          apiFetch<any>("/api/applications/my-applications").catch(() => null),
        ]);

        if (profileRes.status === "fulfilled" && profileRes.value) setProfile(profileRes.value.profile);
        if (matchesRes.status === "fulfilled" && matchesRes.value) setJobs(matchesRes.value.jobs || []);
        if (appsRes.status === "fulfilled" && appsRes.value) {
          const apps = Array.isArray(appsRes.value) ? appsRes.value : (appsRes.value.applications || []);
          setAppliedCount(apps.length);
        }
      }
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard");
    } finally {
      if (!isPoll) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(() => loadAll(true), 8000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const profileSkills = useMemo(() => {
    const skills = profile?.extracted_skills || profile?.skills || [];
    return Array.isArray(skills) ? skills : [];
  }, [profile]);

  const topJobs = useMemo(() => {
    return jobs.slice(0, 20);
  }, [jobs]);

  if (loading) {
    return (
      <ProtectedRoute requiredRole="student">
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-500">Loading your career dashboard...</p>
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute requiredRole="student">
        <div className="min-h-screen bg-gray-50 p-8">
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="student">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {profile?.full_name ? `Welcome, ${profile.full_name}` : "Your Dashboard"}
            </h1>
            <p className="text-gray-500 mt-1">
              Jobs matched from LinkedIn, Indeed, Naukri, Glassdoor, Internshala, and more.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{jobs.length}</p>
                  <p className="text-xs text-gray-500">Matches</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Send className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{appliedCount}</p>
                  <p className="text-xs text-gray-500">Applied</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{profileSkills.length}</p>
                  <p className="text-xs text-gray-500">Skills</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{profile?.profile_completion_percentage || 0}%</p>
                  <p className="text-xs text-gray-500">Profile</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profile Summary */}
          {profile && (
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-900">Your Profile</h3>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      {profile.full_name && <span><strong>Name:</strong> {profile.full_name}</span>}
                      {profile.college && <span><strong>College:</strong> {profile.college}</span>}
                      {profile.work_preference && <span><strong>Work Mode:</strong> {profile.work_preference}</span>}
                      {profile.location_preference && <span><strong>Location:</strong> {profile.location_preference}</span>}
                      {profile.experience_level && <span><strong>Seniority:</strong> {profile.experience_level}</span>}
                    </div>
                    {profileSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {profileSkills.slice(0, 8).map((s: string) => (
                          <Badge key={s} variant="info">{s}</Badge>
                        ))}
                        {profileSkills.length > 8 && (
                          <span className="text-xs text-gray-400 self-center">+{profileSkills.length - 8} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/student/profile/setup")}
                  >
                    Edit Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Job Recommendations from different sites */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Recommended Jobs</h2>
                <p className="text-sm text-gray-500">
                  Sourced from LinkedIn, Indeed, Naukri, Glassdoor, Internshala, WeWorkRemotely, RemoteOK, Wellfound, Foundit
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {topJobs.length > 0 ? (
                topJobs.map((job, i) => {
                  const required = Array.isArray(job.required_skills || job.skills) ? (job.required_skills || job.skills) : [];
                  const normalizedRequired = required.map((s: string) => s.toLowerCase());
                  const matched = profileSkills.filter((s: string) => normalizedRequired.includes(s.toLowerCase()));
                  const missing = required.filter((s: string) => !profileSkills.map((ps: string) => ps.toLowerCase()).includes(s.toLowerCase()));
                  const source = job.source_platform || job.source || "unknown";

                  return (
                    <Card key={`${job.title}-${job.company}-${job.location}-${i}`} className="hover:border-blue-200 hover:shadow-md transition-all">
                      <CardContent className="p-5 sm:p-6">
                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 border">
                                <Building className="w-5 h-5 text-gray-400" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-base font-semibold text-gray-900 truncate">{job.title}</h3>
                                <p className="text-sm text-gray-600">{job.company}</p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location || "Remote"}</span>
                                  <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{job.work_mode || job.remote_type || "Flexible"}</span>
                                  {job.salary && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{job.salary}</span>}
                                </div>
                              </div>
                            </div>

                            {matched.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {matched.slice(0, 4).map((s: string) => (
                                  <Badge key={s} variant="success" className="text-[11px]">{s}</Badge>
                                ))}
                              </div>
                            )}

                            {missing.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {missing.slice(0, 3).map((s: string) => (
                                  <Badge key={s} variant="warning" className="text-[11px] bg-orange-50 text-orange-700">{s}</Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 sm:gap-2 flex-shrink-0">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSourceColor(source)}`}>
                              {source}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-400">Match</span>
                              <span className={`w-10 h-10 rounded-full border-4 flex items-center justify-center text-xs font-bold ${
                                job.score >= 80 ? "border-green-200 text-green-700 bg-green-50" :
                                job.score >= 50 ? "border-yellow-200 text-yellow-700 bg-yellow-50" :
                                "border-gray-200 text-gray-600 bg-gray-50"
                              }`}>
                                {Math.round(job.score)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                          {job.apply_url ? (
                            <a href={job.apply_url} target="_blank" rel="noreferrer noopener">
                              <Button type="button" size="sm">Apply on {source}</Button>
                            </a>
                          ) : (
                            <Button type="button" size="sm" disabled>Apply Now</Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    {scraping ? (
                      <>
                        <div className="flex justify-center mb-4">
                          <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        </div>
                        <p className="text-gray-700 font-medium">Fetching live jobs from various platforms...</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Scraping LinkedIn, Indeed, Naukri, Glassdoor, Internshala, and more. This may take a minute.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-500">No job matches found yet.</p>
                        <p className="text-sm text-gray-400 mt-1">
                          Complete your profile setup with skills and preferences to get personalized recommendations.
                        </p>
                        <Button
                          type="button"
                          className="mt-4"
                          onClick={() => router.push("/student/profile/setup")}
                        >
                          Setup Profile
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}