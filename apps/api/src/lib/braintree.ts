import braintree from 'braintree';
import { config } from '../config';

const isProduction = config.braintree.environment === 'production';

export const gateway = new braintree.BraintreeGateway({
  environment: isProduction ? braintree.Environment.Production : braintree.Environment.Sandbox,
  merchantId: config.braintree.merchantId,
  publicKey: config.braintree.publicKey,
  privateKey: config.braintree.privateKey,
});
