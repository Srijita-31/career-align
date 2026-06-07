import { Sidebar } from "@/components/ui/Sidebar";
import { Navbar } from "@/components/ui/Navbar";
import { JobCard } from "@/components/ui/JobCard";
import { AnalyticsChart } from "@/components/ui/AnalyticsChart";

export default function Dashboard() {
  const recommendedJobs = [
    {
      title: "Senior Frontend Engineer",
      company: "TechCorp Global",
      location: "San Francisco, CA",
      salary: "$140k - $180k",
      matchPercentage: 92,
      workMode: "Remote",
      matchedSkills: ["React", "TypeScript", "Next.js", "Tailwind CSS"],
      missingSkills: ["GraphQL"]
    },
    {
      title: "Full Stack Developer",
      company: "Innovate AI",
      location: "New York, NY",
      salary: "$120k - $150k",
      matchPercentage: 78,
      workMode: "Hybrid",
      matchedSkills: ["React", "Node.js", "Express"],
      missingSkills: ["Python", "PostgreSQL"]
    },
    {
      title: "UI/UX Engineer",
      company: "Design Systems Inc.",
      location: "Austin, TX",
      matchPercentage: 65,
      workMode: "Onsite",
      matchedSkills: ["React", "CSS"],
      missingSkills: ["Figma", "Storybook", "Framer Motion"]
    }
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 flex-col font-sans">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
              <p className="text-gray-500 mt-1">Here is what is happening with your job search today.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Recommended Jobs</h2>
                  <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-500">View all matches</a>
                </div>
                
                <div className="space-y-4">
                  {recommendedJobs.map((job, idx) => (
                    <JobCard key={idx} {...job} />
                  ))}
                </div>
              </div>

              <div className="space-y-8">
                <AnalyticsChart />
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Skill Gap Analysis</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">GraphQL</span>
                        <span className="text-gray-500">High Demand</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">Python</span>
                        <span className="text-gray-500">Medium Demand</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-blue-400 h-2 rounded-full" style={{ width: '60%' }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">Storybook</span>
                        <span className="text-gray-500">Low Demand</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-blue-300 h-2 rounded-full" style={{ width: '30%' }}></div>
                      </div>
                    </div>
                  </div>
                  <button className="w-full mt-6 py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                    Explore Learning Paths
                  </button>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
