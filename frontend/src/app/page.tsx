import { redirect } from "next/navigation";

export default function Home() {
  // Automatically redirect the root route to the login page
  redirect("/login");
}
