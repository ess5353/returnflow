export type InsightSeverity = 'info' | 'positive' | 'warning' | 'critical';

export type InsightSection =
  | 'executive_summary'
  | 'return_trends'
  | 'exchange_trends'
  | 'top_returned_products'
  | 'top_return_reasons'
  | 'automation_performance'
  | 'financial_impact'
  | 'customer_behaviour'
  | 'actionable_recommendations';

export type Insight = {
  id: string;
  section: InsightSection;
  title: string;
  description: string;
  severity: InsightSeverity;
  confidence: number; // 0–100
  recommendation: string;
};

export type WeeklyPoint = {
  week: string; // e.g. "31 Tem"
  returns: number;
  exchanges: number;
};

export type TopItem = {
  label: string;
  count: number;
  pct: number; // % of total
};

export type MerchantStats = {
  // Counts
  totalRequests: number;
  totalReturns: number;
  totalExchanges: number;

  // Status distribution
  byStatus: Record<string, number>;

  // Time series — last 8 weeks
  weeklyTrend: WeeklyPoint[];

  // Products
  topReturnedProducts: TopItem[];

  // Reasons
  topReturnReasons: TopItem[];

  // Automation
  totalAutomated: number;
  automationMatchRate: number; // %
  topAutomationRules: { ruleName: string; count: number }[];

  // Financial (amounts as numeric)
  totalAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
  avgAmount: number;

  // Customer behaviour
  totalUniqueCustomers: number;
  repeatCustomers: number; // customers with >1 return
  avgResolutionDays: number;
};

export type InsightsPayload = {
  insights: Insight[];
  stats: MerchantStats;
  generatedAt: string;
  expiresAt: string;
  aiPowered: boolean;
};
