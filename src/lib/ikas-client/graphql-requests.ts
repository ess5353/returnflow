import { gql } from 'graphql-request';

export const GET_MERCHANT = gql`
  query getMerchant {
    getMerchant {
      id
      email
      storeName
    }
  }
`;

export const GET_AUTHORIZED_APP = gql`
  query getAuthorizedApp {
    getAuthorizedApp {
      id
      salesChannelId
    }
  }
`;

export const GET_MERCHANT_LICENCE = gql`
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

export const CREATE_MERCHANT_APP_PAYMENT = gql`
  mutation createMerchantAppPayment($input: CreateMerchantAppPaymentWithSubscriptionInput!) {
    createMerchantAppPayment(input: $input) {
      id
      merchantPaymentUrl
      status
    }
  }
`;

export const LIST_MERCHANT_APP_PAYMENT = gql`
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

export const LIST_ORDERS = gql`
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

export const LIST_ORDER_BY_NUMBER = gql`
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

// ── Real ikas order refund/return operations ────────────────────────────────
// Discovered via ikas MCP list + introspect tools (per project convention) —
// these mirror the live ikas Admin GraphQL schema exactly, nothing invented.

export const GET_ORDER_FOR_REFUND = gql`
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

export const LIST_ORDER_TRANSACTIONS = gql`
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

export const REFUND_ORDER_LINE = gql`
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

export const CANCEL_ORDER_LINE = gql`
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

export const UPDATE_ORDER_PACKAGE_STATUS = gql`
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

export const ADD_ORDER_TIMELINE_ENTRY = gql`
mutation addOrderTimelineEntry($input: PublicTimelineInput!) {
  addOrderTimelineEntry(input: $input)
}
`;

export const CREATE_ORDER_WITH_TRANSACTIONS = gql`
mutation createOrderWithTransactions($input: PublicCreateOrderWithTransactionsInput!) {
  createOrderWithTransactions(input: $input) {
    id
    orderNumber
    status
  }
}
`;