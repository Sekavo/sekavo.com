import AuthForm from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthShell
      side={{
        title: "Every unpaid invoice, chased in the right tone at the right time.",
        sub: "Receivables overview · escalating sequences · reply detection · payment links — one calm dashboard for the work you hate.",
      }}
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
