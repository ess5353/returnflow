import { BaseGraphQLAPIClient, BaseGraphQLAPIClientOptions, APIResult } from '@ikas/admin-api-client';

export enum MerchantAppPaymentStatusEnum {
  PAID = "PAID",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  WAITING_FOR_PAYMENT = "WAITING_FOR_PAYMENT"
}

export enum MerchantSubscriptionStatusEnum {
  ACTIVE = "ACTIVE",
  REMOVED = "REMOVED",
  WILL_BE_REMOVED = "WILL_BE_REMOVED"
}

export enum OrderStatusEnum {
  CANCELLED = "CANCELLED",
  CREATED = "CREATED",
  DELIVERED = "DELIVERED",
  DELIVERY_FAILED = "DELIVERY_FAILED",
  PAID = "PAID",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  PARTIALLY_SHIPPED = "PARTIALLY_SHIPPED",
  REFUNDED = "REFUNDED",
  SHIPPED = "SHIPPED",
  WAITING_FOR_APPROVAL = "WAITING_FOR_APPROVAL"
}

export type CreateMerchantAppPaymentWithSubscriptionInput = {
  storeAppListingSubscriptionKey: string;
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

export type ListOrderQueryVariables = {}

export type ListOrderQueryData = {
  page: number;
  count: number;
  data: Array<{
  id: string;
  orderNumber?: string;
  orderedAt?: number;
  status: OrderStatusEnum;
  currencyCode: string;
  totalPrice: number;
  totalFinalPrice: number;
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

export interface ListOrderQuery {
  listOrder: ListOrderQueryData;
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

  async listOrder(): Promise<APIResult<Partial<ListOrderQuery>>> {
    const query = `
query listOrder {
  listOrder {
    page
    count
    data {
      id
      orderNumber
      orderedAt
      status
      currencyCode
      totalPrice
      totalFinalPrice

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
    return this.client.query<Partial<ListOrderQuery>>({ query });
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
