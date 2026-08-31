import { BaseGraphQLAPIClient, BaseGraphQLAPIClientOptions, APIResult } from '@ikas/admin-api-client';

// NOTE: These enums are manually maintained — codegen does not emit enums
// that are only referenced as a field type within a selection set (as
// opposed to being used as an operation's variable type). Re-add after any
// `pnpm codegen` run that removes them.
export enum MerchantSubscriptionStatusEnum {
  ACTIVE = "ACTIVE",
  REMOVED = "REMOVED",
  WILL_BE_REMOVED = "WILL_BE_REMOVED"
}

export enum OrderLineItemStatusEnum {
  CANCELLED = "CANCELLED",
  CANCEL_REJECTED = "CANCEL_REJECTED",
  CANCEL_REQUESTED = "CANCEL_REQUESTED",
  DELIVERED = "DELIVERED",
  FULFILLED = "FULFILLED",
  PLANNED = "PLANNED",
  REFUNDED = "REFUNDED",
  REFUND_REJECTED = "REFUND_REJECTED",
  REFUND_REQUESTED = "REFUND_REQUESTED",
  REFUND_REQUEST_ACCEPTED = "REFUND_REQUEST_ACCEPTED",
  RETURN_DELIVERED = "RETURN_DELIVERED",
  RETURN_IN_TRANSIT = "RETURN_IN_TRANSIT",
  RETURN_PARCEL_WAITING = "RETURN_PARCEL_WAITING",
  RETURN_REJECTED = "RETURN_REJECTED",
  UNFULFILLED = "UNFULFILLED",
  WAITING_FOR_PACKAGING = "WAITING_FOR_PACKAGING"
}

export enum TransactionStatusEnum {
  AUTHORIZED = "AUTHORIZED",
  CANCELLED = "CANCELLED",
  FAILED = "FAILED",
  PENDING = "PENDING",
  SUCCESS = "SUCCESS"
}

export enum TransactionTypeEnum {
  REFUND = "REFUND",
  SALE = "SALE",
  VOID = "VOID"
}

export enum MerchantAppPaymentStatusEnum {
  PAID = "PAID",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  WAITING_FOR_PAYMENT = "WAITING_FOR_PAYMENT"
}

export enum OrderAdjustmentEnum {
  DECREMENT = "DECREMENT",
  INCREMENT = "INCREMENT"
}

export enum OrderAmountTypeEnum {
  AMOUNT = "AMOUNT",
  RATIO = "RATIO"
}

export enum OrderPackageFulfillStatusEnum {
  CANCELLED = "CANCELLED",
  CANCEL_REJECTED = "CANCEL_REJECTED",
  CANCEL_REQUESTED = "CANCEL_REQUESTED",
  DELIVERED = "DELIVERED",
  ERROR = "ERROR",
  FULFILLED = "FULFILLED",
  PLANNED = "PLANNED",
  READY_FOR_PICK_UP = "READY_FOR_PICK_UP",
  READY_FOR_SHIPMENT = "READY_FOR_SHIPMENT",
  REFUNDED = "REFUNDED",
  REFUND_REJECTED = "REFUND_REJECTED",
  REFUND_REQUESTED = "REFUND_REQUESTED",
  REFUND_REQUEST_ACCEPTED = "REFUND_REQUEST_ACCEPTED",
  RETURN_DELIVERED = "RETURN_DELIVERED",
  RETURN_IN_TRANSIT = "RETURN_IN_TRANSIT",
  RETURN_PARCEL_WAITING = "RETURN_PARCEL_WAITING",
  RETURN_REJECTED = "RETURN_REJECTED",
  UNABLE_TO_DELIVER = "UNABLE_TO_DELIVER",
  WAITING_FOR_PACKAGING = "WAITING_FOR_PACKAGING"
}

export enum OrderPaymentStatusEnum {
  FAILED = "FAILED",
  OVER_PAID = "OVER_PAID",
  PAID = "PAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  REFUNDED = "REFUNDED",
  WAITING = "WAITING"
}

export enum OrderShippingMethodEnum {
  CLICK_AND_COLLECT = "CLICK_AND_COLLECT",
  DIGITAL_DELIVERY = "DIGITAL_DELIVERY",
  NO_SHIPMENT = "NO_SHIPMENT",
  SHIPMENT = "SHIPMENT"
}

export enum OrderStatusEnum {
  CANCELLED = "CANCELLED",
  CREATED = "CREATED",
  DRAFT = "DRAFT",
  PARTIALLY_CANCELLED = "PARTIALLY_CANCELLED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  REFUNDED = "REFUNDED",
  REFUND_REJECTED = "REFUND_REJECTED",
  REFUND_REQUESTED = "REFUND_REQUESTED",
  WAITING_UPSELL_ACTION = "WAITING_UPSELL_ACTION"
}

export type BundleProductOrderLineInput = {
  bundleLineId: string;
  bundleLineQuantity: number;
  name?: string;
  options?: Array<OrderLineOptionInput>;
  variant: OrderLineVariantInput;
}

export type BundleProductOrderLineInputVariant = {
  id: string;
}

export type CancelOrderLineInput = {
  orderId: string;
  orderLineItems: Array<CancelOrderLineItemInput>;
}

export type CancelOrderLineItemInput = {
  orderLineItemId: string;
  price: number;
  quantity: number;
  restockItems: boolean;
}

export type CreateMerchantAppPaymentWithSubscriptionInput = {
  storeAppListingSubscriptionKey: string;
}

export type OrderAddressRegionInput = {
  id: string;
  name: string;
}

export type OrderAdjustmentInput = {
  amount: number;
  amountType: OrderAmountTypeEnum;
  campaignId?: string;
  couponId?: string;
  name: string;
  order: number;
  type: OrderAdjustmentEnum;
}

export type OrderCustomerInput = {
  email?: string;
  firstName?: string;
  id?: string;
  lastName?: string;
}

export type OrderLineDiscountInput = {
  amount: number;
  amountType: OrderAmountTypeEnum;
  maxApplicableQuantity?: number;
  reason?: string;
}

export type OrderLineOptionInput = {
  productOptionId: string;
  productOptionsSetId: string;
  values: Array<OrderLineOptionValueInput>;
}

export type OrderLineOptionValueInput = {
  price?: number;
  value: string;
}

export type OrderLineVariantBundleProductInput = {
  id: string;
  order: number;
  productId: string;
  quantity: number;
  variant: BundleProductOrderLineInputVariant;
}

export type OrderLineVariantInput = {
  bundleProducts?: Array<OrderLineVariantBundleProductInput>;
  id?: string;
  name?: string;
}

export type OrderRefundLineInput = {
  orderLineItemId: string;
  price: number;
  quantity: number;
  restockItems: boolean;
}

export type OrderRefundRejectedLineInput = {
  orderLineItemId: string;
  quantity: number;
}

export type OrderRefundTransactionInput = {
  amount: number;
  refundToStoreCredit?: boolean;
  transactionId: string;
}

export type OrderTransactionInput = {
  amount: number;
  paymentGatewayId?: string;
}

export type PublicCreateOrderInput = {
  billingAddress?: PublicOrderAddressInput;
  branchSessionId?: string;
  currencyCode?: string;
  customer?: OrderCustomerInput;
  host?: string;
  note?: string;
  orderAdjustments?: Array<OrderAdjustmentInput>;
  orderLineItems: Array<PublicOrderLineItemInput>;
  orderTagIds?: Array<string>;
  orderedAt?: number;
  priceListId?: string;
  salesChannelId?: string;
  shippingAddress?: PublicOrderAddressInput;
  shippingLines?: Array<PublicOrderShippingLineInput>;
  shippingMethod?: OrderShippingMethodEnum;
  sourceId?: string;
  staff?: PublicOrderStaffInput;
  terminalId?: string;
}

export type PublicCreateOrderWithTransactionsInput = {
  disableAutoCreateCustomer?: boolean;
  isTaxFreeOrder?: boolean;
  order: PublicCreateOrderInput;
  transactions: Array<OrderTransactionInput>;
}

export type PublicOrderAddressCityInput = {
  code?: string;
  name: string;
}

export type PublicOrderAddressCountryInput = {
  code?: string;
  iso2?: string;
  iso3?: string;
  name: string;
}

export type PublicOrderAddressDistrictInput = {
  code?: string;
  name?: string;
}

export type PublicOrderAddressInput = {
  addressLine1: string;
  addressLine2?: string;
  city: PublicOrderAddressCityInput;
  company?: string;
  country: PublicOrderAddressCountryInput;
  district?: PublicOrderAddressDistrictInput;
  firstName: string;
  identityNumber?: string;
  isDefault: boolean;
  lastName: string;
  phone?: string;
  postalCode?: string;
  region?: OrderAddressRegionInput;
  state?: PublicOrderAddressStateInput;
  taxNumber?: string;
  taxOffice?: string;
}

export type PublicOrderAddressStateInput = {
  code?: string;
  name?: string;
}

export type PublicOrderLineItemInput = {
  bundleProductSettings?: BundleProductOrderLineInput;
  discount?: OrderLineDiscountInput;
  discountPrice?: number;
  options?: Array<OrderLineOptionInput>;
  price: number;
  quantity: number;
  sourceId?: string;
  variant: OrderLineVariantInput;
}

export type PublicOrderRefundBranchInfoInput = {
  branchSessionId: string;
  terminalId: string;
}

export type PublicOrderRefundInput = {
  branchInfo?: PublicOrderRefundBranchInfoInput;
  forceRefund?: boolean;
  orderId: string;
  orderRefundLines: Array<OrderRefundLineInput>;
  orderRefundTransactions?: Array<OrderRefundTransactionInput>;
  orderRejectedRefundLines?: Array<OrderRefundRejectedLineInput>;
  reason?: string;
  refundGift?: boolean;
  refundShipping?: boolean;
  sendNotificationToCustomer?: boolean;
  stockLocationId: string;
}

export type PublicOrderShippingLineInput = {
  price: number;
  priceListId?: string;
  taxValue?: number;
  title: string;
}

export type PublicOrderStaffInput = {
  email: string;
  firstName: string;
  id: string;
  lastName: string;
}

export type PublicTimelineInput = {
  message: string;
  sourceId: string;
}

export type StringFilterInput = {
  eq?: string;
  in?: Array<string>;
  ne?: string;
  nin?: Array<string>;
}

export type TrackingInfoDetailInput = {
  barcode?: string;
  cargoCompany?: string;
  cargoCompanyId?: string;
  isSendNotification?: boolean;
  shippingLabelImageBase64?: string;
  trackingLink?: string;
  trackingNumber?: string;
}

export type UpdateOrderPackageStatusInput = {
  errorMessage?: string;
  orderId: string;
  packageId?: string;
  sourceId?: string;
  status: OrderPackageFulfillStatusEnum;
  trackingInfo?: TrackingInfoDetailInput;
}

export type GetMerchantQueryVariables = {}

export type GetMerchantQueryData = {
  id: string;
  email: string;
  storeName?: string;
}

export interface GetMerchantQuery {
  getMerchant: GetMerchantQueryData;
}

export type GetAuthorizedAppQueryVariables = {}

export type GetAuthorizedAppQueryData = {
  id: string;
  salesChannelId?: string;
}

export interface GetAuthorizedAppQuery {
  getAuthorizedApp: GetAuthorizedAppQueryData;
}

export type GetMerchantLicenceQueryVariables = {}

export type GetMerchantLicenceQueryData = {
  merchantId: string;
  appSubscriptions?: Array<{
  id: string;
  name: string;
  status: MerchantSubscriptionStatusEnum;
  storeAppListingSubscriptionKey: string;
  lastPaymentDate?: number;
  lastPaymentPeriodInDays: number;
  lastPaymentPrice: number;
  addedDate?: number;
}>;
}

export interface GetMerchantLicenceQuery {
  getMerchantLicence: GetMerchantLicenceQueryData;
}

export type CreateMerchantAppPaymentMutationVariables = {
  input: CreateMerchantAppPaymentWithSubscriptionInput;
}

export type CreateMerchantAppPaymentMutationData = {
  id: string;
  merchantPaymentUrl: string;
  status: MerchantAppPaymentStatusEnum;
}

export interface CreateMerchantAppPaymentMutation {
  createMerchantAppPayment: CreateMerchantAppPaymentMutationData;
}

export type ListMerchantAppPaymentQueryVariables = {}

export type ListMerchantAppPaymentQueryData = {
  count: number;
  data: Array<{
  id: string;
  status: MerchantAppPaymentStatusEnum;
  paymentDate?: number;
  storeAppListingSubscriptionKey?: string;
}>;
}

export interface ListMerchantAppPaymentQuery {
  listMerchantAppPayment: ListMerchantAppPaymentQueryData;
}

export type ListOrdersQueryVariables = {}

export type ListOrdersQueryData = {
  count: number;
  data: Array<{
  id: string;
  orderNumber?: string;
  orderedAt?: number;
  status: OrderStatusEnum;
  currencyCode: string;
  totalPrice: number;
  customer?: {
  firstName?: string;
  lastName?: string;
  email?: string;
};
  orderLineItems: Array<{
  quantity: number;
  finalPrice?: number;
  variant: {
  id?: string;
  name: string;
  sku?: string;
};
}>;
}>;
}

export interface ListOrdersQuery {
  listOrder: ListOrdersQueryData;
}

export type ListOrderByNumberQueryVariables = {
  orderNumber?: StringFilterInput;
  customerEmail?: StringFilterInput;
}

export type ListOrderByNumberQueryData = {
  count: number;
  data: Array<{
  id: string;
  orderNumber?: string;
  orderedAt?: number;
  status: OrderStatusEnum;
  currencyCode: string;
  totalPrice: number;
  totalFinalPrice: number;
  stockLocationId?: string;
  customer?: {
  firstName?: string;
  lastName?: string;
  email?: string;
};
  orderLineItems: Array<{
  id: string;
  quantity: number;
  finalPrice?: number;
  price: number;
  status: OrderLineItemStatusEnum;
  variant: {
  id?: string;
  name: string;
  sku?: string;
};
}>;
}>;
}

export interface ListOrderByNumberQuery {
  listOrder: ListOrderByNumberQueryData;
}

export type GetOrderForRefundQueryVariables = {
  id?: StringFilterInput;
}

export type GetOrderForRefundQueryData = {
  count: number;
  data: Array<{
  id: string;
  orderNumber?: string;
  status: OrderStatusEnum;
  orderPaymentStatus?: OrderPaymentStatusEnum;
  currencyCode: string;
  totalFinalPrice: number;
  stockLocationId?: string;
  customer?: {
  email?: string;
};
  orderLineItems: Array<{
  id: string;
  quantity: number;
  price: number;
  finalPrice?: number;
  finalUnitPrice?: number;
  status: OrderLineItemStatusEnum;
  stockLocationId?: string;
  variant: {
  id?: string;
  name: string;
  sku?: string;
};
}>;
  orderPackages?: Array<{
  id: string;
  orderLineItemIds: Array<string>;
  orderPackageFulfillStatus: OrderPackageFulfillStatusEnum;
}>;
}>;
}

export interface GetOrderForRefundQuery {
  listOrder: GetOrderForRefundQueryData;
}

export type ListOrderTransactionsQueryVariables = {
  orderId: string;
}

export type ListOrderTransactionsQueryData = Array<{
  id: string;
  amount: number;
  status: TransactionStatusEnum;
  type: TransactionTypeEnum;
  processedAt?: number;
}>

export interface ListOrderTransactionsQuery {
  listOrderTransactions: ListOrderTransactionsQueryData;
}

export type RefundOrderLineMutationVariables = {
  input: PublicOrderRefundInput;
}

export type RefundOrderLineMutationData = {
  id: string;
  status: OrderStatusEnum;
  orderPaymentStatus?: OrderPaymentStatusEnum;
  netTotalFinalPrice?: number;
  orderLineItems: Array<{
  id: string;
  status: OrderLineItemStatusEnum;
}>;
}

export interface RefundOrderLineMutation {
  refundOrderLine: RefundOrderLineMutationData;
}

export type CancelOrderLineMutationVariables = {
  input: CancelOrderLineInput;
}

export type CancelOrderLineMutationData = {
  id: string;
  status: OrderStatusEnum;
  orderLineItems: Array<{
  id: string;
  status: OrderLineItemStatusEnum;
}>;
}

export interface CancelOrderLineMutation {
  cancelOrderLine: CancelOrderLineMutationData;
}

export type UpdateOrderPackageStatusMutationVariables = {
  input: UpdateOrderPackageStatusInput;
}

export type UpdateOrderPackageStatusMutationData = {
  id: string;
  status: OrderStatusEnum;
  orderPackages?: Array<{
  id: string;
  orderPackageFulfillStatus: OrderPackageFulfillStatusEnum;
}>;
}

export interface UpdateOrderPackageStatusMutation {
  updateOrderPackageStatus: UpdateOrderPackageStatusMutationData;
}

export type AddOrderTimelineEntryMutationVariables = {
  input: PublicTimelineInput;
}

export type AddOrderTimelineEntryMutationData = boolean

export interface AddOrderTimelineEntryMutation {
  addOrderTimelineEntry: AddOrderTimelineEntryMutationData;
}

export type CreateOrderWithTransactionsMutationVariables = {
  input: PublicCreateOrderWithTransactionsInput;
}

export type CreateOrderWithTransactionsMutationData = {
  id: string;
  orderNumber?: string;
  status: OrderStatusEnum;
}

export interface CreateOrderWithTransactionsMutation {
  createOrderWithTransactions: CreateOrderWithTransactionsMutationData;
}

export class GeneratedQueries {
  client: BaseGraphQLAPIClient<any>;

  constructor(client: BaseGraphQLAPIClient<any>) {
    this.client = client;
  }

  async getMerchant(): Promise<APIResult<Partial<GetMerchantQuery>>> {
    const query = `
  query getMerchant {
    getMerchant {
      id
      email
      storeName
    }
  }
`;
    return this.client.query<Partial<GetMerchantQuery>>({ query });
  }

  async getAuthorizedApp(): Promise<APIResult<Partial<GetAuthorizedAppQuery>>> {
    const query = `
  query getAuthorizedApp {
    getAuthorizedApp {
      id
      salesChannelId
    }
  }
`;
    return this.client.query<Partial<GetAuthorizedAppQuery>>({ query });
  }

  async getMerchantLicence(): Promise<APIResult<Partial<GetMerchantLicenceQuery>>> {
    const query = `
  query getMerchantLicence {
    getMerchantLicence {
      merchantId
      appSubscriptions {
        id
        name
        status
        storeAppListingSubscriptionKey
        lastPaymentDate
        lastPaymentPeriodInDays
        lastPaymentPrice
        addedDate
      }
    }
  }
`;
    return this.client.query<Partial<GetMerchantLicenceQuery>>({ query });
  }

  async listMerchantAppPayment(): Promise<APIResult<Partial<ListMerchantAppPaymentQuery>>> {
    const query = `
  query listMerchantAppPayment {
    listMerchantAppPayment {
      count
      data {
        id
        status
        paymentDate
        storeAppListingSubscriptionKey
      }
    }
  }
`;
    return this.client.query<Partial<ListMerchantAppPaymentQuery>>({ query });
  }

  async listOrders(): Promise<APIResult<Partial<ListOrdersQuery>>> {
    const query = `
query listOrders {
  listOrder(pagination: { limit: 50, page: 1 }) {
    count
    data {
      id
      orderNumber
      orderedAt
      status
      currencyCode
      totalPrice

      customer {
        firstName
        lastName
        email
      }

      orderLineItems {
        quantity
        finalPrice

        variant {
          id
          name
          sku
        }
      }
    }
  }
}
`;
    return this.client.query<Partial<ListOrdersQuery>>({ query });
  }

  async listOrderByNumber(variables: ListOrderByNumberQueryVariables): Promise<APIResult<Partial<ListOrderByNumberQuery>>> {
    const query = `
query listOrderByNumber($orderNumber: StringFilterInput, $customerEmail: StringFilterInput) {
  listOrder(orderNumber: $orderNumber, customerEmail: $customerEmail, pagination: { limit: 5, page: 1 }) {
    count
    data {
      id
      orderNumber
      orderedAt
      status
      currencyCode
      totalPrice
      totalFinalPrice
      stockLocationId

      customer {
        firstName
        lastName
        email
      }

      orderLineItems {
        id
        quantity
        finalPrice
        price
        status

        variant {
          id
          name
          sku
        }
      }
    }
  }
}
`;
    return this.client.query<Partial<ListOrderByNumberQuery>>({ query, variables });
  }

  async getOrderForRefund(variables: GetOrderForRefundQueryVariables): Promise<APIResult<Partial<GetOrderForRefundQuery>>> {
    const query = `
query getOrderForRefund($id: StringFilterInput) {
  listOrder(id: $id, pagination: { limit: 1, page: 1 }) {
    count
    data {
      id
      orderNumber
      status
      orderPaymentStatus
      currencyCode
      totalFinalPrice
      stockLocationId

      customer {
        email
      }

      orderLineItems {
        id
        quantity
        price
        finalPrice
        finalUnitPrice
        status
        stockLocationId
        variant {
          id
          name
          sku
        }
      }

      orderPackages {
        id
        orderLineItemIds
        orderPackageFulfillStatus
      }
    }
  }
}
`;
    return this.client.query<Partial<GetOrderForRefundQuery>>({ query, variables });
  }

  async listOrderTransactions(variables: ListOrderTransactionsQueryVariables): Promise<APIResult<Partial<ListOrderTransactionsQuery>>> {
    const query = `
query listOrderTransactions($orderId: String!) {
  listOrderTransactions(orderId: $orderId) {
    id
    amount
    status
    type
    processedAt
  }
}
`;
    return this.client.query<Partial<ListOrderTransactionsQuery>>({ query, variables });
  }
}

export class GeneratedMutations {
  client: BaseGraphQLAPIClient<any>;

  constructor(client: BaseGraphQLAPIClient<any>) {
    this.client = client;
  }

  async createMerchantAppPayment(variables: CreateMerchantAppPaymentMutationVariables): Promise<APIResult<Partial<CreateMerchantAppPaymentMutation>>> {
    const mutation = `
  mutation createMerchantAppPayment($input: CreateMerchantAppPaymentWithSubscriptionInput!) {
    createMerchantAppPayment(input: $input) {
      id
      merchantPaymentUrl
      status
    }
  }
`;
    return this.client.mutate<Partial<CreateMerchantAppPaymentMutation>>({ mutation, variables });
  }

  async refundOrderLine(variables: RefundOrderLineMutationVariables): Promise<APIResult<Partial<RefundOrderLineMutation>>> {
    const mutation = `
mutation refundOrderLine($input: PublicOrderRefundInput!) {
  refundOrderLine(input: $input) {
    id
    status
    orderPaymentStatus
    netTotalFinalPrice
    orderLineItems {
      id
      status
    }
  }
}
`;
    return this.client.mutate<Partial<RefundOrderLineMutation>>({ mutation, variables });
  }

  async cancelOrderLine(variables: CancelOrderLineMutationVariables): Promise<APIResult<Partial<CancelOrderLineMutation>>> {
    const mutation = `
mutation cancelOrderLine($input: CancelOrderLineInput!) {
  cancelOrderLine(input: $input) {
    id
    status
    orderLineItems {
      id
      status
    }
  }
}
`;
    return this.client.mutate<Partial<CancelOrderLineMutation>>({ mutation, variables });
  }

  async updateOrderPackageStatus(variables: UpdateOrderPackageStatusMutationVariables): Promise<APIResult<Partial<UpdateOrderPackageStatusMutation>>> {
    const mutation = `
mutation updateOrderPackageStatus($input: UpdateOrderPackageStatusInput!) {
  updateOrderPackageStatus(input: $input) {
    id
    status
    orderPackages {
      id
      orderPackageFulfillStatus
    }
  }
}
`;
    return this.client.mutate<Partial<UpdateOrderPackageStatusMutation>>({ mutation, variables });
  }

  async addOrderTimelineEntry(variables: AddOrderTimelineEntryMutationVariables): Promise<APIResult<Partial<AddOrderTimelineEntryMutation>>> {
    const mutation = `
mutation addOrderTimelineEntry($input: PublicTimelineInput!) {
  addOrderTimelineEntry(input: $input)
}
`;
    return this.client.mutate<Partial<AddOrderTimelineEntryMutation>>({ mutation, variables });
  }

  async createOrderWithTransactions(variables: CreateOrderWithTransactionsMutationVariables): Promise<APIResult<Partial<CreateOrderWithTransactionsMutation>>> {
    const mutation = `
mutation createOrderWithTransactions($input: PublicCreateOrderWithTransactionsInput!) {
  createOrderWithTransactions(input: $input) {
    id
    orderNumber
    status
  }
}
`;
    return this.client.mutate<Partial<CreateOrderWithTransactionsMutation>>({ mutation, variables });
  }
}

export class ikasAdminGraphQLAPIClient<TokenData> extends BaseGraphQLAPIClient<TokenData> {
  queries: GeneratedQueries;
  mutations: GeneratedMutations;

  constructor(options: BaseGraphQLAPIClientOptions<TokenData>) {
    super(options);
    this.queries = new GeneratedQueries(this);
    this.mutations = new GeneratedMutations(this);
  }
}
