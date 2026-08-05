"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, ChevronDown, Plus, User, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { uid } from "@/lib/utils"

type LineInput = {
  id: string
  description: string
  quantity: string
  unitPrice: string
  itemCode: string
  unit: string
}

function createLineItem(): LineInput {
  return {
    id: uid(),
    description: "",
    quantity: "1",
    unitPrice: "",
    itemCode: "",
    unit: "PCS",
  }
}

function isFutureDate(date: string): boolean {
  return date > todayString()
}

const ID_TYPES = ["KID", "Passport", "Driver License", "Other"]
const UNITS = ["PCS", "KG", "M", "L", "BOX", "EA", "Other"]

export function InvoiceForm() {
  const router = useRouter()
  const [date, setDate] = useState(todayString())
  const [lineItems, setLineItems] = useState<LineInput[]>([createLineItem()])
  const [taxRate, setTaxRate] = useState(15)
  const [transactionType, setTransactionType] = useState<TransactionType>("B2B")
  const [buyer, setBuyer] = useState<BuyerDetails>(EMPTY_BUYER)
  const [cashierName, setCashierName] = useState("AAA")
  const [salesPersonName, setSalesPersonName] = useState("AAA")
  const [incomeWithholdRate, setIncomeWithholdRate] = useState(2)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const updateLineItem = useCallback(
    (id: string, field: keyof Omit<LineInput, "id">, value: string) => {
      setLineItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        )
      )
    },
    []
  )

  const removeLineItem = useCallback((id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const addLineItem = useCallback(() => {
    setLineItems((prev) => [...prev, createLineItem()])
  }, [])

  const updateBuyer = useCallback(
    (field: keyof BuyerDetails, value: string) => {
      setBuyer((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const fillTestBuyer = useCallback(() => {
    setTransactionType("B2B")
    setBuyer({ ...TEST_BUYER })
  }, [])

  const fillTestBuyerB2C = useCallback(() => {
    setTransactionType("B2C")
    setBuyer({ ...TEST_BUYER_B2C })
  }, [])

  const derived = useMemo(
    () =>
      lineItems.map((item) => {
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
          rawQuantity: item.quantity,
          rawUnitPrice: item.unitPrice,
          itemCode: item.itemCode,
          unit: item.unit,
          descriptionTooShort: item.description.trim().length < 3,
          priceInvalid:
            item.unitPrice.trim() !== "" &&
            !Number.isFinite(Number(item.unitPrice)),
          valid:
            item.description.trim().length >= 3 &&
            quantityNum > 0 &&
            unitPriceCents >= 0 &&
            (item.unitPrice.trim() === "" ||
              Number.isFinite(Number(item.unitPrice))),
        }
      }),
    [lineItems]
  )

  const totals = calculateTotalsCents(derived, taxRate)

  const buyerValid = useMemo(() => {
    const legalNameOk = buyer.legalName.trim() !== ""
    if (transactionType === "B2C") return legalNameOk
    return legalNameOk && buyer.tin.trim() !== ""
  }, [transactionType, buyer])

  const valid = useMemo(
    () =>
      date !== "" &&
      !isFutureDate(date) &&
      Number.isFinite(taxRate) &&
      taxRate >= 0 &&
      taxRate <= 100 &&
      buyerValid &&
      derived.length > 0 &&
      derived.every((item) => item.valid),
    [date, taxRate, buyerValid, derived]
  )

  const validationError = useMemo(() => {
    const problems: string[] = []
    if (!date) problems.push("a date")
    else if (isFutureDate(date))
      problems.push("a date that is not in the future")
    if (Number.isFinite(taxRate) === false || taxRate < 0 || taxRate > 100) {
      problems.push("a tax rate between 0 and 100")
    }
    if (buyer.legalName.trim() === "") problems.push("the buyer's legal name")
    if (transactionType === "B2B" && buyer.tin.trim() === "") {
      problems.push("the buyer's TIN")
    }
    if (derived.length === 0) {
      problems.push("at least one line item")
    } else {
      const short = derived.filter((item) => item.descriptionTooShort)
      if (short.length > 0) {
        problems.push(
          `item descriptions of at least 3 characters (${short.length} item${short.length > 1 ? "s" : ""})`
        )
      }
      const badQty = derived.filter(
        (item) => !Number.isFinite(item.quantity) || item.quantity <= 0
      )
      if (badQty.length > 0) {
        problems.push(
          `quantities greater than zero (${badQty.length} item${badQty.length > 1 ? "s" : ""})`
        )
      }
      const badPrice = derived.filter((item) => item.priceInvalid)
      if (badPrice.length > 0) {
        problems.push(
          `valid unit prices (${badPrice.length} item${badPrice.length > 1 ? "s" : ""})`
        )
      }
    }
    return problems
  }, [date, taxRate, transactionType, buyer, derived])

  const submitInvoice = async () => {
    if (pending) return
    if (!valid) {
      setError(`Please fill in: ${validationError.join(", ")}.`)
      return
    }
    setError(null)
    setPending(true)
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          taxRate,
          transactionType,
          buyer,
          cashierName: cashierName.trim() || "AAA",
          salesPersonName: salesPersonName.trim() || "AAA",
          incomeWithholdRate,
          lines: derived.map((item) => ({
            description: item.description.trim(),
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            itemCode: item.itemCode.trim(),
            unit: item.unit.trim() || "PCS",
          })),
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        invoice?: { id: string }
        error?: string
      }
      if (!res.ok || !body.invoice) {
        throw new Error(body.error ?? `Failed to save invoice (${res.status})`)
      }
      router.push(`/invoices/${body.invoice.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save invoice")
      setPending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    await submitInvoice()
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          {isFutureDate(date) && (
            <p className="mt-1 text-xs text-destructive">
              Date cannot be in the future.
            </p>
          )}
        </div>
        <div className="flex-1">
          <Label htmlFor="transactionType">Transaction Type</Label>
          <Select
            value={transactionType}
            onValueChange={(value) => {
              if (value === "B2B" || value === "B2C") {
                setTransactionType(value)
              }
            }}
          >
            <SelectTrigger id="transactionType">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="B2B">B2B — Business</SelectItem>
              <SelectItem value="B2C">B2C — Consumer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <details className="group rounded-lg border">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
          {transactionType === "B2B" ? (
            <Building2 className="size-4" />
          ) : (
            <User className="size-4" />
          )}
          Buyer Details
          <span className="ml-auto inline-flex items-center gap-3">
            {transactionType === "B2B" && buyer.tin.trim() && (
              <span className="text-xs text-muted-foreground">
                TIN: {buyer.tin}
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                fillTestBuyer()
              }}
            >
              Test B2B buyer
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                fillTestBuyerB2C()
              }}
            >
              Test B2C buyer
            </Button>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="space-y-4 border-t p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="buyerLegalName">Legal Name</Label>
              <Input
                id="buyerLegalName"
                value={buyer.legalName}
                onChange={(e) => updateBuyer("legalName", e.target.value)}
                placeholder="Buyer registered name"
                required
              />
            </div>
            <div>
              <Label htmlFor="buyerTin">TIN</Label>
              <Input
                id="buyerTin"
                value={buyer.tin}
                onChange={(e) => updateBuyer("tin", e.target.value)}
                placeholder="Buyer tax ID"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="buyerVatNumber">VAT Number</Label>
              <Input
                id="buyerVatNumber"
                value={buyer.vatNumber}
                onChange={(e) => updateBuyer("vatNumber", e.target.value)}
                placeholder="Buyer VAT number"
              />
            </div>
            <div>
              <Label htmlFor="buyerIdNumber">ID Number</Label>
              <Input
                id="buyerIdNumber"
                value={buyer.idNumber}
                onChange={(e) => updateBuyer("idNumber", e.target.value)}
                placeholder="National / kebele ID"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="buyerIdType">ID Type</Label>
              <Select
                value={buyer.idType}
                onValueChange={(value) => updateBuyer("idType", value ?? "")}
              >
                <SelectTrigger id="buyerIdType">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {ID_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="buyerEmail">Email</Label>
              <Input
                id="buyerEmail"
                type="email"
                value={buyer.email}
                onChange={(e) => updateBuyer("email", e.target.value)}
                placeholder="buyer@example.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="buyerPhone">Phone</Label>
              <Input
                id="buyerPhone"
                value={buyer.phone}
                onChange={(e) => updateBuyer("phone", e.target.value)}
                placeholder="e.g. 0912345678"
              />
            </div>
            <div>
              <Label htmlFor="buyerHouseNumber">House Number</Label>
              <Input
                id="buyerHouseNumber"
                value={buyer.houseNumber}
                onChange={(e) => updateBuyer("houseNumber", e.target.value)}
                placeholder="House / building number"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="buyerRegion">Region</Label>
              <Input
                id="buyerRegion"
                value={buyer.region}
                onChange={(e) => updateBuyer("region", e.target.value)}
                placeholder="e.g. 13"
              />
            </div>
            <div>
              <Label htmlFor="buyerCity">City</Label>
              <Input
                id="buyerCity"
                value={buyer.city}
                onChange={(e) => updateBuyer("city", e.target.value)}
                placeholder="e.g. Addis Ababa"
              />
            </div>
            <div>
              <Label htmlFor="buyerCountry">Country</Label>
              <Input
                id="buyerCountry"
                value={buyer.country}
                onChange={(e) => updateBuyer("country", e.target.value)}
                placeholder="e.g. 70"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="buyerZone">Zone</Label>
              <Input
                id="buyerZone"
                value={buyer.zone}
                onChange={(e) => updateBuyer("zone", e.target.value)}
                placeholder="Zone"
              />
            </div>
            <div>
              <Label htmlFor="buyerWereda">Wereda</Label>
              <Input
                id="buyerWereda"
                value={buyer.wereda}
                onChange={(e) => updateBuyer("wereda", e.target.value)}
                placeholder="Wereda / district"
              />
            </div>
            <div>
              <Label htmlFor="buyerKebele">Kebele</Label>
              <Input
                id="buyerKebele"
                value={buyer.kebele}
                onChange={(e) => updateBuyer("kebele", e.target.value)}
                placeholder="Kebele"
              />
            </div>
          </div>
        </div>
      </details>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div>
          <Label htmlFor="cashierName">Cashier Name</Label>
          <Input
            id="cashierName"
            value={cashierName}
            onChange={(e) => setCashierName(e.target.value)}
            placeholder="AAA"
          />
        </div>
        <div>
          <Label htmlFor="salesPersonName">Sales Person</Label>
          <Input
            id="salesPersonName"
            value={salesPersonName}
            onChange={(e) => setSalesPersonName(e.target.value)}
            placeholder="AAA"
          />
        </div>
        {transactionType === "B2B" && (
          <div>
            <Label htmlFor="incomeWithholdRate">Income Withhold (%)</Label>
            <Input
              id="incomeWithholdRate"
              type="number"
              min="0"
              max="100"
              step="any"
              value={incomeWithholdRate}
              onChange={(e) => setIncomeWithholdRate(Number(e.target.value))}
            />
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Line Items</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLineItem}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Item
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="w-24 px-3 py-2 text-left font-medium">Code</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="w-20 px-3 py-2 text-right font-medium">Qty</th>
                <th className="w-24 px-3 py-2 text-right font-medium">Unit</th>
                <th className="w-28 px-3 py-2 text-right font-medium">
                  Unit Price
                </th>
                <th className="w-28 px-3 py-2 text-right font-medium">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {derived.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-1.5">
                    <input
                      value={item.itemCode}
                      onChange={(e) =>
                        updateLineItem(item.id, "itemCode", e.target.value)
                      }
                      aria-label="Item code"
                      className="w-full rounded-md border border-input bg-transparent px-2 py-1 outline-none focus:border-ring"
                      placeholder="SKU"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={item.description}
                      onChange={(e) =>
                        updateLineItem(item.id, "description", e.target.value)
                      }
                      aria-label="Description"
                      className="w-full rounded-md border border-input bg-transparent px-2 py-1 outline-none focus:border-ring"
                      placeholder="Item description"
                      required
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={item.rawQuantity}
                      onChange={(e) =>
                        updateLineItem(item.id, "quantity", e.target.value)
                      }
                      aria-label="Quantity"
                      className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-right outline-none focus:border-ring"
                      required
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Select
                      value={item.unit}
                      onValueChange={(value) =>
                        updateLineItem(item.id, "unit", value ?? "PCS")
                      }
                    >
                      <SelectTrigger
                        aria-label="Unit"
                        className="h-7 w-full rounded-md border border-input bg-transparent p-0 px-2 text-right shadow-none focus:ring-0 data-[popup-open]:border-ring"
                      >
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.rawUnitPrice}
                      onChange={(e) =>
                        updateLineItem(item.id, "unitPrice", e.target.value)
                      }
                      aria-label="Unit price"
                      className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-right outline-none focus:border-ring"
                      placeholder="0.00"
                      required
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatCents(item.totalCents)}
                  </td>
                  <td className="px-2 py-1.5">
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        aria-label="Remove line item"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {derived.some((item) => item.descriptionTooShort) && (
          <p className="mt-2 text-xs text-destructive">
            Item descriptions must be at least 3 characters.
          </p>
        )}
        {derived.some((item) => item.priceInvalid) && (
          <p className="mt-2 text-xs text-destructive">
            Unit prices must be valid numbers.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1" />
        <div className="w-48">
          <Label htmlFor="taxRate">Tax Rate (%)</Label>
          <Input
            id="taxRate"
            type="number"
            min="0"
            max="100"
            step="any"
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="ml-auto w-64 space-y-1.5 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">
            {formatCents(totals.subtotalCents)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Tax ({taxRate}%)</span>
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

      {transactionType === "B2B" && !buyer.tin.trim() && (
        <p className="text-xs text-muted-foreground">
          For B2B invoices, add the buyer&apos;s TIN (required by EIMS).
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button
          type="button"
          size="lg"
          disabled={pending}
          onClick={() => submitInvoice()}
        >
          {pending ? "Saving…" : "Save Invoice"}
        </Button>
      </div>
    </form>
  )
}
