"use client";

import Logo from "@/components/marketing/logo";
import FeaturePanelWithAnimation from "@/features/auth/components/feature-panel";
import LoginCard from "@/features/auth/login/components/LoginCard";
import {
  loginFormSchema,
  loginInferedTypes,
} from "@/features/auth/server/auth-types";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

export default function LoginPage() {
  const searchParms = useSearchParams();
  const oAuthConflictError =
    searchParms.get("error") === "OAuthAccountNotLinked"
      ? "Email already in Use with different provider"
      : "";

  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const submitHandler = async (values: loginInferedTypes) => {
    startTransition(async () => {
      setError("");
      setSuccess("");

      myformController.reset();

      if (!captchaToken) {
        setError("Please complete the captcha");
        return;
      }
      await authClient.signIn.email({
        email: values.email,
        password: values.password,
        callbackURL: "/dashboard",
        fetchOptions: {
          headers: {
            "x-captcha-response": captchaToken,
          },
          onError: (ctx) => {
            setError(ctx.error.message);
          },
        },
      });
    });
  };

  const myformController = useForm<loginInferedTypes>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  return (
    <div className="flex w-full h-screen ">
      <div className="relative  w-full h-screen flex  justify-center items-center">
        <div className=" absolute top-6 left-6">
          <Logo />
        </div>

        <LoginCard
          myformController={myformController}
          submitHandler={submitHandler}
          error={error || oAuthConflictError}
          success={success}
          isPending={isPending}
          setCaptchaToken={setCaptchaToken}
          captchaToken={captchaToken}
        />
      </div>

      <div className="inset-0 md:flex items-center justify-center w-full from-primary/5 via-background to-accent/10 overflow-hidden hidden">
        <FeaturePanelWithAnimation />
      </div>
    </div>
  );
}
