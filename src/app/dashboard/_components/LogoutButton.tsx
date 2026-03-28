'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton({
  variant = "solid",
  className,
}: {
  variant?: "solid" | "link";
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={[
        "text-sm font-semibold rounded-xl inline-flex items-center gap-2 disabled:opacity-60",
        variant === "link"
          ? "bg-transparent text-white/90 hover:bg-white/10 border border-transparent"
          : "border border-transparent bg-[#0B64C0] text-white px-3 py-2 hover:bg-[#0958a7]",
        variant === "link" ? "px-2 py-2" : "",
        className ?? "",
      ].join(" ")}
    >
      {loading ? (
        <>
          <LogOut size={16} />
          Saindo...
        </>
      ) : (
        <>
          <LogOut size={16} />
          Sair
        </>
      )}
    </button>
  );
}

