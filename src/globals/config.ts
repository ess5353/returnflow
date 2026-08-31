export const config = {
  // Graph API and Store config
  graphApiUrl: process.env.NEXT_PUBLIC_GRAPH_API_URL,
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL,
  cookiePassword: process.env.SECRET_COOKIE_PASSWORD,

  // OAuth configuration
  // Only request scopes the app actually calls operations under. The app
  // reads orders (listOrders / listOrderByNumber) to look up and verify
  // return/exchange requests, and writes orders (refundOrderLine,
  // cancelOrderLine, updateOrderPackageStatus, createOrderWithTransactions,
  // addOrderTimelineEntry) to perform real refunds and process exchanges —
  // it never touches products, inventories, customers, or campaigns.
  // Requesting read_products, read_inventories, write_inventories, etc. when
  // nothing in the codebase uses them is exactly the kind of over-broad
  // permission request that blocks ikas App Store approval.
  //
  // NOTE: `write_orders` must also be enabled for this app in the ikas
  // Partner Panel (App Settings → Scopes) — requesting it here does not by
  // itself grant it. Existing installs must re-authorize (re-run the OAuth
  // flow) to upgrade their token to include it; until they do, refund/
  // exchange calls will fail with an ikas permission error, which the refund
  // endpoint surfaces as a clear merchant-facing message rather than a fake
  // success.
  oauth: {
    scope: 'read_orders write_orders',
    clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: `${process.env.NEXT_PUBLIC_DEPLOY_URL}/api/oauth/callback/ikas`,
  }
};

export type Config = typeof config;
