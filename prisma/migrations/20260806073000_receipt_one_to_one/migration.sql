-- Enforce one receipt per invoice (Receipt table is empty, so this is safe).
CREATE UNIQUE INDEX `Receipt_invoiceId_key` ON `Receipt`(`invoiceId`);
