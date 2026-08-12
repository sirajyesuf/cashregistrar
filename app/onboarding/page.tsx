import { redirect } from "next/navigation"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { QueryProvider } from "@/components/query-provider"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { WorkspaceProvider } from "@/components/workspace-provider"
import { getSessionUser } from "@/lib/auth/user"
import { getWorkspace } from "@/lib/workspace"

export default async function OnboardingPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const workspace = await getWorkspace(user.id)
  if (workspace) redirect("/dashboard")

  return (
    <div className="relative flex min-h-svh flex-col p-6">
      <div className="absolute top-4 right-4">
        <ThemeSwitcher />
      </div>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col py-8">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            CR
          </span>
          <div>
            <p className="text-base font-semibold tracking-tight">
              CashRegistrar
            </p>
            <p className="text-sm text-muted-foreground">
              Welcome, {user.name || user.email}. Let&apos;s set up your
              business.
            </p>
          </div>
        </div>
        <QueryProvider>
          <WorkspaceProvider>
            <OnboardingFlow />
          </WorkspaceProvider>
        </QueryProvider>
      </div>
    </div>
  )
}
