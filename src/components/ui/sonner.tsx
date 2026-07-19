import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { useEffect } from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  // Dismiss all toasts on any user interaction (tap/click/keypress)
  useEffect(() => {
    const dismiss = () => toast.dismiss();
    const events = ["pointerdown", "keydown"];
    // Small delay so the toast can appear before listeners activate
    const timer = setTimeout(() => {
      events.forEach((e) => document.addEventListener(e, dismiss, { passive: true }));
    }, 100);
    return () => {
      clearTimeout(timer);
      events.forEach((e) => document.removeEventListener(e, dismiss));
    };
  }, []);

  return (
    <Sonner
      position="top-center"
      offset={0}
      mobileOffset={{ bottom: "auto", left: 16, right: 16 }}
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={{ width: "auto" }}
      duration={Infinity}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:!bg-card group-[.toaster]:!border group-[.toaster]:!border-border group-[.toaster]:!shadow-lg group-[.toaster]:!w-auto group-[.toaster]:!min-w-0 group-[.toaster]:!max-w-[320px] group-[.toaster]:!mx-auto group-[.toaster]:!px-5 group-[.toaster]:!py-3 group-[.toaster]:!text-sm group-[.toaster]:!rounded-xl group-[.toaster]:!flex group-[.toaster]:!items-center group-[.toaster]:!gap-2 group-[.toaster]:!animate-toast-in group-[.toaster]:!text-foreground group-[.toaster]:!font-medium group-[.toaster]:!text-center",
          error:
            "group-[.toaster]:!bg-destructive/10 group-[.toaster]:!border-destructive/20 group-[.toaster]:!text-destructive",
          success:
            "group-[.toaster]:!bg-[hsl(var(--success)/0.1)] group-[.toaster]:!border-[hsl(var(--success)/0.2)] group-[.toaster]:!text-[hsl(var(--success))]",
          warning:
            "group-[.toaster]:!bg-[hsl(var(--warning)/0.1)] group-[.toaster]:!border-[hsl(var(--warning)/0.2)] group-[.toaster]:!text-[hsl(var(--warning))]",
          info:
            "group-[.toaster]:!bg-primary/10 group-[.toaster]:!border-primary/20 group-[.toaster]:!text-primary",
          description: "group-[.toast]:!text-muted-foreground",
          actionButton: "group-[.toast]:!bg-primary group-[.toast]:!text-primary-foreground",
          cancelButton: "group-[.toast]:!bg-muted group-[.toast]:!text-muted-foreground",
          closeButton: "!hidden",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
