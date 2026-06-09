// src/components/ProtectedRoute.tsx
"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string; // e.g., "student", "recruiter", "admin"
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const router = useRouter();

  useEffect(() => {
    // Attempt to fetch authenticated user info via HttpOnly cookie
    const verifyAuth = async () => {
      try {
        const data = await apiFetch<{ user: { role: string } }>('/api/auth/me');
        const role = data.user.role?.toLowerCase();
        if (requiredRole && role !== requiredRole) {
          // redirect based on actual role
          switch (role) {
            case 'student':
              router.replace('/student/dashboard');
              break;
            case 'recruiter':
            case 'company':
              router.replace('/recruiter/dashboard');
              break;
            case 'admin':
              router.replace('/admin/dashboard');
              break;
            default:
              router.replace('/login');
          }
          return;
        }
        // user is authenticated and role matches (or no role required)
      } catch (err) {
        // Not authenticated
        router.replace('/login');
      }
    };
    verifyAuth();
  }, [router, requiredRole]);

  // While checking, render nothing (or a simple loading state)
  return <>{children}</>;
}
