import * as React from "react";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm font-bold text-lg leading-none">
        C
      </div>
      <span className="font-bold text-xl tracking-tight text-gray-900">Career Align</span>
    </div>
  );
}
