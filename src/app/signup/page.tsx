import AuthForm from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <AuthShell
      side={{
        title: "“I used to lose sleep over unpaid invoices. Now I just watch the replies come in.”",
        sub: "Follow-ups that happen without you — polite where it counts, firm when it matters, and paused the moment a customer replies.",
      }}
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
