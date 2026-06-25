import { authProviderLabels, type AuthProvider } from "@/lib/auth/types";
import { cn } from "@/lib/utils/cn";

type AuthProviderBadgeProps = {
  provider: AuthProvider;
  className?: string;
};

export function AuthProviderBadge({ provider, className }: AuthProviderBadgeProps) {
  if (provider !== "google") {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        className,
      )}
      style={{
        borderColor: "rgba(66,133,244,0.25)",
        background: "rgba(66,133,244,0.08)",
        color: "#3367D6",
      }}
    >
      {authProviderLabels.google}
    </span>
  );
}
