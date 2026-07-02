import * as dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(optional('PORT', '3000')),
  nodeEnv: optional('NODE_ENV', 'development'),
  isDev: optional('NODE_ENV', 'development') === 'development',

  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),

  walletMasterKey: required('WALLET_MASTER_KEY'),
  qrMasterKey: required('QR_MASTER_KEY'),

  polygonRpcUrl: optional('POLYGON_RPC_URL', 'https://rpc-amoy.polygon.technology'),
  deployerPrivateKey: required('DEPLOYER_PRIVATE_KEY'),
  nftContractAddress: required('NFT_CONTRACT_ADDRESS'),
  marketplaceContractAddress: required('MARKETPLACE_CONTRACT_ADDRESS'),
  usdcContractAddress: optional(
    'USDC_CONTRACT_ADDRESS',
    '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  ),

  braintree: {
    environment: optional('BRAINTREE_ENV', 'sandbox'),
    merchantId: required('BRAINTREE_MERCHANT_ID'),
    publicKey: required('BRAINTREE_PUBLIC_KEY'),
    privateKey: required('BRAINTREE_PRIVATE_KEY'),
  },

  resendApiKey: required('RESEND_API_KEY'),
  fromEmail: optional('FROM_EMAIL', 'tickets@blockchaintickets.app'),

  r2: {
    accountId: required('R2_ACCOUNT_ID'),
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    bucketName: required('R2_BUCKET_NAME'),
    publicUrl: required('R2_PUBLIC_URL'),
  },

  google: {
    clientId: optional('GOOGLE_CLIENT_ID', ''),
    clientSecret: optional('GOOGLE_CLIENT_SECRET', ''),
    callbackUrl: optional('GOOGLE_CALLBACK_URL', 'http://localhost:3000/api/auth/google/callback'),
  },

  frontendUrl: optional('FRONTEND_URL', 'http://localhost:8081'),
};
