// src/common/crypto.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CryptoService } from './crypto.service';

@Injectable()
export class CryptoInterceptor implements NestInterceptor {
  constructor(private readonly cryptoService: CryptoService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    console.log('encryptedKey:',request.body.encryptedKey, '这是解密之后的：', this.cryptoService.sm2Decrypt(request.body.encryptedKey), '3o3o339')
    // 解密请求
    if (request.body?.encryptedData && request.body?.encryptedKey) {
      try {
        const sm4Key = this.cryptoService.sm2Decrypt(request.body.encryptedKey);
        request.body = this.cryptoService.sm4Decrypt(request.body.encryptedData, sm4Key);
        // 存储SM4密钥供响应加密使用
        response.locals.sm4Key = sm4Key;
      } catch (e) {
        console.error('解密失败:', e);
        throw new Error('Invalid encrypted data');
      }
    }

    return next.handle().pipe(
      map(data => {
        // 加密响应
        if (response.locals?.sm4Key) {
          return {
            encryptedData: this.cryptoService.sm4Encrypt(data, response.locals.sm4Key)
          };
        }
        return data;
      })
    );
  }
}

@Injectable()
export class TwoCryptoInterceptor implements NestInterceptor {
  constructor(private readonly cryptoService: CryptoService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    // 解密请求
    if (request.body?.encryptedData) {
      try {
        const sm2Data = this.cryptoService.twosm2Decrypt(request.body.encryptedData);
        console.log(request.body.encryptedData, sm2Data, '拦截器')
        const sm2DataRes = this.cryptoService.twosm2Encrypt(sm2Data);
        request.body = sm2DataRes
      } catch (e) {
        console.error('解密失败:', e);
        throw new Error('Invalid encrypted data');
      }
    }
    return next.handle().pipe(
      map(data => {
        // 加密响应
        if (response.locals?.sm4Key) {
          return {
            encryptedData: this.cryptoService.sm4Encrypt(data, response.locals.sm4Key)
          };
        }
        return data;
      })
    );
  }
}
