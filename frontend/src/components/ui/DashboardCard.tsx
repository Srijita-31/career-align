// frontend/src/components/ui/DashboardCard.tsx
"use client";

import { ReactNode } from "react";

interface DashboardCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
}

export default function DashboardCard({ title, value, icon }: DashboardCardProps) {
  return (
    <div className="bg-white/30 backdrop-blur-md rounded-xl border border-white/20 p-6 shadow-md transition-transform transform hover:scale-[1.02] hover:shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</h3>
        {icon && <div className="text-gray-500 dark:text-gray-300">{icon}</div>}
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
