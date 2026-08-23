import AuthForm from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <AuthShell
      side={{
        title: "“I used to lose sleep over unpaid invoices. Now I just watch the replies come in.”",
        sub: "Paidhound chases politely, escalates professionally, and knows when to stop — so your relationships stay intact while your cash arrives faster.",
      }}
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
