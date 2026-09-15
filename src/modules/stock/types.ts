export const STOCK_MOVEMENT_TYPES = ["in", "out", "inventory_adjustment"] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export type StockStatus = "ok" | "low" | "critical";

export type ProductItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number;
  avgDailyUsage: number;
  unitCostCents: number;
  supplierName: string | null;
  /// null si avgDailyUsage = 0 — pas de consommation connue, donc pas d'estimation
  /// honnête possible (voir compute.ts).
  daysLeft: number | null;
  status: StockStatus;
  stockValueCents: number;
};

export type StockMovementItem = {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  note: string | null;
  createdAt: string;
};

export type SupplierOption = { id: string; name: string };

export type StockOverview = {
  products: ProductItem[];
  suppliers: SupplierOption[];
  totalStockValueCents: number;
  lowCount: number;
  criticalCount: number;
  recentMovements: StockMovementItem[];
  canManage: boolean;
};
