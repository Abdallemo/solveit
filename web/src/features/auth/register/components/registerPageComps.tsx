"use client";

import Logo from "@/components/marketing/logo";
import FeaturePanelWithAnimation from "@/features/auth/components/feature-panel";
import RegisterCard from "@/features/auth/register/components/regsiterCard";
import {
  registerFormSchema,
  registerInferedTypes,
} from "@/features/auth/server/auth-types";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
export default function RegisterPage() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const submitHandler = async (values: registerInferedTypes) => {
    startTransition(async () => {
      setError("");
      setSuccess("");
      try {
        if (!captchaToken) {
          setError("Please complete the captcha");
          return;
        }

        const { data, error } = await authClient.signUp.email({
          email: values.email,
          password: values.password,
          name: values.name,
          fetchOptions: {
            headers: {
              "x-captcha-response": captchaToken,
            },
          },
        });

        if (error) {
          setError(error.message!);
          return;
        }

        setSuccess("Account created! Please check your email.");
        myformController.reset();
      } catch (e) {}
    });
  };

  const myformController = useForm<registerInferedTypes>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });
  return (
    <div className="flex w-full h-screen ">
      <div className="flex bg-sidebar w-full h-screen justify-center items-center relative">
        <div className="absolute top-6 left-6">
          <Logo />
        </div>

        <RegisterCard
          myformController={myformController}
          submitHandler={submitHandler}
          isPending={isPending}
          error={error}
          success={success}
          setCaptchaToken={setCaptchaToken}
          captchaToken={captchaToken}
        />
      </div>
      <div className="inset-0 md:flex items-center justify-center w-full hidden">
        <FeaturePanelWithAnimation />
      </div>
    </div>
  );
}
