"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { FaGithub } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { toast } from "sonner";

type Provider = "github" | "google";
type SocialButtonProps = {
  captchaToken: string | null;
};
export default function SocialButtons({ captchaToken }: SocialButtonProps) {
  const [pendingProviders, setPendingProviders] = useState<
    Record<Provider, boolean>
  >({
    github: false,
    google: false,
  });

  const handleSignIn = async (provider: Provider) => {
    if (!captchaToken) {
      toast.error("Please complete the captcha verification first.");
      return;
    }

    setPendingProviders((prev) => ({ ...prev, [provider]: true }));

    try {
      await signIn.social({
        provider: provider,
        callbackURL: "/dashboard",
        fetchOptions: {
          headers: {
            "x-captcha-response": captchaToken,
          },
        },
      });
    } catch (error) {
      console.error(`Error signing in with ${provider}:`, error);
    } finally {
      setPendingProviders((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const renderAuthButton = (provider: Provider, icon: React.ReactNode) => {
    const isPending = pendingProviders[provider];

    return (
      <Button
        className="py-6 flex-1 "
        variant="outline"
        disabled={isPending}
        onClick={() => handleSignIn(provider)}
      >
        {isPending && <Loader2 className="h-5 w-5 animate-spin" />}
        {!isPending && icon}
        {provider.charAt(0).toUpperCase() + provider.slice(1)}
      </Button>
    );
  };

  return (
    <div className="flex gap-2 w-full">
      {renderAuthButton("github", <FaGithub className="h-5 w-5" />)}
      {renderAuthButton("google", <FcGoogle className="h-5 w-5" />)}
    </div>
  );
}
