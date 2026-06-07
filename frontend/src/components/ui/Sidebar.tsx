"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, FileText, FileCheck, LineChart, Settings } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Jobs", href: "/dashboard/jobs", icon: Briefcase },
    { label: "Applications", href: "/dashboard/applications", icon: FileCheck },
    { label: "Resume", href: "/dashboard/resume", icon: FileText },
    { label: "Analytics", href: "/dashboard/analytics", icon: LineChart },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
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
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
            S
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">Student User</p>
            <p className="text-xs text-gray-500 truncate">student@university.edu</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
