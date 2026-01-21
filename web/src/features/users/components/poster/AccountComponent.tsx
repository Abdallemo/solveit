"use client";

import { CardWrapper } from "@/components/card-wrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import useCurrentUser from "@/hooks/useCurrentUser";
import { Bell, CreditCard, Loader2, Mail } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useTransition } from "react";
import AccountSubscption from "../Account-subscption";

import UserPreferencesLoading from "@/app/dashboard/poster/account/loading";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DeleteUserAccount } from "@/features/auth/server/actions";
import {
  cardsType,
  ManageUserCreditCardPortal,
} from "@/features/payments/server/action";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
export default function AccountComponent({
  isOauthUser,
  cards,
}: {
  isOauthUser: boolean;
  cards: cardsType;
}) {
  const { user, state: isLoading } = useCurrentUser();
  const [emailNotification, SetEmailNotification] = useState<boolean>(true);
  const [pushNotification, setPushNotification] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const formSchema = z
    .object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
      confirmPassword: z.string().min(1, "Please confirm your password"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });
  const { mutateAsync: changePasswordAction, isPending: isChanginPassword } =
    useMutation({
      mutationFn: async (data: z.infer<typeof formSchema>) => {
        return await authClient.changePassword({
          newPassword: data.newPassword,
          currentPassword: data.currentPassword,
        });
      },
      onSuccess: ({ data, error }) => {
        if (error) {
          toast.error(error.message, { id: "change-password" });
          return;
        }
        toast.success("successfully changed ");
        form.reset();
      },
    });
  const { mutateAsync: updateName, isPending: isUpdatingName } = useMutation({
    mutationFn: async (name: string) => {
      return await authClient.updateUser({
        name: name,
      });
    },
    onSuccess: ({ data, error }) => {
      if (error) {
        toast.error(error.message, { id: "change-password" });
        return;
      }
      toast.success("successfully updated ");
    },
  });
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const { mutateAsync: DeleteAccountMutation, isPending: isDeleting } =
    useMutation({
      mutationFn: DeleteUserAccount,
      onSuccess: async () => {
        await authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/login");
            },
          },
        });
      },
      // onError: () =>
      //   toast.error("something went wrong try again", {
      //     action: {
      //       label: <RotateCcw size={"10"} />,
      //       onClick: async () => {
      //         await DeleteAccountMutation();
      //       },
      //     },
      //   }),
    });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    await changePasswordAction(data);
  };
  if (isLoading) return <UserPreferencesLoading />;
  return (
    <div className="w-full  my-5" suppressHydrationWarning>
      <div className="flex flex-col items-center gap-5 px-6 ">
        <CardWrapper
          title="User Preferences"
          description="Manage your profiles, account settings, and preferences for your
              experience."
          footer={
            <>
              <Button
                variant={"secondary"}
                onClick={() => toast.error("cancled")}
              >
                cancel
              </Button>
              <Button variant={"success"} onClick={() => updateName(newName)}>
                save
              </Button>
            </>
          }
          sections={[
            {
              title: "Profile Information",
              children: (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      defaultValue={user?.name ?? ""}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                    <Label htmlFor="email">Email</Label>
                    <Input
                      disabled
                      id="email"
                      type="email"
                      defaultValue={user?.email ?? ""}
                    />
                  </div>
                </>
              ),
            },
          ]}
        />
        <CardWrapper
          title="Notification Settings"
          sections={[
            {
              children: (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <Label htmlFor="email-notifications">
                        Email Notifications
                      </Label>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={emailNotification}
                      onCheckedChange={() =>
                        SetEmailNotification((prev) => !prev)
                      }
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        <Label htmlFor="push-notifications">
                          Push Notifications
                        </Label>
                      </div>
                      <Switch
                        id="push-notifications"
                        checked={pushNotification}
                        onCheckedChange={() =>
                          setPushNotification((prev) => !prev)
                        }
                      />
                    </div>
                  </div>
                </div>
              ),
            },
          ]}
          footer={
            <>
              <Button
                variant={"secondary"}
                onClick={() => toast.error("cancled")}
              >
                cancel
              </Button>
              <Button
                variant={"success"}
                onClick={() => toast.success("saved")}
              >
                save
              </Button>
            </>
          }
        />
        <CardWrapper
          title="Appearance"
          description="Choose from themes that look best to you. Select a single theme,
              or sync with your system."
          footer={"Your selected theme will be used across the application."}
          sections={[
            {
              children: (
                <div className="space-y-4">
                  <RadioGroup
                    value={theme}
                    onValueChange={(value) => setTheme(value)}
                    className="grid grid-cols-3 gap-4"
                  >
                    <div>
                      <RadioGroupItem
                        value="dark"
                        id="dark"
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor="dark"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <span>Dark</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem
                        value="light"
                        id="light"
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor="light"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <span>Light</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem
                        value="system"
                        id="system"
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor="system"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <span>System</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              ),
            },
          ]}
        />

        {!isOauthUser && (
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="contents">
              <CardWrapper
                title="Security"
                sections={[
                  {
                    children: (
                      <div className="flex flex-col gap-3 w-full">
                        <FormField
                          control={form.control}
                          name="currentPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Current Password</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="password"
                                  disabled={isOauthUser}
                                  autoComplete="current-password"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="newPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New Password</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="password"
                                  disabled={isOauthUser}
                                  autoComplete="new-password"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm Password</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="password"
                                  disabled={isOauthUser}
                                  autoComplete="new-password"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ),
                  },
                ]}
                footer={
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        form.reset();
                        toast.error("Cancelled");
                      }}
                      disabled={isChanginPassword}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="success"
                      disabled={isOauthUser || isChanginPassword}
                    >
                      {isChanginPassword ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <>Save</>
                      )}
                    </Button>
                  </>
                }
              />
            </form>
          </FormProvider>
        )}
        <CardWrapper
          title="Payment Methods"
          sections={[
            {
              children:
                cards.length > 0 &&
                cards.map((card) => (
                  <div
                    className="flex items-center justify-between"
                    key={card.id}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-16 rounded bg-muted flex items-center justify-center">
                        <CreditCard className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          •••• •••• •••• {card.last4}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Expires {card.exp_month}/{card.exp_year}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">{card.brand}</Badge>
                  </div>
                )),
            },
          ]}
          footer={
            <Button
              variant="outline"
              className="w-full"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const url = (await ManageUserCreditCardPortal())!;
                  router.push(url);
                })
              }
            >
              {isPending && <Loader2 className="animate-spin" />}
              Add Payment Method
            </Button>
          }
          footerClassName="flex flex-col"
        />

        <AccountSubscption />

        <AlertDialog open={open || isDeleting} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="cursor-pointer  w-full max-w-4xl "
            >
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your
                account and remove your data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="w-full ">
              <AlertDialogCancel className="cursor-pointer w-1/2">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await DeleteAccountMutation();
                }}
                disabled={isDeleting}
                className="cursor-pointer bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 w-1/2"
              >
                {isDeleting && <Loader2 className="animate-spin" />}
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
