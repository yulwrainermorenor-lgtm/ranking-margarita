import { useTheme } from "@/hooks/useTheme";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "dark" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-zinc-900 group-[.toaster]:text-white group-[.toaster]:border-white/10 group-[.toaster]:shadow-2xl",
          description: "group-[.toast]:text-zinc-400",
          actionButton: "group-[.toast]:bg-red-600 group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-zinc-800 group-[.toast]:text-zinc-400",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
