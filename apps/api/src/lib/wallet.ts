import { ethers } from 'ethers';
import * as crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';

function getKey(hexKey: string): Buffer {
  const buf = Buffer.from(hexKey, 'hex');
  if (buf.length !== 32) throw new Error('Key must be 32 bytes (64 hex chars)');
  return buf;
}

export function createWallet(): {
  address: string;
  encryptedKey: string;
  keyIv: string;
  keyAuthTag: string;
} {
  const wallet = ethers.Wallet.createRandom();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(config.walletMasterKey), iv);
  const encrypted = Buffer.concat([
    cipher.update(wallet.privateKey, 'utf8'),
    cipher.final(),
  ]);
  return {
    address: wallet.address,
    encryptedKey: encrypted.toString('base64'),
    keyIv: iv.toString('base64'),
    keyAuthTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptPrivateKey(
  encryptedKey: string,
  keyIv: string,
  keyAuthTag: string,
): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(config.walletMasterKey),
    Buffer.from(keyIv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(keyAuthTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedKey, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function encryptQrSecret(secret: string): {
  encrypted: string;
  iv: string;
  tag: string;
} {
  const key = getKey(config.qrMasterKey);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptQrSecret(encrypted: string, iv: string, tag: string): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(config.qrMasterKey),
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function generateQrSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
