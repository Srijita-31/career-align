import Link from "next/link";

export default function Landing() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
      <div className="max-w-2xl w-full p-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-6">Welcome to Career Align</h1>
        <p className="text-lg text-gray-700 mb-8">
          Your journey to the perfect role starts here. Sign in or create an account as a Student or Recruiter.
        </p>
        <div className="flex flex-col gap-4 md:flex-row justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Login
          </Link>
          <Link
            href="/register/student"
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Register as Student
          </Link>
          <Link
            href="/register/recruiter"
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Register as Recruiter
          </Link>
        </div>
      </div>
    </main>
  );
}
