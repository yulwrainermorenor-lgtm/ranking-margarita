import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share, Plus, Smartphone, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

export default function Install() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());
  const ios = isIOS();

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      toast.success("¡App instalada!");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setDeferred(null);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 md:space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
          Instalar la app
        </h1>
        <p className="text-sm text-muted-foreground">
          Añade Ranking PP a tu pantalla de inicio para abrirla como una app.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-5 md:p-6 flex flex-col items-center text-center gap-3">
        <div className="h-20 w-20 rounded-2xl overflow-hidden border-2 border-red-500/30 shadow-xl">
          <img src="/atemene-logo.jpg" alt="ATEMENE" className="w-full h-full object-cover" />
        </div>
        <h2 className="text-lg font-semibold">Ranking PP</h2>
        <p className="text-sm text-muted-foreground">
          Funciona como app nativa, se abre en pantalla completa y aparece en tu
          launcher.
        </p>

        {installed ? (
          <div className="text-sm text-primary font-medium">
            ✓ Ya está instalada en este dispositivo
          </div>
        ) : deferred ? (
          <Button onClick={install} size="lg" className="mt-2 gap-2">
            <Download className="h-4 w-4" />
            Instalar ahora
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            {ios
              ? "Sigue los pasos abajo desde Safari."
              : "Sigue los pasos abajo si no aparece el botón de instalar."}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          {ios ? "iPhone / iPad (Safari)" : "Android (Chrome)"}
        </h3>

        {ios ? (
          <ol className="space-y-3">
            <Step n={1} icon={<Share className="h-4 w-4" />}>
              Toca el botón <b>Compartir</b> en la barra inferior de Safari.
            </Step>
            <Step n={2} icon={<Plus className="h-4 w-4" />}>
              Selecciona <b>Añadir a pantalla de inicio</b>.
            </Step>
            <Step n={3} icon={<ChevronRight className="h-4 w-4" />}>
              Confirma con <b>Añadir</b>. La app aparecerá en tu pantalla.
            </Step>
          </ol>
        ) : (
          <ol className="space-y-3">
            <Step n={1} icon={<ChevronRight className="h-4 w-4" />}>
              Abre el menú de <b>Chrome</b> (los tres puntos arriba a la
              derecha).
            </Step>
            <Step n={2} icon={<Download className="h-4 w-4" />}>
              Toca <b>Instalar app</b> o <b>Añadir a pantalla de inicio</b>.
            </Step>
            <Step n={3} icon={<ChevronRight className="h-4 w-4" />}>
              Confirma. La app se instalará como una app normal.
            </Step>
          </ol>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        No es un APK tradicional, pero se instala y se ve igual que una app
        nativa, sin pasar por la Play Store.
      </p>
    </div>
  );
}

function Step({
  n,
  icon,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border bg-card p-3">
      <div className="h-7 w-7 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
        {n}
      </div>
      <div className="flex-1 text-sm leading-relaxed">{children}</div>
      <div className="text-muted-foreground mt-0.5">{icon}</div>
    </li>
  );
}
