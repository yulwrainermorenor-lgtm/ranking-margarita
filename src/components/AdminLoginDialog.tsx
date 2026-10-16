import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, LogIn, LogOut, KeyRound, UserPlus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

interface AdminLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminLoginDialog({ open, onOpenChange }: AdminLoginDialogProps) {
  const { isAdmin, adminEmail, loginAsAdmin, signOut, adminEmailsList, addAdminEmail, removeAdminEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [showEmailManager, setShowEmailManager] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    const ok = loginAsAdmin(email, pin);
    if (ok) {
      toast.success(`Sesión de administrador iniciada`);
      onOpenChange(false);
      setEmail("");
      setPin("");
    } else {
      setError(true);
      toast.error("Correo o clave de administrador no autorizada");
    }
  };

  const handleLogout = () => {
    signOut();
    toast.success("Sesión de administrador cerrada");
    onOpenChange(false);
  };

  const handleAddEmail = () => {
    const emailToAdd = newAdminEmail.trim().toLowerCase();
    if (!emailToAdd || !emailToAdd.includes("@")) {
      toast.error("Ingresa un correo válido");
      return;
    }
    if (adminEmailsList.some((e) => e.toLowerCase() === emailToAdd)) {
      toast.error("Ese correo ya está en la lista");
      return;
    }
    addAdminEmail(emailToAdd);
    setNewAdminEmail("");
    toast.success(`${emailToAdd} agregado como administrador`);
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    if (adminEmailsList.length <= 1) {
      toast.error("No puedes eliminar el único administrador");
      return;
    }
    if (adminEmail?.toLowerCase() === emailToRemove.toLowerCase()) {
      toast.error("No puedes eliminarte a ti mismo mientras tienes sesión activa");
      return;
    }
    removeAdminEmail(emailToRemove);
    toast.success(`${emailToRemove} eliminado de administradores`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white font-bold text-lg">
            <ShieldCheck className="h-5 w-5 text-red-500" />
            {isAdmin ? "Panel de Administrador" : "Acceso Administrador"}
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            {isAdmin
              ? `Sesión activa como: ${adminEmail}`
              : "Ingresa tu correo autorizado para habilitar carga de partidos e importación."}
          </DialogDescription>
        </DialogHeader>

        {isAdmin ? (
          <div className="space-y-4 py-3">
            {/* Permissions list */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-white/10 space-y-2 text-xs">
              <div className="text-zinc-400 font-medium">Permisos habilitados:</div>
              <ul className="list-disc pl-4 text-zinc-200 space-y-1">
                <li>Cargar resultados de partidos oficiales</li>
                <li>Registrar nuevos atletas al ranking</li>
                <li>Importar y exportar archivos Excel/CSV</li>
                <li>Editar atletas y revertir partidos</li>
              </ul>
            </div>

            {/* Manage Admin Emails toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEmailManager(!showEmailManager)}
              className="w-full border-white/10 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 gap-2 text-xs"
            >
              <Users className="h-3.5 w-3.5 text-red-400" />
              {showEmailManager ? "Ocultar gestión de admins" : "Gestionar Correos de Admin"}
            </Button>

            {showEmailManager && (
              <div className="rounded-xl border border-white/10 bg-zinc-950 p-4 space-y-3">
                <div className="text-xs font-bold uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Correos Autorizados
                </div>

                {/* Current admin list */}
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {adminEmailsList.map((e) => (
                    <div key={e} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/5">
                      <span className="text-xs text-zinc-300 truncate flex-1">{e}</span>
                      <button
                        onClick={() => handleRemoveEmail(e)}
                        className="text-zinc-600 hover:text-red-400 transition-colors shrink-0 p-0.5"
                        title="Eliminar admin"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new admin */}
                <div className="flex gap-2 pt-1">
                  <Input
                    type="email"
                    placeholder="nuevo@correo.com"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
                    className="bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 text-xs h-8"
                  />
                  <Button
                    onClick={handleAddEmail}
                    size="sm"
                    className="h-8 bg-red-600 hover:bg-red-500 text-white text-xs gap-1 px-3 shrink-0"
                  >
                    <UserPlus className="h-3 w-3" />
                    Agregar
                  </Button>
                </div>
                <p className="text-[10px] text-zinc-500">
                  Los cambios se guardan localmente. El PIN 1234 siempre funciona como acceso de emergencia.
                </p>
              </div>
            )}

            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold gap-2"
            >
              <LogOut className="h-4 w-4" /> Cerrar Sesión de Administrador
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-zinc-400">Correo Electrónico de Admin</Label>
              <Input
                type="email"
                placeholder="ej. feteneme@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-zinc-950 border-white/10 text-white placeholder:text-zinc-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-zinc-400">Clave o PIN de Acceso</Label>
              <Input
                type="password"
                placeholder="Clave de admin o PIN de emergencia"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="bg-zinc-950 border-white/10 text-white placeholder:text-zinc-500"
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20 flex items-start gap-2">
                <KeyRound className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Correo no autorizado o clave incorrecta.
                  Contacta al administrador principal para obtener acceso.
                </span>
              </div>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-zinc-400 hover:text-white">
                Cancelar
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-500 text-white font-bold gap-1.5">
                <LogIn className="h-4 w-4" /> Ingresar como Admin
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
