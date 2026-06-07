import * as React from "react";
import { Search, Bell, Menu } from "lucide-react";
import { Logo } from "./Logo";

export function Navbar() {
  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 z-10 relative">
      <div className="flex items-center gap-4 lg:hidden">
        <button className="text-gray-500 hover:text-gray-900 focus:outline-none">
          <Menu className="w-6 h-6" />
        </button>
        <Logo />
      </div>
      
      <div className="hidden lg:flex items-center gap-8">
        <Logo />
        <div className="relative w-96 hidden md:block">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search jobs, skills, companies..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm placeholder-gray-500 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="text-gray-400 hover:text-gray-500 relative">
          <Bell className="w-6 h-6" />
          <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
      </div>
    </header>
  );
}
