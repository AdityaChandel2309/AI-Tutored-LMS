"use client";

import { Suspense, useEffect } from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function exchangeCode() {
      const code = searchParams.get("code");

      if (!code) {
        router.replace("/");
        return;
      }

      try {
        const response = await fetch(
          "/api/auth/callback",

          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              code,
              redirect_uri:
                window.location.origin +
                "/callback",
            }),
          },
        );

        if (!response.ok) {
          throw new Error(
            "Failed to establish session",
          );
        }

        router.replace("/dashboard");
      } catch (error) {
        console.error(error);

        router.replace("/");
      }
    }

    exchangeCode();
  }, [router, searchParams]);

  return <div className="p-8">Logging in...</div>;
}

export default function CallbackPage() {
  return (
    <Suspense fallback={<div className="p-8">Logging in...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
