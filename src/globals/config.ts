export const config = {
  // Graph API and Store config
  graphApiUrl: process.env.NEXT_PUBLIC_GRAPH_API_URL,
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL,
  cookiePassword: process.env.SECRET_COOKIE_PASSWORD,

  // OAuth configuration
  // Only request scopes the app actually calls operations under. The app
  // reads orders (listOrders / listOrderByNumber) to look up and verify
  // return/exchange requests — it never writes orders, and never touches
  // products, inventories, customers, or campaigns. Requesting write_orders,
  // read_products, read_inventories, write_inventories, etc. when nothing in
  // the codebase uses them is exactly the kind of over-broad permission
  // request that blocks ikas App Store approval.
  oauth: {
    scope: 'read_orders',
    clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: `${process.env.NEXT_PUBLIC_DEPLOY_URL}/api/oauth/callback/ikas`,
  }
};

export type Config = typeof config;
