"use client"

import { Fragment, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "@tanstack/react-form"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Building2, ChevronDown, ChevronsUpDown, Plus, TriangleAlert, User, X } from "lucide-react"
import { Combobox } from "@base-ui/react/combobox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import {
  calculateTotalsCents,
  formatCents,
  lineTotalCents,
  moneyToCents,
  todayString,
  EMPTY_BUYER,
  TEST_BUYER,
  TEST_BUYER_B2C,
  type BuyerDetails,
  type TransactionType,
} from "@/lib/invoice"
import { UNIT_OPTIONS } from "@/lib/units"
import {
  TAX_CODE_OPTIONS,
  rateForTaxCode,
  type TaxCode,
} from "@/lib/einvoice/tax"
import {
  invoiceFormSchema,
  buyerSchema,
  type InvoiceFormLine,
} from "@/lib/invoice-schema"
import { cn, uid } from "@/lib/utils"
import { useWorkspace } from "@/components/workspace-provider"

const ID_TYPES = ["KID"]
const TRANSACTION_TYPES = [
  { value: "B2B", label: "B2B — Business" },
  { value: "B2C", label: "B2C — Consumer" },
]

export type InvoiceFormInitial = {
  date: string
  lines: Array<Omit<InvoiceFormLine, "id" | "productId"> & { productId?: string }>
  taxCode: string
  taxRate: number
  transactionType: TransactionType
  buyer: BuyerDetails
  cashierName: string
  salesPersonName: string
  incomeWithholdRate: number
}

type Product = {
  id: string
  name: string
  itemCode: string | null
  unit: string | null
  sellingPrice: string
}

type InvoiceFormProps = {
  invoiceId?: string
  initial?: InvoiceFormInitial
}

function createLineItem(): InvoiceFormLine {
  return {
    id: uid(),
    productId: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    itemCode: "",
    unit: "PCS",
  }
}

function toMessages(errors: unknown[] | undefined): string[] {
  if (!errors) return []
  return [
    ...new Set(
      errors.flatMap((error) => {
        if (typeof error === "string") return error ? [error] : []
        if (error instanceof Error) return error.message ? [error.message] : []
        if (error && typeof error === "object" && "message" in error) {
          const message = (error as { message?: unknown }).message
          return typeof message === "string" && message ? [message] : []
        }
        return []
      })
    ),
  ]
}

type AnyFieldLike = {
  name: string
  handleChange(value: unknown): void
  handleBlur(): void
  state: {
    value: unknown
    meta: {
      isTouched: boolean
      isValid: boolean
      errors: unknown[]
    }
  }
}
function TextField({
  field,
  label,
  description,
  formatChange,
  ...props
}: {
  field: AnyFieldLike
  label: string
  description?: string
  formatChange?: (raw: string) => unknown
} & Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "onBlur" | "name" | "id" | "aria-invalid" | "required"
>) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value as string}
        onBlur={field.handleBlur}
        onChange={(e) =>
          field.handleChange(
            formatChange ? formatChange(e.target.value) : e.target.value
          )
        }
        aria-invalid={isInvalid}
        {...props}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}

function SelectField({
  field,
  label,
  options,
  placeholder,
}: {
  field: AnyFieldLike
  label: string
  options: ReadonlyArray<{ value: string; label: string }>
  placeholder?: string
}) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Select
        value={field.state.value as string}
        onValueChange={(value) => field.handleChange(value ?? "")}
      >
        <SelectTrigger id={field.name} aria-invalid={isInvalid}>
          <SelectValue placeholder={placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}

function TableInput({
  field,
  className,
  ...props
}: { field: AnyFieldLike } & Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "onBlur" | "name" | "aria-invalid"
>) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
  return (
    <input
      name={field.name}
      value={field.state.value as string}
      onBlur={field.handleBlur}
      onChange={(e) => field.handleChange(e.target.value)}
      aria-invalid={isInvalid}
      className={cn(
        "w-full rounded-md border border-input bg-transparent px-2 py-1 outline-none focus:border-ring",
        className
      )}
      {...props}
    />
  )
}

export function InvoiceForm({ invoiceId, initial }: InvoiceFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { workspace } = useWorkspace()
  const businessId = workspace?.businessId ?? ""
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const { data: products = [] } = useQuery({
    queryKey: ["products", businessId],
    queryFn: async () => {
      const res = await fetch(`/api/products?businessId=${businessId}`)
      if (!res.ok) throw new Error("Failed to load products")
      const body = (await res.json()) as { products: Product[] }
      return body.products
    },
    enabled: Boolean(workspace),
  })

  const form = useForm({
    defaultValues: {
      date: initial?.date ?? todayString(),
      lines:
        initial?.lines.map((line) => ({
          ...line,
          id: uid(),
          productId: line.productId ?? "",
        })) ?? [createLineItem()],
      taxCode: initial?.taxCode ?? "VAT15",
      taxRate: initial?.taxRate ?? 0.15,
      transactionType: initial?.transactionType ?? "B2B",
      buyer: initial?.buyer ?? EMPTY_BUYER,
      cashierName: initial?.cashierName ?? "AAA",
      salesPersonName: initial?.salesPersonName ?? "AAA",
      incomeWithholdRate: initial?.incomeWithholdRate ?? 2,
    },
    validators: {
      onChange: invoiceFormSchema,
    },
    onSubmit: async ({ value }) => {
      setPending(true)
      setError(null)
      try {
        const res = await fetch(
          invoiceId ? `/api/invoices/${invoiceId}` : "/api/invoices",
          {
            method: invoiceId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: value.date,
              taxCode: value.taxCode,
              taxRate: value.taxRate,
              transactionType: value.transactionType,
              buyer: value.buyer,
              cashierName: value.cashierName.trim() || "AAA",
              salesPersonName: value.salesPersonName.trim() || "AAA",
              incomeWithholdRate: value.incomeWithholdRate,
              lines: value.lines.map((line) => ({
                description: line.description.trim(),
                quantity: Number(line.quantity),
                unitPriceCents: moneyToCents(line.unitPrice),
                itemCode: line.itemCode.trim(),
                unit: line.unit.trim() || "PCS",
              })),
            }),
          }
        )
        const body = (await res.json().catch(() => ({}))) as {
          invoice?: { id: string }
          error?: string
        }
        if (!res.ok || !body.invoice) {
          throw new Error(body.error ?? `Failed to save invoice (${res.status})`)
        }
        queryClient.invalidateQueries({ queryKey: ["invoices"] })
        queryClient.invalidateQueries({ queryKey: ["invoice"] })
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
        router.push(invoiceId ? `/invoices/${invoiceId}` : "/invoices")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save invoice")
        setPending(false)
      }
    },
  })

  return (
    <form
      id="invoice-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
        form.handleSubmit().catch(() => {})
      }}
      className="mx-auto flex max-w-4xl flex-col gap-6"
    >
      <form.Subscribe
        selector={(state) => ({
          values: state.values,
        })}
      >
        {({ values }) => {
          const transactionType = values.transactionType

          const buyerHasErrors =
            submitted && !buyerSchema.safeParse(values.buyer).success

          const derived = values.lines.map((item) => {
            const quantity = Number(item.quantity)
            const quantityNum =
              Number.isFinite(quantity) && quantity > 0 ? quantity : 0
            const unitPriceCents = moneyToCents(item.unitPrice)
            return {
              id: item.id,
              description: item.description,
              quantity: quantityNum,
              unitPriceCents,
              totalCents: lineTotalCents(quantityNum, unitPriceCents),
              itemCode: item.itemCode,
              unit: item.unit,
            }
          })

          const totals = calculateTotalsCents(derived, values.taxRate)

          return (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="flex-1">
                  <form.Field name="date">
                    {(field) => <TextField field={field} label="Date" type="date" />}
                  </form.Field>
                </div>
                <div className="flex-1">
                  <form.Field name="transactionType">
                    {(field) => (
                      <SelectField
                        field={field}
                        label="Transaction Type"
                        options={TRANSACTION_TYPES}
                        placeholder="Select type"
                      />
                    )}
                  </form.Field>
                </div>
              </div>

              <Collapsible defaultOpen className="group rounded-lg border">
                <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <CollapsibleTrigger className="flex cursor-pointer items-center gap-2 text-sm font-medium select-none">
                    {transactionType === "B2B" ? (
                      <Building2 className="size-4" />
                    ) : (
                      <User className="size-4" />
                    )}
                    Buyer Details
                    {buyerHasErrors && (
                      <TriangleAlert className="size-4 text-destructive" />
                    )}
                    <ChevronDown className="size-4 transition-transform group-data-[open]:rotate-180" />
                  </CollapsibleTrigger>
                  <span className="ml-auto inline-flex flex-wrap items-center justify-end gap-2">
                    {values.buyer.tin.trim() && (
                      <span className="text-xs text-muted-foreground">
                        TIN: {values.buyer.tin}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        form.setFieldValue("transactionType", "B2B")
                        form.setFieldValue("buyer", { ...TEST_BUYER })
                      }}
                    >
                      Test B2B buyer
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        form.setFieldValue("transactionType", "B2C")
                        form.setFieldValue("buyer", { ...TEST_BUYER_B2C })
                      }}
                    >
                      Test B2C buyer
                    </Button>
                  </span>
                </div>
                <CollapsibleContent>
                  <div className="flex flex-col gap-4 border-t p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <form.Field name="buyer.legalName">
                      {(field) => (
                        <TextField
                          field={field}
                          label="Legal Name"
                          placeholder="Buyer registered name"
                        />
                      )}
                    </form.Field>
                    <form.Field name="buyer.tin">
                      {(field) => (
                        <TextField
                          field={field}
                          label="TIN"
                          placeholder="Buyer tax ID"
                        />
                      )}
                    </form.Field>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <form.Field name="buyer.vatNumber">
                      {(field) => (
                        <TextField
                          field={field}
                          label="VAT Number"
                          placeholder="Buyer VAT number"
                        />
                      )}
                    </form.Field>
                    <form.Field name="buyer.idNumber">
                      {(field) => (
                        <TextField
                          field={field}
                          label="ID Number"
                          placeholder="National / kebele ID"
                        />
                      )}
                    </form.Field>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <form.Field name="buyer.idType">
                      {(field) => (
                        <SelectField
                          field={field}
                          label="ID Type"
                          options={ID_TYPES.map((t) => ({ value: t, label: t }))}
                          placeholder="Select…"
                        />
                      )}
                    </form.Field>
                    <form.Field name="buyer.email">
                      {(field) => (
                        <TextField
                          field={field}
                          label="Email"
                          type="email"
                          placeholder="buyer@example.com"
                        />
                      )}
                    </form.Field>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <form.Field name="buyer.phone">
                      {(field) => (
                        <TextField
                          field={field}
                          label="Phone"
                          placeholder="e.g. 0912345678"
                        />
                      )}
                    </form.Field>
                    <form.Field name="buyer.houseNumber">
                      {(field) => (
                        <TextField
                          field={field}
                          label="House Number"
                          placeholder="House / building number"
                        />
                      )}
                    </form.Field>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <form.Field name="buyer.region">
                      {(field) => (
                        <TextField field={field} label="Region" placeholder="e.g. 13" />
                      )}
                    </form.Field>
                    <form.Field name="buyer.city">
                      {(field) => (
                        <TextField
                          field={field}
                          label="City"
                          placeholder="e.g. Addis Ababa"
                        />
                      )}
                    </form.Field>
                    <form.Field name="buyer.country">
                      {(field) => (
                        <TextField
                          field={field}
                          label="Country"
                          placeholder="e.g. 70"
                        />
                      )}
                    </form.Field>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <form.Field name="buyer.zone">
                      {(field) => (
                        <TextField field={field} label="Zone" placeholder="Zone" />
                      )}
                    </form.Field>
                    <form.Field name="buyer.wereda">
                      {(field) => (
                        <TextField
                          field={field}
                          label="Wereda"
                          placeholder="Wereda / district"
                        />
                      )}
                    </form.Field>
                    <form.Field name="buyer.kebele">
                      {(field) => (
                        <TextField
                          field={field}
                          label="Kebele"
                          placeholder="Kebele"
                        />
                      )}
                    </form.Field>
                  </div>
                </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                <form.Field name="cashierName">
                  {(field) => (
                    <TextField field={field} label="Cashier Name" placeholder="AAA" />
                  )}
                </form.Field>
                <form.Field name="salesPersonName">
                  {(field) => (
                    <TextField
                      field={field}
                      label="Sales Person"
                      placeholder="AAA"
                    />
                  )}
                </form.Field>
                {transactionType === "B2B" && (
                  <form.Field name="incomeWithholdRate">
                    {(field) => (
                      <TextField
                        field={field}
                        label="Income Withhold (%)"
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        formatChange={(raw) => Number(raw)}
                      />
                    )}
                  </form.Field>
                )}
              </div>

              <form.Field name="lines" mode="array">
                {(linesField) => (
                  <FieldSet>
                    <div className="mb-2 flex items-center justify-between">
                      <FieldLegend variant="label">Line Items</FieldLegend>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => linesField.pushValue(createLineItem())}
                      >
                        <Plus data-icon="inline-start" />
                        Add Item
                      </Button>
                    </div>

                    <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-40">Product</TableHead>
                        <TableHead className="w-24">Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-20 text-right">Qty</TableHead>
                        <TableHead className="w-24 text-right">Unit</TableHead>
                        <TableHead className="w-28 text-right">
                          Unit Price
                        </TableHead>
                        <TableHead className="w-28 text-right">Total</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linesField.state.value.map((line, index) => {
                        const descMeta = form.getFieldMeta(
                          `lines[${index}].description` as never
                        )
                        const qtyMeta = form.getFieldMeta(
                          `lines[${index}].quantity` as never
                        )
                        const priceMeta = form.getFieldMeta(
                          `lines[${index}].unitPrice` as never
                        )
                        const rowTouched = Boolean(
                          descMeta?.isTouched ||
                            qtyMeta?.isTouched ||
                            priceMeta?.isTouched
                        )
                        const rowMessages = rowTouched
                          ? [
                              ...toMessages(descMeta?.errors),
                              ...toMessages(qtyMeta?.errors),
                              ...toMessages(priceMeta?.errors),
                            ]
                          : []
                        return (
                          <Fragment key={line.id}>
                            <TableRow>
                              <TableCell>
                                <form.Field name={`lines[${index}].productId` as never}>
                                  {(field) => {
                                    const selectedId = field.state.value as string
                                    const selectedProduct =
                                      products.find((p) => p.id === selectedId) ??
                                      null
                                    return (
                                      <Combobox.Root
                                        items={products}
                                        itemToStringLabel={(product) => product.name}
                                        value={selectedProduct}
                                        onValueChange={(product) => {
                                          field.handleChange(
                                            (product ? product.id : "") as never
                                          )
                                          if (product) {
                                            form.setFieldValue(
                                              `lines[${index}].itemCode` as never,
                                              (product.itemCode ?? "") as never
                                            )
                                            form.setFieldValue(
                                              `lines[${index}].description` as never,
                                              product.name as never
                                            )
                                            form.setFieldValue(
                                              `lines[${index}].unit` as never,
                                              (product.unit ?? "PCS") as never
                                            )
                                            form.setFieldValue(
                                              `lines[${index}].unitPrice` as never,
                                              Number(
                                                product.sellingPrice
                                              ).toFixed(2) as never
                                            )
                                          }
                                        }}
                                      >
                                        <Combobox.InputGroup className="relative w-full">
                                          <Combobox.Input
                                            aria-label="Product"
                                            placeholder="Search product…"
                                            className="h-7 w-full rounded-md border border-input bg-transparent pr-7 pl-2 text-sm outline-none transition-colors focus:border-ring"
                                          />
                                          <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center">
                                            <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                                          </span>
                                        </Combobox.InputGroup>
                                        <Combobox.Portal>
                                          <Combobox.Positioner
                                            className="z-50"
                                            sideOffset={4}
                                          >
                                            <Combobox.Popup className="min-w-[var(--anchor-width)] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md focus:outline-none">
                                              <Combobox.Empty className="px-2 py-1.5 text-sm text-muted-foreground">
                                                No products found
                                              </Combobox.Empty>
                                              <Combobox.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain py-1 outline-none">
                                                {(product: Product) => (
                                                  <Combobox.Item
                                                    key={product.id}
                                                    value={product}
                                                    className="relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                                                  >
                                                    <span className="min-w-0 flex-1 truncate">
                                                      {product.name}
                                                    </span>
                                                    {product.itemCode && (
                                                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                                                        {product.itemCode}
                                                      </span>
                                                    )}
                                                  </Combobox.Item>
                                                )}
                                              </Combobox.List>
                                            </Combobox.Popup>
                                          </Combobox.Positioner>
                                        </Combobox.Portal>
                                      </Combobox.Root>
                                    )
                                  }}
                                </form.Field>
                              </TableCell>
                              <TableCell>
                                <form.Field name={`lines[${index}].itemCode` as never}>
                                  {(field) => (
                                    <TableInput
                                      field={field}
                                      aria-label="Item code"
                                      placeholder="SKU"
                                    />
                                  )}
                                </form.Field>
                              </TableCell>
                              <TableCell>
                                <form.Field
                                  name={`lines[${index}].description` as never}
                                >
                                  {(field) => (
                                    <TableInput
                                      field={field}
                                      aria-label="Description"
                                      placeholder="Item description"
                                    />
                                  )}
                                </form.Field>
                              </TableCell>
                              <TableCell>
                                <form.Field name={`lines[${index}].quantity` as never}>
                                  {(field) => (
                                    <TableInput
                                      field={field}
                                      type="text"
                                      inputMode="decimal"
                                      aria-label="Quantity"
                                      placeholder="1"
                                      className="text-right"
                                    />
                                  )}
                                </form.Field>
                              </TableCell>
                              <TableCell>
                                <form.Field name={`lines[${index}].unit` as never}>
                                  {(field) => {
                                    const isInvalid =
                                      field.state.meta.isTouched &&
                                      !field.state.meta.isValid
                                    return (
                                      <Select
                                        value={field.state.value as string}
                                        onValueChange={(value) =>
                                          field.handleChange(
                                            (value ?? "PCS") as never
                                          )
                                        }
                                      >
                                        <SelectTrigger
                                          aria-label="Unit"
                                          aria-invalid={isInvalid}
                                          className="h-7 w-full rounded-md border border-input bg-transparent p-0 px-2 text-right shadow-none focus:ring-0 data-[popup-open]:border-ring"
                                        >
                                          <SelectValue placeholder="Unit" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {UNIT_OPTIONS.map((option) => (
                                            <SelectItem
                                              key={option.value}
                                              value={option.value}
                                            >
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )
                                  }}
                                </form.Field>
                              </TableCell>
                              <TableCell>
                                <form.Field name={`lines[${index}].unitPrice` as never}>
                                  {(field) => (
                                    <TableInput
                                      field={field}
                                      type="text"
                                      inputMode="decimal"
                                      aria-label="Unit price"
                                      placeholder="0.00"
                                      className="text-right"
                                    />
                                  )}
                                </form.Field>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCents(derived[index]?.totalCents ?? 0)}
                              </TableCell>
                              <TableCell>
                                {linesField.state.value.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() =>
                                      linesField.removeValue(index)
                                    }
                                    aria-label="Remove line item"
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <X />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                            {rowMessages.length > 0 && (
                              <TableRow>
                                <TableCell
                                  colSpan={8}
                                  className="pb-2 pt-0"
                                >
                                  <p className="text-xs text-destructive">
                                    {rowMessages.join(" · ")}
                                  </p>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                  </FieldSet>
                )}
              </form.Field>

              <div className="flex flex-wrap gap-4">
                <div className="flex-1" />
                <div className="w-56">
                  <form.Field name="taxCode">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched &&
                        !field.state.meta.isValid
                      return (
                        <Field>
                          <FieldLabel htmlFor="tax-code">Tax Code</FieldLabel>
                          <Select
                            value={field.state.value as string}
                            onValueChange={(value) => {
                              const code = (value ?? "VAT15") as TaxCode
                              field.handleChange(code as never)
                              form.setFieldValue(
                                "taxRate",
                                rateForTaxCode(code) as never
                              )
                            }}
                          >
                            <SelectTrigger
                              id="tax-code"
                              aria-label="Tax code"
                              aria-invalid={isInvalid}
                            >
                              <SelectValue placeholder="Select tax code" />
                            </SelectTrigger>
                            <SelectContent>
                              {TAX_CODE_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label} ({Math.round(option.rate * 100)}
                                  %)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      )
                    }}
                  </form.Field>
                </div>
              </div>

              <div className="ml-auto flex w-64 flex-col gap-1.5 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="tabular-nums">
                    {formatCents(totals.subtotalCents)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tax ({Math.round(values.taxRate * 100)}%)</span>
                  <span className="tabular-nums">
                    {formatCents(totals.taxAmountCents)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Grand Total</span>
                  <span className="tabular-nums">
                    {formatCents(totals.grandTotalCents)}
                  </span>
                </div>
              </div>
            </>
          )
        }}
      </form.Subscribe>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending
            ? "Saving…"
            : invoiceId
              ? "Save Changes"
              : "Save Invoice"}
        </Button>
      </div>
    </form>
  )
}
