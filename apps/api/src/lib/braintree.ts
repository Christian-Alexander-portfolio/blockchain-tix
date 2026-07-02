import braintree from 'braintree';
import { config } from '../config';

let _gateway: braintree.BraintreeGateway | null = null;

export function getGateway(): braintree.BraintreeGateway {
  if (!config.braintree.merchantId || !config.braintree.publicKey || !config.braintree.privateKey) {
    throw new Error('Braintree credentials not configured');
  }
  if (!_gateway) {
    const isProduction = config.braintree.environment === 'production';
    _gateway = new braintree.BraintreeGateway({
      environment: isProduction ? braintree.Environment.Production : braintree.Environment.Sandbox,
      merchantId: config.braintree.merchantId,
      publicKey: config.braintree.publicKey,
      privateKey: config.braintree.privateKey,
    });
  }
  return _gateway;
}
