import { Sidebar } from "@/components/ui/Sidebar";
import { Navbar } from "@/components/ui/Navbar";
import DashboardContent from "./DashboardContent";

export default function Dashboard() {
  return (
    <div className="flex min-h-screen bg-gray-50 flex-col font-sans">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <DashboardContent />
        </main>
      </div>
    </div>
  );
}
