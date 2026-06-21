"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<string>('student');

  React.useEffect(() => {
    const storageValue = typeof window !== 'undefined' ? window.localStorage.getItem("careerAlignUser") : null;
    if (storageValue) {
      try {
        const parsed = JSON.parse(storageValue);
        setUserEmail(parsed?.email || null);
        setRole((parsed?.role || 'student').toLowerCase());
      } catch {
        setUserEmail(null);
        setRole('student');
      }
    }
  }, []);

  const dashboardHref = role === 'company' || role === 'recruiter' ? '/recruiter/dashboard' : role === 'admin' ? '/admin/dashboard' : '/student/dashboard';

  const navItems = [
    { label: "Dashboard", href: dashboardHref, icon: LayoutDashboard },
    ...(role === 'admin' ? [
      { label: "Students", href: "/admin/students", icon: LayoutDashboard },
      { label: "Recruiters", href: "/admin/recruiters", icon: LayoutDashboard },
      { label: "Jobs", href: "/admin/jobs", icon: LayoutDashboard },
      { label: "Applications", href: "/admin/applications", icon: LayoutDashboard },
    ] : []),
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen hidden md:flex flex-col">
      <div className="p-4 flex-1">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-blue-600" : "text-gray-400"}`} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold uppercase">
            {userEmail ? userEmail.charAt(0) : "S"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userEmail ? userEmail.split("@")[0] : "Student"}</p>
            <p className="text-xs text-gray-500 truncate">{userEmail || "Not signed in"}</p>
          </div>
        </div>
        {userEmail && (
          <div className="mt-2 px-3">
            <button 
              onClick={() => {
                localStorage.removeItem('jwt');
                localStorage.removeItem('careerAlignUser');
                window.location.href = '/login';
              }}
              className="w-full text-left text-sm text-red-600 hover:text-red-700 font-medium py-1"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
