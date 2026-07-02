"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, setIsPending] =
    useState(false);

  async function logout() {
    try {
      setIsPending(true);

      const response = await fetch(
        "/api/auth/logout",
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      const data =
        (await response.json()) as {
          redirectUrl: string;
        };

      window.location.href = data.redirectUrl;
    } catch {
      setIsPending(false);
    }
  }

  return (
    <Button
      onClick={logout}
      disabled={isPending}
      variant="danger"
    >
      {isPending ? "Logging out..." : "Logout"}
    </Button>
  );
}
