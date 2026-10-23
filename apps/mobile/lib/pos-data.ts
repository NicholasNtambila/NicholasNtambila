/**
 * POS Unified Catalog, Shift Management, Expense Tracking, and Audit Store
 * Provides default stock & service definitions, shift drawer state,
 * micro-expenses, and cashier fraud audit logs.
 */

export interface CatalogItem {
  id: string;
  name: string;
  type: 'service' | 'product';
  category:
    'services' | 'stationery' | 'phone_accessories' | 'snacks' | 'general';
  price: number;
  available: number;
  unit?: string;
  description?: string;
}

/**
 * Built-in Unified Catalog for Business Services & Retail Products
 * Covers: Photocopying, Printing, Scanning, Typing, Laminating, Binding, Passport Photos,
 * Biro pens, A4 papers, notebooks, phone accessories, and snacks.
 */
export const DEFAULT_UNIFIED_CATALOG: CatalogItem[] = [
  // --- Services: Photocopying & Printing (Official SaniT3ch Rates) ---
  {
    id: 'srv-photocopy-bw-single',
    name: 'Photocopying (B/W Single)',
    type: 'service',
    category: 'services',
    price: 2.0,
    available: 9999,
    unit: 'page',
    description: 'A4 black & white photocopy, single-sided paper document',
  },
  {
    id: 'srv-photocopy-bw-double',
    name: 'Photocopying (B/W Double)',
    type: 'service',
    category: 'services',
    price: 3.0,
    available: 9999,
    unit: 'sheet',
    description: 'A4 black & white photocopy, both sides',
  },
  {
    id: 'srv-photocopy-color',
    name: 'Photocopying (Full Color)',
    type: 'service',
    category: 'services',
    price: 5.0,
    available: 9999,
    unit: 'page',
    description: 'A4 high-resolution color copy',
  },
  {
    id: 'srv-photocopy-id',
    name: 'Photocopying (NRC / Passport / IDs)',
    type: 'service',
    category: 'services',
    price: 3.0,
    available: 9999,
    unit: 'card',
    description: 'NRC, Passport, Under-5 Card & all IDs card copy',
  },
  {
    id: 'srv-printing-bw',
    name: 'Printing (B/W Document)',
    type: 'service',
    category: 'services',
    price: 5.0,
    available: 9999,
    unit: 'page',
    description: 'Standard laser printing on A4 80gsm paper',
  },
  {
    id: 'srv-printing-color',
    name: 'Printing (Full Color Document)',
    type: 'service',
    category: 'services',
    price: 10.0,
    available: 9999,
    unit: 'page',
    description: 'Vibrant laser/inkjet color document print',
  },
  {
    id: 'srv-printing-wall-stickers',
    name: 'Wall Stickers (A4 Paper)',
    type: 'service',
    category: 'services',
    price: 35.0,
    available: 9999,
    unit: 'sheet',
    description: 'Custom adhesive wall stickers printed on glossy sticker media',
  },
  {
    id: 'srv-printing-cake-toppers',
    name: 'Cake Toppers (A4 Paper)',
    type: 'service',
    category: 'services',
    price: 35.0,
    available: 9999,
    unit: 'sheet',
    description: 'High-density cardstock full-color decorative cake toppers',
  },
  {
    id: 'srv-printing-certificates',
    name: 'Certificates Printing',
    type: 'service',
    category: 'services',
    price: 20.0,
    available: 9999,
    unit: 'page',
    description: 'Heavyweight bond / parchment certificate printing',
  },
  {
    id: 'srv-passport-photo-bw-4',
    name: 'Passport Photos B/W (Pack of 4)',
    type: 'service',
    category: 'services',
    price: 50.0,
    available: 9999,
    unit: 'pack',
    description: 'Instant black & white official studio passport portraits (4 pack)',
  },
  {
    id: 'srv-passport-photo-color-4',
    name: 'Passport Photos Color (Pack of 4)',
    type: 'service',
    category: 'services',
    price: 70.0,
    available: 9999,
    unit: 'pack',
    description: 'Instant full-color high-resolution studio passport portraits (4 pack)',
  },

  // --- Services: Other Services (Barbing, Shaving, E-Gov, Laminating, Charging) ---
  {
    id: 'srv-barbing-adult',
    name: 'Barbing (Adult Haircut)',
    type: 'service',
    category: 'services',
    price: 25.0,
    available: 9999,
    unit: 'cut',
    description: 'Professional barber haircut and hair styling for adults',
  },
  {
    id: 'srv-barbing-children',
    name: 'Barbing (Children Haircut)',
    type: 'service',
    category: 'services',
    price: 15.0,
    available: 9999,
    unit: 'cut',
    description: 'Gentle haircut and neat trim for children',
  },
  {
    id: 'srv-shaving',
    name: 'Shaving & Beard Trim',
    type: 'service',
    category: 'services',
    price: 10.0,
    available: 9999,
    unit: 'service',
    description: 'Clean razor or machine beard shaving and line-up',
  },
  {
    id: 'srv-tpin-reg',
    name: 'T-PIN Registration (ZRA)',
    type: 'service',
    category: 'services',
    price: 50.0,
    available: 9999,
    unit: 'filing',
    description: 'Zambia Revenue Authority online Tax Payer Identification registration',
  },
  {
    id: 'srv-napsa-reg',
    name: 'NAPSA Registration / Returns',
    type: 'service',
    category: 'services',
    price: 50.0,
    available: 9999,
    unit: 'filing',
    description: 'National Pension Scheme Authority profile creation and monthly filing',
  },
  {
    id: 'srv-ecz-statement',
    name: 'ECZ Statement Printing',
    type: 'service',
    category: 'services',
    price: 25.0,
    available: 9999,
    unit: 'doc',
    description: 'Examinations Council of Zambia results download and color printout',
  },
  {
    id: 'srv-laminating-a4',
    name: 'Laminating (A4 Pouch)',
    type: 'service',
    category: 'services',
    price: 20.0,
    available: 9999,
    unit: 'sheet',
    description: 'Heavy 125-micron thermal protective sealed lamination',
  },
  {
    id: 'srv-binding-spiral',
    name: 'Book Binding (Spiral / Comb)',
    type: 'service',
    category: 'services',
    price: 25.0,
    available: 9999,
    unit: 'booklet',
    description: 'Sturdy plastic spiral binding with protective front and back acetate',
  },
  {
    id: 'srv-phone-charge-smart',
    name: 'Phone Charging (Smart Phone)',
    type: 'service',
    category: 'services',
    price: 10.0,
    available: 9999,
    unit: 'charge',
    description: 'Safe high-speed charging dock for Android / iPhone smartphones',
  },
  {
    id: 'srv-phone-charge-small',
    name: 'Phone Charging (Small Phone)',
    type: 'service',
    category: 'services',
    price: 5.0,
    available: 9999,
    unit: 'charge',
    description: 'Safe charging for small button / feature phones',
  },
  {
    id: 'srv-scanning',
    name: 'Document Scanning to PDF/Flash',
    type: 'service',
    category: 'services',
    price: 3.0,
    available: 9999,
    unit: 'page',
    description: 'High-res document scan delivered via flash or WhatsApp',
  },
  {
    id: 'srv-typing',
    name: 'Typing & Document Formatting',
    type: 'service',
    category: 'services',
    price: 15.0,
    available: 9999,
    unit: 'page',
    description: 'Word processing, letter typing, CV formatting',
  },

  // --- Products: Stationery & Paper ---
  {
    id: 'prod-pen-biro-blue',
    name: 'Biro Ballpoint Pen (Blue)',
    type: 'product',
    category: 'stationery',
    price: 3.0,
    available: 120,
    unit: 'piece',
    description: 'Schneider / Cello medium point durable biro pen',
  },
  {
    id: 'prod-pen-biro-black',
    name: 'Biro Ballpoint Pen (Black)',
    type: 'product',
    category: 'stationery',
    price: 3.0,
    available: 95,
    unit: 'piece',
    description: 'Black ink smooth flow ballpoint pen',
  },
  {
    id: 'prod-pen-gel',
    name: 'Gel Ink Pen (Fine Point 0.5mm)',
    type: 'product',
    category: 'stationery',
    price: 7.0,
    available: 48,
    unit: 'piece',
    description: 'Executive fast-drying rollerball gel pen',
  },
  {
    id: 'prod-paper-a4-single',
    name: 'A4 Plain Paper (Single Sheet)',
    type: 'product',
    category: 'stationery',
    price: 0.5,
    available: 2500,
    unit: 'sheet',
    description: 'Bright white 80gsm multi-purpose office paper',
  },
  {
    id: 'prod-paper-a4-pack-10',
    name: 'A4 Plain Paper (Pack of 10)',
    type: 'product',
    category: 'stationery',
    price: 4.0,
    available: 250,
    unit: 'pack',
    description: '10-sheet student/quick-use pack',
  },
  {
    id: 'prod-paper-a4-ream',
    name: 'A4 Plain Paper (Full Ream - 500 Sheets)',
    type: 'product',
    category: 'stationery',
    price: 95.0,
    available: 35,
    unit: 'ream',
    description: 'Typek / Rotatrim 80gsm premium 500 sheets ream',
  },
  {
    id: 'prod-notebook-a5',
    name: 'A5 Counter Book / Notebook (96 Pages)',
    type: 'product',
    category: 'stationery',
    price: 18.0,
    available: 40,
    unit: 'book',
    description: 'Ruled A5 soft-cover everyday notebook',
  },
  {
    id: 'prod-notebook-a4-hard',
    name: 'A4 Hardcover Counter Book (2-Quire 192 Pages)',
    type: 'product',
    category: 'stationery',
    price: 35.0,
    available: 24,
    unit: 'book',
    description: 'Sturdy hardcover ledger/exercise book',
  },

  // --- Products: Phone Accessories ---
  {
    id: 'prod-cable-type-c',
    name: 'Fast Charging USB-C Cable (Braided 1m)',
    type: 'product',
    category: 'phone_accessories',
    price: 35.0,
    available: 28,
    unit: 'piece',
    description: '3A fast sync and charging nylon braided cable',
  },
  {
    id: 'prod-cable-micro',
    name: 'Micro-USB Cable (Durable 1m)',
    type: 'product',
    category: 'phone_accessories',
    price: 25.0,
    available: 30,
    unit: 'piece',
    description: 'Standard Android charging and data cable',
  },
  {
    id: 'prod-cable-lightning',
    name: 'Lightning Cable for iPhone (1m)',
    type: 'product',
    category: 'phone_accessories',
    price: 45.0,
    available: 15,
    unit: 'piece',
    description: 'High speed iPhone charging & sync cord',
  },
  {
    id: 'prod-charger-dual-usb',
    name: 'Dual USB Wall Charger Adapter (2.4A)',
    type: 'product',
    category: 'phone_accessories',
    price: 50.0,
    available: 18,
    unit: 'piece',
    description: 'Universal UK/Zambia 3-pin wall adapter plug',
  },
  {
    id: 'prod-earphones-35mm',
    name: 'In-Ear Stereo Earphones with Mic (3.5mm)',
    type: 'product',
    category: 'phone_accessories',
    price: 30.0,
    available: 25,
    unit: 'piece',
    description: 'Hands-free headset with bass response and microphone',
  },

  // --- Products: Snacks & Refreshments ---
  {
    id: 'prod-snack-popcorn-salted',
    name: 'Fresh Salted Popcorn (Bag)',
    type: 'product',
    category: 'snacks',
    price: 2.0,
    available: 120,
    unit: 'bag',
    description: 'Crisp salted warm popcorn popped in fresh 750ml oil & pure salt',
  },
  {
    id: 'prod-snack-popcorn-butter',
    name: 'Spiced / Butter Popcorn (Bag)',
    type: 'product',
    category: 'snacks',
    price: 2.0,
    available: 100,
    unit: 'bag',
    description: 'Savory spiced popcorn tossed in quality aromatic spices',
  },
  {
    id: 'prod-water-500ml',
    name: 'Mineral Water (Chilled 500ml)',
    type: 'product',
    category: 'snacks',
    price: 6.0,
    available: 60,
    unit: 'bottle',
    description: 'Pure purified natural spring drinking water',
  },
];

// --- Shift Register & Cash Drawer ---
export interface ShiftRecord {
  id: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  openingFloat: number;
  closedAt: string | null;
  cashSales: number;
  cashExpenses: number;
  expectedCash: number;
  handCountedCash: number | null;
  discrepancy: number | null; // handCounted - expectedCash (Over: >0, Short: <0)
  notes?: string;
  status: 'open' | 'closed';
}

// --- Micro-Expenses ---
export type ExpenseCategory =
  | 'electricity_zesco'
  | 'transport'
  | 'meals_lunch'
  | 'maintenance'
  | 'miscellaneous';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  electricity_zesco: '⚡ Electricity (ZESCO tokens)',
  transport: '🚗 Transport (Stock pickup / logistics)',
  meals_lunch: '🍲 Meals & Lunch (Staff stipends)',
  maintenance: '🔧 Maintenance & Repairs',
  miscellaneous: '📦 Miscellaneous petty expenses',
};

export interface MicroExpense {
  id: string;
  tenantId: string;
  branchId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  recordedBy: {
    id: string;
    name: string;
  };
  timestamp: string;
  receiptNote?: string;
}

// --- Cashier Fraud Audit Event ---
export type AuditEventType =
  | 'cart_item_removed'
  | 'cart_cleared'
  | 'price_override'
  | 'void_transaction'
  | 'shift_opened'
  | 'shift_closed'
  | 'expense_recorded'
  | 'station_locked'
  | 'station_unlocked';

export interface FraudAuditEvent {
  id: string;
  eventType: AuditEventType;
  userId: string;
  userName: string;
  timestamp: string;
  details: string;
  amountImpact?: number;
}

// --- On Credit / Debt Ledger ---
export interface DebtEntry {
  id: string;
  receiptId: string;
  customerName: string;
  customerPhone: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  timestamp: string;
  cashierName: string;
  status: 'outstanding' | 'partially_paid' | 'cleared';
}

// Storage helpers with in-memory fallback (for Node/Vitest) + localStorage for web
const STORAGE_PREFIX = 'sunga_pos_';

/** In-memory fallback used in non-browser environments (Vitest / Node). */
const _memStore = new Map<string, string>();

function safeGetItem<T>(key: string, defaultValue: T): T {
  const fullKey = STORAGE_PREFIX + key;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(fullKey);
      return raw !== null ? (JSON.parse(raw) as T) : defaultValue;
    }
    const raw = _memStore.get(fullKey);
    return raw !== undefined ? (JSON.parse(raw) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function safeSetItem(key: string, value: unknown): void {
  const fullKey = STORAGE_PREFIX + key;
  const serialized = JSON.stringify(value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(fullKey, serialized);
    } else {
      _memStore.set(fullKey, serialized);
    }
  } catch {
    // Ignore quota errors or serialization failures
  }
}

// Global active shift store
export function getActiveShift(): ShiftRecord | null {
  return safeGetItem<ShiftRecord | null>('active_shift', null);
}

export function saveActiveShift(shift: ShiftRecord | null): void {
  safeSetItem('active_shift', shift);
}

export function getCompletedShifts(): ShiftRecord[] {
  return safeGetItem<ShiftRecord[]>('completed_shifts', []);
}

export function archiveShift(shift: ShiftRecord): void {
  const shifts = getCompletedShifts();
  safeSetItem('completed_shifts', [shift, ...shifts.slice(0, 49)]);
  saveActiveShift(null);
}

// Fraud audit log store
export function logAuditEvent(
  eventType: AuditEventType,
  user: { id: string; name: string },
  details: string,
  amountImpact?: number,
): void {
  const logs = safeGetItem<FraudAuditEvent[]>('fraud_audit_logs', []);
  const event: FraudAuditEvent = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    eventType,
    userId: user.id,
    userName: user.name,
    timestamp: new Date().toISOString(),
    details,
    amountImpact,
  };
  safeSetItem('fraud_audit_logs', [event, ...logs.slice(0, 199)]);
}

export function getAuditLogs(): FraudAuditEvent[] {
  return safeGetItem<FraudAuditEvent[]>('fraud_audit_logs', []);
}

// Micro-expenses store
export function getMicroExpenses(): MicroExpense[] {
  return safeGetItem<MicroExpense[]>('micro_expenses', []);
}

export function addMicroExpense(expense: MicroExpense): void {
  const list = getMicroExpenses();
  safeSetItem('micro_expenses', [expense, ...list.slice(0, 199)]);
}

// Debt ledger store
export function getDebtEntries(): DebtEntry[] {
  const entries = safeGetItem<DebtEntry[]>('debt_entries', []);
  if (entries.length === 0) {
    const defaultEntries: DebtEntry[] = [
      {
        id: 'debt-init-1',
        receiptId: 'REC-NK201',
        customerName: 'Chanda Mwewa (Kalingalinga)',
        customerPhone: '+260 977 123456',
        amountDue: 450.0,
        amountPaid: 150.0,
        balance: 300.0,
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        cashierName: 'Nicholas Ntambila',
        status: 'partially_paid',
      },
      {
        id: 'debt-init-2',
        receiptId: 'REC-NK204',
        customerName: 'Banda Logistics & Printing',
        customerPhone: '+260 966 889900',
        amountDue: 820.0,
        amountPaid: 200.0,
        balance: 620.0,
        timestamp: new Date(Date.now() - 86400000 * 4).toISOString(),
        cashierName: 'Nicholas Ntambila',
        status: 'partially_paid',
      },
      {
        id: 'debt-init-3',
        receiptId: 'REC-NK209',
        customerName: 'Mulenga School Supplies',
        customerPhone: '+260 955 442211',
        amountDue: 350.0,
        amountPaid: 0.0,
        balance: 350.0,
        timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
        cashierName: 'Nicholas Ntambila',
        status: 'outstanding',
      },
    ];
    safeSetItem('debt_entries', defaultEntries);
    return defaultEntries;
  }
  return entries;
}

export function addDebtEntry(entry: DebtEntry): void {
  const list = getDebtEntries();
  safeSetItem('debt_entries', [entry, ...list.slice(0, 199)]);
}

/** Mark a debt entry as partially paid or cleared. */
export function updateDebtEntry(id: string, payment: number): DebtEntry | null {
  const list = getDebtEntries();
  let updated: DebtEntry | null = null;
  const next = list.map((e) => {
    if (e.id !== id) return e;
    const newPaid = e.amountPaid + payment;
    const newBalance = Math.max(0, e.amountDue - newPaid);
    const status: DebtEntry['status'] =
      newBalance <= 0
        ? 'cleared'
        : newPaid > 0
          ? 'partially_paid'
          : 'outstanding';
    updated = { ...e, amountPaid: newPaid, balance: newBalance, status };
    return updated;
  });
  safeSetItem('debt_entries', next);
  return updated;
}

// ─── Restock Records ───────────────────────────────────────────────────────────
export interface RestockRecord {
  id: string;
  itemId: string;
  itemName: string;
  quantityAdded: number;
  costPerUnit: number;
  totalCost: number;
  supplier?: string;
  recordedBy: { id: string; name: string };
  timestamp: string;
  notes?: string;
}

export function addRestockRecord(record: RestockRecord): void {
  const list = safeGetItem<RestockRecord[]>('restock_records', []);
  safeSetItem('restock_records', [record, ...list.slice(0, 299)]);
}

export function getRestockRecords(): RestockRecord[] {
  return safeGetItem<RestockRecord[]>('restock_records', []);
}

// ─── Cost-Fluctuation Shield ───────────────────────────────────────────────────
/** Stores the owner-configured base cost for a catalog item. */
export interface CostFluctuationEntry {
  itemId: string;
  itemName: string;
  baseCostPerUnit: number; // What owner paid last time
  sellingPrice: number; // Current selling price
  minimumMarginPct: number; // Alert if margin falls below this %
  updatedAt: string;
}

export function getCostFluctuationEntries(): CostFluctuationEntry[] {
  return safeGetItem<CostFluctuationEntry[]>('cost_fluctuation', []);
}

export function saveCostFluctuationEntry(entry: CostFluctuationEntry): void {
  const list = getCostFluctuationEntries().filter(
    (e) => e.itemId !== entry.itemId,
  );
  safeSetItem('cost_fluctuation', [entry, ...list]);
}

/** Returns items where (sellingPrice - baseCost) / sellingPrice < minimumMarginPct */
export function getMarginAlerts(): (CostFluctuationEntry & {
  marginPct: number;
  suggestedPrice: number;
})[] {
  return getCostFluctuationEntries()
    .map((e) => {
      const marginPct =
        e.sellingPrice > 0
          ? ((e.sellingPrice - e.baseCostPerUnit) / e.sellingPrice) * 100
          : 0;
      const suggestedPrice = e.baseCostPerUnit / (1 - e.minimumMarginPct / 100);
      return { ...e, marginPct, suggestedPrice };
    })
    .filter((e) => e.marginPct < e.minimumMarginPct);
}

// ─── Consumable Estimator (Paper & Ink) ────────────────────────────────────────
export interface ConsumableSession {
  id: string;
  date: string; // ISO date
  bwPages: number; // Black & white pages printed/copied
  colorPages: number; // Color pages printed/copied
  photoPages: number; // Photo-quality pages
  inkCartridgesUsed: number; // Full equivalent cartridges consumed
  paperSheetsUsed: number; // Sheets consumed
}

/** Cumulative daily page-count tracker for consumable estimation. */
export function logConsumableSession(session: ConsumableSession): void {
  const list = safeGetItem<ConsumableSession[]>('consumable_sessions', []);
  safeSetItem('consumable_sessions', [session, ...list.slice(0, 364)]);
}

export function getConsumableSessions(): ConsumableSession[] {
  return safeGetItem<ConsumableSession[]>('consumable_sessions', []);
}

export interface ConsumableStock {
  a4ReemsInStock: number; // 1 ream = 500 sheets
  inkCartridgesInStock: number; // B/W cartridge equivalents
  colorCartridgesInStock: number; // Color cartridge equivalents
  lastUpdated: string;
}

export function getConsumableStock(): ConsumableStock {
  return safeGetItem<ConsumableStock>('consumable_stock', {
    a4ReemsInStock: 8,
    inkCartridgesInStock: 3,
    colorCartridgesInStock: 2,
    lastUpdated: new Date().toISOString(),
  });
}

export function saveConsumableStock(stock: ConsumableStock): void {
  safeSetItem('consumable_stock', stock);
}

/**
 * AI-style estimator: uses 7-day rolling average to project days until
 * paper reams and ink cartridges run out.
 *
 * B/W yield: ~2,500 pages/cartridge
 * Color yield: ~1,300 pages/cartridge
 * 1 ream = 500 sheets
 */
export function estimateConsumableRunway(): {
  avgDailyBwPages: number;
  avgDailyColorPages: number;
  avgDailySheets: number;
  paperDaysLeft: number;
  bwInkDaysLeft: number;
  colorInkDaysLeft: number;
  lowPaper: boolean;
  lowBwInk: boolean;
  lowColorInk: boolean;
} {
  const sessions = getConsumableSessions();
  const stock = getConsumableStock();

  // 7-day rolling window
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const recent = sessions.filter(
    (s) => now - new Date(s.date).getTime() < week,
  );

  const days = Math.max(1, recent.length || 1);
  const totalBw = recent.reduce((a, s) => a + s.bwPages, 0);
  const totalColor = recent.reduce((a, s) => a + s.colorPages, 0);
  const totalSheets = recent.reduce((a, s) => a + s.paperSheetsUsed, 0);

  const avgDailyBwPages = totalBw / days;
  const avgDailyColorPages = totalColor / days;
  const avgDailySheets = totalSheets / days;

  const sheetsInStock = stock.a4ReemsInStock * 500;
  const paperDaysLeft =
    avgDailySheets > 0 ? sheetsInStock / avgDailySheets : 999;

  const BW_YIELD = 2500;
  const COLOR_YIELD = 1300;
  const bwInkDaysLeft =
    avgDailyBwPages > 0
      ? (stock.inkCartridgesInStock * BW_YIELD) / avgDailyBwPages
      : 999;
  const colorInkDaysLeft =
    avgDailyColorPages > 0
      ? (stock.colorCartridgesInStock * COLOR_YIELD) / avgDailyColorPages
      : 999;

  return {
    avgDailyBwPages: Math.round(avgDailyBwPages),
    avgDailyColorPages: Math.round(avgDailyColorPages),
    avgDailySheets: Math.round(avgDailySheets),
    paperDaysLeft: Math.floor(paperDaysLeft),
    bwInkDaysLeft: Math.floor(bwInkDaysLeft),
    colorInkDaysLeft: Math.floor(colorInkDaysLeft),
    lowPaper: paperDaysLeft <= 3,
    lowBwInk: bwInkDaysLeft <= 3,
    lowColorInk: colorInkDaysLeft <= 3,
  };
}

// ─── Predictive Cash-Runway Calculator ─────────────────────────────────────────
export interface CashRunwaySnapshot {
  cashInDrawer: number; // Current counted cash
  avgDailyExpenses: number; // Rolling 7-day avg of daily expenses
  runwayDays: number; // cashInDrawer / avgDailyExpenses
  openingFloat: number;
  todayCashSales: number;
  todayExpenses: number;
  snapshotTime: string;
}

export function computeCashRunway(
  cashInDrawer: number,
  openingFloat: number,
  todayCashSales: number,
  todayExpenses: number,
): CashRunwaySnapshot {
  const expenses = getMicroExpenses();

  // Build 7-day daily expense map
  const dailyTotals: Record<string, number> = {};
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  expenses
    .filter((e) => now - new Date(e.timestamp).getTime() < week)
    .forEach((e) => {
      const day = e.timestamp.slice(0, 10);
      dailyTotals[day] = (dailyTotals[day] ?? 0) + e.amount;
    });

  const days = Object.keys(dailyTotals).length || 1;
  const totalExpenses = Object.values(dailyTotals).reduce((a, b) => a + b, 0);
  const avgDailyExpenses = totalExpenses / days;
  const runwayDays =
    avgDailyExpenses > 0 ? cashInDrawer / avgDailyExpenses : 999;

  return {
    cashInDrawer,
    avgDailyExpenses: Math.round(avgDailyExpenses * 100) / 100,
    runwayDays: Math.floor(runwayDays),
    openingFloat,
    todayCashSales,
    todayExpenses,
    snapshotTime: new Date().toISOString(),
  };
}

// ─── Popcorn Production & Batch Cost Shield ──────────────────────────────────
export interface PopcornBatchRecipe {
  gallonCornCost: number; // Cost of 1 Gallon popping corn (e.g. K180)
  cookingOil750mlCost: number; // Cost of 750ml cooking oil (e.g. K55)
  plasticsCaseCost: number; // Cost of case of exactly 500 plastics (e.g. K60)
  plasticsCountPerCase: number; // Exactly 500 bags
  spicesCost: number; // Exactly K20 spices
  saltCost: number; // Exactly K5 salt
  sellingPricePerBag: number; // Exactly K2 per bag
}

export const DEFAULT_POPCORN_RECIPE: PopcornBatchRecipe = {
  gallonCornCost: 180,
  cookingOil750mlCost: 55,
  plasticsCaseCost: 60,
  plasticsCountPerCase: 500,
  spicesCost: 20,
  saltCost: 5,
  sellingPricePerBag: 2.0,
};

export interface PopcornBatchRecord {
  id: string;
  batchNumber: string;
  startedAt: string;
  gallonsPopped: number;
  cookingOilMl: number;
  plasticBagsYield: number; // 500 bags
  spicesCost: number; // K20
  saltCost: number; // K5
  totalProductionCost: number;
  expectedGrossRevenue: number; // 500 * K2 = K1,000
  expectedNetProfit: number;
  costPerBag: number;
  recordedBy: string;
  status: 'active_popping' | 'completed' | 'sold_out';
  notes?: string;
}

export function computePopcornBatchMetrics(
  gallons = 1,
  recipe: PopcornBatchRecipe = DEFAULT_POPCORN_RECIPE,
) {
  const cornCost = gallons * recipe.gallonCornCost;
  const oilCost = gallons * recipe.cookingOil750mlCost;
  const plasticsCost = gallons * recipe.plasticsCaseCost;
  const spicesCost = gallons * recipe.spicesCost;
  const saltCost = gallons * recipe.saltCost;

  const totalCost = cornCost + oilCost + plasticsCost + spicesCost + saltCost;
  const expectedBags = gallons * recipe.plasticsCountPerCase;
  const expectedRevenue = expectedBags * recipe.sellingPricePerBag;
  const expectedProfit = expectedRevenue - totalCost;
  const costPerBag = expectedBags > 0 ? totalCost / expectedBags : 0;
  const marginPercentage =
    expectedRevenue > 0 ? (expectedProfit / expectedRevenue) * 100 : 0;

  return {
    gallons,
    cornCost,
    oilCost,
    plasticsCost,
    spicesCost,
    saltCost,
    totalCost,
    expectedBags,
    expectedRevenue,
    expectedProfit,
    costPerBag: Math.round(costPerBag * 100) / 100,
    marginPercentage: Math.round(marginPercentage * 10) / 10,
  };
}

export function getPopcornBatches(): PopcornBatchRecord[] {
  return safeGetItem<PopcornBatchRecord[]>('popcorn_batches', [
    {
      id: 'batch-init-01',
      batchNumber: 'POP-GAL-001',
      startedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      gallonsPopped: 1,
      cookingOilMl: 750,
      plasticBagsYield: 500,
      spicesCost: 20,
      saltCost: 5,
      totalProductionCost: 320,
      expectedGrossRevenue: 1000,
      expectedNetProfit: 680,
      costPerBag: 0.64,
      recordedBy: 'Nicholas Ntambila',
      status: 'active_popping',
      notes: 'Fresh popping: 1 Gal corn + 750ml oil + 500 plastic bags + K20 spices + K5 salt',
    },
  ]);
}

export function savePopcornBatch(batch: PopcornBatchRecord): void {
  const current = getPopcornBatches();
  const existingIdx = current.findIndex((b) => b.id === batch.id);
  let updated: PopcornBatchRecord[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = batch;
  } else {
    updated = [batch, ...current];
  }
  safeSetItem('popcorn_batches', updated);
}

// ─── Quotations Sync & Persistence ───────────────────────────────────────────
import type { QuotationData } from './sanit3ch-brand';

export function getStoredQuotations(): QuotationData[] {
  return safeGetItem<QuotationData[]>('quotations_list', [
    {
      id: 'qt-sample-01',
      quotationNumber: 'ST-QT-202610-1042',
      date: '2026-10-23',
      validUntil: '2026-11-06',
      preparedBy: 'Nicholas Ntambila',
      client: {
        clientName: 'Copperbelt Logistics Ltd',
        contactPerson: 'Mr. Mulenga',
        phone: '0977123456',
        email: 'logistics@cb.zm',
        address: 'Parklands, Kitwe',
      },
      items: [
        {
          id: '1',
          description: 'A4 Wall Stickers Glossy Adhesive Print (Bulk)',
          quantity: 20,
          unitPrice: 35.0,
          total: 700.0,
        },
        {
          id: '2',
          description: 'Company Profile Comb Binding (Acetate Covers)',
          quantity: 10,
          unitPrice: 25.0,
          total: 250.0,
        },
        {
          id: '3',
          description: 'Heavyweight Certificates Full Color Print',
          quantity: 25,
          unitPrice: 20.0,
          total: 500.0,
        },
      ],
      subtotal: 1450.0,
      discountPercentage: 10,
      discountAmount: 145.0,
      grandTotal: 1305.0,
      depositRequired: 652.5,
      balanceDue: 652.5,
      status: 'draft',
      notes: '50% deposit required via MTN 0768990586 or Airtel 20051880.',
      createdAt: new Date().toISOString(),
    },
  ]);
}

export function saveStoredQuotation(qt: QuotationData): void {
  const current = getStoredQuotations();
  const existingIdx = current.findIndex((q) => q.id === qt.id);
  let updated: QuotationData[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = qt;
  } else {
    updated = [qt, ...current];
  }
  safeSetItem('quotations_list', updated);
}

