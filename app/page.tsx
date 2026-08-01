import Link from "next/link"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="absolute right-4 top-4">
        <ThemeSwitcher />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold">CashRegistrar</h1>
        <p className="mt-2 text-muted-foreground">Invoice Generator</p>
      </div>
      <div className="flex gap-4">
        <Link href="/login">
          <Button variant="outline" size="lg">
            Sign In
          </Button>
        </Link>
        <Link href="/register">
          <Button size="lg">Create Account</Button>
        </Link>
      </div>
    </div>
  )
}
