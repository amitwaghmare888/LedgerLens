# LedgerLens Test Data

**Valid test CSV files for manual import testing**

These files match the **actual production schemas** in `src/ingestion/column-map.ts`.

---

## Files

### 1. `merchant_ledger_demo.csv`
**Source**: Merchant Books  
**Records**: 8 transactions

**Required Columns**:
- `merchantTxnId` - Merchant transaction ID
- `orderRef` - Order reference
- `paymentRef` - Payment reference (links to Razorpay paymentId)
- `customerId` - Customer identifier
- `type` - Transaction type: `sale`, `refund`, or `adjustment`
- `amountPaise` - Amount in integer paise
- `date` - Transaction date (YYYY-MM-DD or DD/MM/YYYY)
- `description` - Optional description

**Test Scenarios**:
- MER_001: Normal sale (₹5,000.00) → matches PAY_RZP_001 → settles to BANK_TXN_001 (net ₹4,882.00 after fees)
- MER_002: Normal sale (₹1,500.00) → matches PAY_RZP_002 → settles to BANK_TXN_002
- MER_003: Normal sale (₹2,846.26) → matches PAY_RZP_003 → settles to BANK_TXN_003
- MER_004: Normal sale (₹1,000.00) → matches PAY_RZP_004 → settles to BANK_TXN_004
- MER_005: Refund (-₹500.00) → matches PAY_RZP_005 → bank debit BANK_TXN_005
- MER_006: Normal sale (₹750.00) → matches PAY_RZP_006 → settles to BANK_TXN_006
- MER_007: Normal sale (₹2,000.00) → matches PAY_RZP_007 → settles to BANK_TXN_007
- MER_008: Adjustment (-₹50.00) → fee correction, **NO** corresponding Razorpay/bank record (missing exception)

---

### 2. `razorpay_statement_demo.csv`
**Source**: Processor Data  
**Records**: 7 transactions

**Required Columns**:
- `paymentId` - Razorpay payment ID (links to merchant paymentRef)
- `orderId` - Order ID (links to merchant orderRef)
- `settlementId` - Settlement batch ID
- `status` - Payment status: `captured`, `refunded`, or `partially_refunded`
- `amountPaise` - Gross amount in integer paise
- `feePaise` - Razorpay fee in integer paise
- `taxPaise` - GST on fee in integer paise
- `netPaise` - Net settlement amount (amount - fee - tax) in integer paise
- `createdAt` - Payment creation date
- `settledAt` - Settlement date
- `utr` - Bank UTR number (links to bank statement)

**Test Scenarios**:
- PAY_RZP_001: Sale ₹5,000 → fee ₹100 + tax ₹18 → net ₹4,882 → UTR2024010700001
- PAY_RZP_002: Sale ₹1,500 → fee ₹30 + tax ₹5.40 → net ₹1,464.60 → UTR2024010800002
- PAY_RZP_003: Sale ₹2,846.26 → fee ₹56.92 + tax ₹10.24 → net ₹2,779.10 → UTR2024010900003
- PAY_RZP_004: Sale ₹1,000 → fee ₹20 + tax ₹3.60 → net ₹976.40 → UTR2024011000004
- PAY_RZP_005: Refund ₹500 → no fees on refund → net ₹500 → UTR2024011200005
- PAY_RZP_006: Sale ₹750 → fee ₹15 + tax ₹2.70 → net ₹732.30 → UTR2024011400006
- PAY_RZP_007: Sale ₹2,000 → fee ₹40 + tax ₹7.20 → net ₹1,952.80 → UTR2024011700007

**Missing from Razorpay**: MER_008 (adjustment) has no processor record → missing exception

---

### 3. `bank_statement_demo.csv`
**Source**: Bank Statement  
**Records**: 8 transactions

**Required Columns**:
- `bankRef` - Bank transaction reference
- `type` - Transaction type: `credit` or `debit`
- `amountPaise` - Amount in integer paise
- `date` - Transaction date
- `valueDate` - Value/clearing date
- `utr` - UTR number (links to Razorpay)
- `narration` - Optional transaction description

**Test Scenarios**:
- BANK_TXN_001: Credit ₹4,882 → UTR2024010700001 → matches PAY_RZP_001 settlement
- BANK_TXN_002: Credit ₹1,464.60 → UTR2024010800002 → matches PAY_RZP_002 settlement
- BANK_TXN_003: Credit ₹2,779.10 → UTR2024010900003 → matches PAY_RZP_003 settlement
- BANK_TXN_004: Credit ₹976.40 → UTR2024011000004 → matches PAY_RZP_004 settlement
- BANK_TXN_005: Debit ₹500 → UTR2024011200005 → matches PAY_RZP_005 refund
- BANK_TXN_006: Credit ₹732.30 → UTR2024011400006 → matches PAY_RZP_006 settlement
- BANK_TXN_007: Credit ₹1,952.80 → UTR2024011700007 → matches PAY_RZP_007 settlement
- BANK_TXN_008: Credit ₹500 → UTR2024012000008 → **UNMATCHED** (no merchant or Razorpay record) → unidentified exception

---

## Expected Reconciliation Results

### Matched (7 clean matches)
- MER_001 ↔ PAY_RZP_001 ↔ BANK_TXN_001 (sale with fees)
- MER_002 ↔ PAY_RZP_002 ↔ BANK_TXN_002 (sale with fees)
- MER_003 ↔ PAY_RZP_003 ↔ BANK_TXN_003 (sale with fees)
- MER_004 ↔ PAY_RZP_004 ↔ BANK_TXN_004 (sale with fees)
- MER_005 ↔ PAY_RZP_005 ↔ BANK_TXN_005 (refund)
- MER_006 ↔ PAY_RZP_006 ↔ BANK_TXN_006 (sale with fees)
- MER_007 ↔ PAY_RZP_007 ↔ BANK_TXN_007 (sale with fees)

### Exceptions (2)

**1. MER_008 - Missing Settlement**
- **Type**: Missing processor/bank record
- **Merchant**: MER_008, adjustment -₹50, 2024-01-16
- **Razorpay**: MISSING
- **Bank**: MISSING
- **Classification**: MISSING_SETTLEMENT or UNMATCHED_MERCHANT
- **Priority**: LOW (small adjustment amount)
- **Expected AI Behavior**: INCONCLUSIVE (insufficient evidence, adjustment with no corresponding payment)

**2. BANK_TXN_008 - Unidentified Deposit**
- **Type**: Unidentified bank transaction
- **Merchant**: MISSING
- **Razorpay**: MISSING
- **Bank**: BANK_TXN_008, credit ₹500, 2024-01-20, UTR2024012000008
- **Classification**: UNIDENTIFIED or UNMATCHED_BANK
- **Priority**: MEDIUM (unidentified deposit)
- **Expected AI Behavior**: Should analyze candidates but find insufficient linking evidence

---

## Usage

### Manual Import Testing

1. Start LedgerLens: `npm run dev`
2. Navigate to Import page
3. Upload files to correct cards:
   - `merchant_ledger_demo.csv` → **Merchant Books** card
   - `razorpay_statement_demo.csv` → **Processor Data** card
   - `bank_statement_demo.csv` → **Bank Statement** card
4. Verify preview shows correct column mapping
5. Import each file
6. Run reconciliation
7. Expected results:
   - **7 matched** (clean 3-way matches)
   - **2 exceptions** (MER_008 missing settlement, BANK_TXN_008 unidentified)

### Column Mapping Verification

These files use the **canonical field names** from the schema. They should import without "missing required columns" errors.

If you see validation errors, check:
- File uploaded to correct source card
- CSV encoding (UTF-8)
- No extra whitespace in headers
- Amount values are **integer paise** (not rupees with decimals)
- Dates in valid format (YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY)

---

## Data Relationships

### UTR Linking (3-way match via UTR)
```
PAY_RZP_001.utr = UTR2024010700001 = BANK_TXN_001.utr
PAY_RZP_002.utr = UTR2024010800002 = BANK_TXN_002.utr
...
```

### Payment ID Linking (Merchant → Razorpay)
```
MER_001.paymentRef = PAY_RZP_001 = PAY_RZP_001.paymentId
MER_002.paymentRef = PAY_RZP_002 = PAY_RZP_002.paymentId
...
```

### Order ID Linking (Merchant → Razorpay)
```
MER_001.orderRef = ORD_001 = PAY_RZP_001.orderId
MER_002.orderRef = ORD_002 = PAY_RZP_002.orderId
...
```

### Amount Relationships (Fees)
```
Merchant gross = PAY_RZP_xxx.amountPaise
Razorpay net = amountPaise - feePaise - taxPaise
Bank credit = Razorpay net
```

Example:
```
MER_001: ₹5,000.00 (500000 paise)
PAY_RZP_001: ₹5,000.00 gross - ₹100 fee - ₹18 tax = ₹4,882.00 net
BANK_TXN_001: ₹4,882.00 credit
```

---

## Validation

All amounts are **integer paise**. No decimal amounts.

**Type constraints**:
- Merchant `type`: `sale`, `refund`, or `adjustment`
- Razorpay `status`: `captured`, `refunded`, or `partially_refunded`
- Bank `type`: `credit` or `debit`

**Date formats supported**:
- ISO 8601: `2024-01-05`
- Indian: `05/01/2024` or `05-01-2024`

---

## Notes

- This is **synthetic test data** for manual import testing
- All identifiers are fictional
- Amounts and fees are realistic but simplified
- Data is deterministic and repeatable
- Designed to test normal flows + edge cases (missing records, unidentified transactions)
