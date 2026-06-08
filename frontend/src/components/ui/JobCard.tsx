import * as React from "react";
import { MapPin, DollarSign, Briefcase, Building } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card, CardContent } from "./Card";

interface JobCardProps {
  title: string;
  company: string;
  location: string;
  salary?: string;
  matchPercentage: number;
  matchedSkills: string[];
  missingSkills: string[];
  workMode: string;
  applyUrl?: string;
}

export function JobCard({
  title,
  company,
  location,
  salary,
  matchPercentage,
  matchedSkills,
  missingSkills,
  workMode,
  applyUrl
}: JobCardProps) {
  return (
    <Card className="hover:border-blue-200 hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
              <Building className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 leading-tight">{title}</h3>
              <div className="text-sm text-gray-600 mt-1">{company}</div>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {location}</span>
                <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4" /> {workMode}</span>
                {salary && <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> {salary}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500">Match Score</span>
              <div className={`flex items-center justify-center w-12 h-12 rounded-full border-4 font-bold text-sm ${
                matchPercentage >= 80 ? "border-green-100 text-green-700 bg-green-50" :
                matchPercentage >= 50 ? "border-yellow-100 text-yellow-700 bg-yellow-50" :
                "border-gray-100 text-gray-700 bg-gray-50"
              }`}>
                {matchPercentage}%
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 mt-4">
          <div className="mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Matched Skills</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {matchedSkills.map(skill => (
                <Badge key={skill} variant="success">{skill}</Badge>
              ))}
              {matchedSkills.length === 0 && <span className="text-sm text-gray-400">None</span>}
            </div>
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Missing Skills</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {missingSkills.map(skill => (
                <Badge key={skill} variant="warning" className="bg-orange-50 text-orange-700">{skill}</Badge>
              ))}
              {missingSkills.length === 0 && <span className="text-sm text-gray-400">None</span>}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
          {applyUrl ? (
            <a href={applyUrl} target="_blank" rel="noreferrer noopener">
              <Button type="button">Apply Now</Button>
            </a>
          ) : (
            <Button type="button" disabled>
              Apply Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
