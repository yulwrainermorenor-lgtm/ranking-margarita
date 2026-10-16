import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Auth() {
  const navigate = useNavigate();
  const { loginAsAdmin } = useAuth();
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = loginAsAdmin(email);
    if (!ok) {
      toast.error("Correo no autorizado como administrador");
      return;
    }
    toast.success("Sesión de administrador iniciada");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-red-500/40 shadow-lg">
            <img src="/atemene-logo.jpg" alt="ATEMENE" className="w-full h-full object-cover" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Ranking PP</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Iniciá sesión para administrar partidos
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full">Ingresar</Button>        </form>

        <button
          onClick={() => navigate("/")}
          className="block mx-auto text-sm text-muted-foreground hover:text-foreground"
        >
          Continuar sin sesión
        </button>
      </div>
    </div>
  );
}
