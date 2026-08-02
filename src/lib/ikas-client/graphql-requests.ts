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

export const TEST_ORDERS = gql`
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