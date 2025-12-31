// src/common/crypto.service.ts
import { Injectable } from '@nestjs/common';
import { sm2, sm4 } from 'sm-crypto';
const keypair = sm2.generateKeyPairHex();
const frontEndPublicKey = '042b35859ec53b96007aff335df0edab96fcc9fedee999b8578cba4f2327664b39e86b0c2f5383dbbb6166c19637cf5368870d586342be0e6d57340df9f45e6959'
const backEndPrvideKey = 'e77302f05824a1c71cb204b7913474b35950b026c35098354cbebdca2d28b247'
const backEndPublicKey = '043f2ca60e8d6377c31edfea96db7c390090c2be9709f73fdac41d67cf71fa64b48f74007dda54642e850f6e1bc028c84cc4e3700c1ae591c2b0a1cd3fc0bc75d1'
@Injectable()
export class CryptoService {
  // 直接使用生成的合法密钥对（替换为你自己的密钥）
  
  private readonly serverKeyPair = {
    publicKey: keypair.publicKey,
    privateKey: keypair.privateKey
  };
  private readonly sm2TwowayKey = {
    publicKey: frontEndPublicKey,
    privateKey: backEndPrvideKey,
    ownPublicKey: backEndPublicKey
  }

  constructor() {
    this.validateKeys();
    this.testEncryption();
  }

  private validateKeys() {
    if (!this.serverKeyPair.publicKey || this.serverKeyPair.publicKey.length !== 130) {
      throw new Error('Invalid SM2 public key length (should be 130 chars)');
    }
    if (!this.serverKeyPair.privateKey || this.serverKeyPair.privateKey.length !== 64) {
      throw new Error('Invalid SM2 private key length (should be 64 chars)');
    }
  }

  getPublicKey(): string {
    return this.serverKeyPair.publicKey;
  }

  getSm2PublicKey(): string {
    return this.sm2TwowayKey.ownPublicKey;
  }

  sm2Decrypt(encrypted: string): string {
    if (!encrypted) throw new Error('Encrypted data is empty');
    try {
      // 使用C1C3C2模式解密（需与前端匹配）
      return sm2.doDecrypt(encrypted, this.serverKeyPair.privateKey, 0);
    } catch (e) {
      throw new Error(`SM2 decryption failed: ${e.message}`);
    }
  }
  twosm2Decrypt(encrypted: string): string {
    if (!encrypted) throw new Error('Encrypted data is empty');
    try {
      // 使用C1C3C2模式解密（需与前端匹配）
      return sm2.doDecrypt(encrypted, this.sm2TwowayKey.privateKey, 0);
    } catch (e) {
      throw new Error(`SM2 decryption failed: ${e.message}`);
    }
  }
  twosm2Encrypt(data:any):string {
    return sm2.doEncrypt(JSON.stringify(data), this.sm2TwowayKey.publicKey, 0);
  }
  sm4Encrypt(data: any, key: string): string {
    if (!key || key.length !== 32) {
      throw new Error('SM4 key must be 32 hex characters');
    }
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    return sm4.encrypt(dataStr, key);
  }

  sm4Decrypt(encrypted: string, key: string): any {
    if (!key || key.length !== 32) {
      throw new Error('SM4 key must be 32 hex characters');
    }
    try {
      const decrypted = sm4.decrypt(encrypted, key);
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    } catch (e) {
      throw new Error(`SM4 decryption failed: ${e.message}`);
    }
  }

  // 测试方法（可选）
  testEncryption() {
    const testData = 'testmessage';
    const sm4Key = '0123456789abcdef0123456789abcdef'; // 32字符16进制
    const encrypted = this.sm4Encrypt(testData, sm4Key);
    const decrypted = this.sm4Decrypt(encrypted, sm4Key);
    // console.log(decrypted === testData, 'SM4 test failed');
    console.log('privateKey这里是：', this.serverKeyPair.privateKey,'publicKey这里是：', this.serverKeyPair.publicKey)
    const sm2Encrypted = sm2.doEncrypt(sm4Key, this.serverKeyPair.publicKey, 0);
    const sm2Decrypted = this.sm2Decrypt(sm2Encrypted);
    // console.log(sm2Decrypted === sm4Key, 'SM2 test failed');
  }
}