"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "@tanstack/react-form"
import { ArrowLeft, Building2, Eye, EyeOff, Store } from "lucide-react"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { toast } from "@/components/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { adminUserSchema } from "@/lib/admin-user-schema"
import {
  TEST_BUSINESS_NAME,
  TEST_MOR_CREDENTIALS,
  TEST_SELLER_FIELDS,
} from "@/lib/test-mor"

export default function AddUserPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [submitMode, setSubmitMode] = useState<"close" | "another">("close")
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "OWNER" as "ADMIN" | "OWNER",
      business: {
        name: "",
        address: "",
        city: "",
        email: "",
        phone: "",
        region: "",
        wereda: "",
      },
      morCredential: {
        tin: "",
        vatNumber: "",
        clientId: "",
        clientSecret: "",
        apiKey: "",
        systemNumber: "",
        systemType: "POS",
      },
      branch: {
        name: "Main Branch",
        address: "",
      },
    },
    validators: {
      onChange: adminUserSchema,
      onSubmit: adminUserSchema,
    },
    onSubmit: async ({ value }) => {
      setError(null)
      try {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        })
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        if (!res.ok) {
          throw new Error(body.error ?? `Failed to create user (${res.status})`)
        }

        toast.add({
          title: "User created",
          description: `${value.name.trim()} can now sign in.`,
          type: "success",
        })
        if (submitMode === "close") {
          router.push("/admin/users")
        } else {
          form.reset()
          setShowPassword(false)
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create user"
        setError(message)
        toast.add({
          title: "Could not create user",
          description: message,
          type: "destructive",
        })
      }
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add user</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create an account that can sign in to CashRegistrar.
          </p>
        </div>
        <Link href="/admin/users">
          <Button variant="outline" size="sm">
            <ArrowLeft className="size-3.5" />
            Back to Users
          </Button>
        </Link>
      </div>

      <div className="rounded-xl border bg-card">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            form.handleSubmit().catch(() => {})
          }}
        >
          <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  form.setFieldValue("business.name", TEST_BUSINESS_NAME)
                  form.setFieldValue("morCredential", {
                    ...TEST_MOR_CREDENTIALS,
                  })
                  form.setFieldValue(
                    "business.city",
                    TEST_SELLER_FIELDS.city
                  )
                  form.setFieldValue(
                    "business.email",
                    TEST_SELLER_FIELDS.email
                  )
                  form.setFieldValue(
                    "business.phone",
                    TEST_SELLER_FIELDS.phone
                  )
                  form.setFieldValue(
                    "business.region",
                    TEST_SELLER_FIELDS.region
                  )
                  form.setFieldValue(
                    "business.wereda",
                    TEST_SELLER_FIELDS.wereda
                  )
                }}
              >
                Test business
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <form.Field name="name">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Full name</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        autoFocus
                        autoComplete="name"
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              </form.Field>

              <form.Field name="email">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Email address</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        autoComplete="email"
                        aria-invalid={isInvalid}
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              </form.Field>
            </div>

            <form.Field name="password">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Temporary password
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id={field.name}
                        name={field.name}
                        type={showPassword ? "text" : "password"}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        autoComplete="new-password"
                        aria-invalid={isInvalid}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          type="button"
                          size="icon-sm"
                          onClick={() => setShowPassword((visible) => !visible)}
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? <EyeOff /> : <Eye />}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription>
                      At least 5 characters. Share it securely with the user.
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="role">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                const description =
                  field.state.value === "ADMIN"
                    ? "Can manage the entire CashRegistrar platform."
                    : "Can create and manage a business."
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Account role</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) =>
                        field.handleChange(
                          value === "ADMIN" ? "ADMIN" : "OWNER"
                        )
                      }
                    >
                      <SelectTrigger id={field.name} aria-invalid={isInvalid}>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OWNER">Owner</SelectItem>
                        <SelectItem value="ADMIN">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldDescription>{description}</FieldDescription>
                    <FieldDescription>
                      Managers and cashiers are assigned later inside a business.
                    </FieldDescription>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <div className="border-t pt-5">
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Business</h3>
                </div>

                <form.Field name="business.name">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                          Business name
                        </FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          aria-invalid={isInvalid}
                        />
                        {isInvalid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                      </Field>
                    )
                  }}
                </form.Field>

                <form.Field name="business.address">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Address</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        autoComplete="street-address"
                      />
                    </Field>
                  )}
                </form.Field>

                <div className="flex items-center gap-2 pt-1">
                  <Store className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Seller details</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <form.Field name="business.city">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>City</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          autoComplete="address-level2"
                        />
                      </Field>
                    )}
                  </form.Field>

                  <form.Field name="business.region">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Region</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder="e.g. 13"
                        />
                      </Field>
                    )}
                  </form.Field>

                  <form.Field name="business.wereda">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Wereda</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder="Wereda / district"
                        />
                      </Field>
                    )}
                  </form.Field>

                  <form.Field name="business.phone">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Phone</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder="e.g. +251900000000"
                        />
                      </Field>
                    )}
                  </form.Field>

                  <form.Field name="business.email">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={isInvalid} className="sm:col-span-2">
                          <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="email"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            autoComplete="email"
                            placeholder="contact@example.com"
                            aria-invalid={isInvalid}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      )
                    }}
                  </form.Field>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Store className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">MOR credentials</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <form.Field name="morCredential.tin">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>TIN</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            autoComplete="off"
                            aria-invalid={isInvalid}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      )
                    }}
                  </form.Field>

                  <form.Field name="morCredential.vatNumber">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>VAT number</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          autoComplete="off"
                        />
                      </Field>
                    )}
                  </form.Field>

                  <form.Field name="morCredential.systemNumber">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            System number
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            autoComplete="off"
                            aria-invalid={isInvalid}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      )
                    }}
                  </form.Field>

                  <form.Field name="morCredential.systemType">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>System type</FieldLabel>
                        <Select
                          value={field.state.value}
                          onValueChange={(value) =>
                            field.handleChange(value ?? "POS")
                          }
                        >
                          <SelectTrigger id={field.name}>
                            <SelectValue placeholder="Select system type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ERP">ERP</SelectItem>
                            <SelectItem value="POS">POS</SelectItem>
                            <SelectItem value="MANUAL">MANUAL</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  </form.Field>

                  <form.Field name="morCredential.clientId">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Client ID</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            autoComplete="off"
                            aria-invalid={isInvalid}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      )
                    }}
                  </form.Field>

                  <form.Field name="morCredential.clientSecret">
                    {(field) => {
                      const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Client secret
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="password"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            autoComplete="new-password"
                            aria-invalid={isInvalid}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      )
                    }}
                  </form.Field>

                  <form.Field name="morCredential.apiKey">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>API key</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="password"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            autoComplete="new-password"
                            aria-invalid={isInvalid}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      )
                    }}
                  </form.Field>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Store className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Initial branch</h3>
                </div>

                <form.Field name="branch.name">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Branch name</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          aria-invalid={isInvalid}
                        />
                        {isInvalid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
                      </Field>
                    )
                  }}
                </form.Field>

                <form.Field name="branch.address">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>Address</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        autoComplete="street-address"
                      />
                    </Field>
                  )}
                </form.Field>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(pending) => (
              <div className="flex flex-col gap-2 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Link href="/admin/users">
                  <Button type="button" variant="outline" disabled={pending}>
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setSubmitMode("another")}
                >
                  {pending && submitMode === "another"
                    ? "Creating…"
                    : "Create and add another"}
                </Button>
                <Button
                  type="submit"
                  disabled={pending}
                  onClick={() => setSubmitMode("close")}
                >
                  {pending && submitMode === "close"
                    ? "Creating…"
                    : "Create user"}
                </Button>
              </div>
            )}
          </form.Subscribe>
        </form>
      </div>
    </div>
  )
}
