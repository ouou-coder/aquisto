
export interface ColorQty {
  color: string;
  quantity: number;
}

export interface StoreAllocation {
  storeId: number;
  items: ColorQty[]; 
}

export interface ProcurementRecord {
  id: string;
  timestamp: number;
  supplier: string;
  model: string;
  costPrice: number;
  sellPrice: number;
  color: string; 
  unit: '件' | '包';
  image: string; 
  allocations: { storeId: number; totalQuantity: number }[]; 
  detailAllocations: StoreAllocation[]; 
  totalQuantity: number;
}

export enum AppTab {
  TODAY = 'today',
  PROCURE = 'procure',
  SUMMARY = 'summary',
  SETTINGS = 'settings'
}
