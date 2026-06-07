"use client";

import * as React from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader } from "./Card";

interface AnalyticsChartProps {
  data?: { subject: string; A: number; fullMark: number }[];
}

export function AnalyticsChart({ data }: AnalyticsChartProps) {
  const defaultData = [
    { subject: 'Frontend', A: 85, fullMark: 100 },
    { subject: 'Backend', A: 65, fullMark: 100 },
    { subject: 'Database', A: 70, fullMark: 100 },
    { subject: 'DevOps', A: 40, fullMark: 100 },
    { subject: 'System Design', A: 55, fullMark: 100 },
    { subject: 'Algorithms', A: 90, fullMark: 100 },
  ];

  const chartData = data || defaultData;

  return (
    <Card className="w-full">
      <CardHeader>
        <h3 className="text-lg font-semibold text-gray-900">Skill Radar</h3>
        <p className="text-sm text-gray-500">Your profile's competency mapped against market demand.</p>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Radar name="Student Profile" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
