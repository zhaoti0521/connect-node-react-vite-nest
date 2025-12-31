import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  Get,
  HttpCode,
  Query,
  Res,
  Req,
} from '@nestjs/common';
import { AppService } from './app.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CryptoInterceptor,TwoCryptoInterceptor } from './common/crypto.interceptor';
import { CryptoService } from './common/crypto.service';

import * as fs from 'fs';
type FileName = string;

// 定义请求体的类型
interface FileUploadBody {
  name: FileName;
  index: number;
  fileHash: string; // 新增：文件哈希值，用于唯一标识一个文件，实现断点续传时判断文件的身份
}
interface Params {
  start?: number;
  end?: number;
}
@Controller()
export class AppController {
  [x: string]: any;
  constructor(
    private readonly appService: AppService,
    private readonly cryptoService: CryptoService 
  ) {}

  @Post('upload')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      dest: 'files', // 指定存储文件的地方
    }),
  )
  fileUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: FileUploadBody,
  ) {
    const parentDir = 'file';
    const fileName: FileName = body.name;
    const fileHash = body.fileHash;
    // const chunksDir = `file/chunks_${fileName}`;
    // 根据文件哈希值构建切片存储目录的路径
    const chunksDir = `file/chunks_${fileHash}`;
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir);
    }
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir);
    }
    fs.cpSync(file.path, `${chunksDir}/${fileName}-${body.index}`);
    fs.rmSync(file.path);
    // 返回切片上传成功的消息
    return { message: `切片 ${body.index} 上传成功` };
  }
  @Post('buffer_merge')
  @HttpCode(200)
  fileBufferMerge(@Body() body: { name: string; fileHash: string }) {
    const fileHash = body.fileHash;
    // 根据文件哈希值构建切片存储目录的路径
    const chunkDir = `file/chunks_${fileHash}`;
    // const chunkDir = `file/chunks_${body.name}`;
    const files = fs.readdirSync(chunkDir).sort((a, b) => {
      // console.log(
      //   a.slice(a.lastIndexOf('-') + 1),
      //   b.slice(b.lastIndexOf('-') + 1),
      //   'sort',
      // );
      return Number(a) - Number(b);
    });
    const outputFilePath = `files/${body.name}`;
    const buffers: Buffer[] = [];
    files.forEach((file) => {
      const filePath = `${chunkDir}/${file}`;
      const buffer = fs.readFileSync(filePath);
      buffers.push(buffer);
    });
    const concatBuffer = Buffer.concat(buffers);
    fs.writeFileSync(outputFilePath, concatBuffer);
    fs.rm(chunkDir, { recursive: true }, () => {});
    // 返回文件合并成功的消息
    return { message: '文件合并成功' };
  }

  @Post('steam_merge')
  @HttpCode(200)
  fileMerge(@Body() body: { name: string; fileHash: string }) {
    const fileHash = body.fileHash;
    // 根据文件哈希值构建切片存储目录的路径
    const chunksDir = `file/chunks_${fileHash}`;
    console.log(fs.readdirSync(chunksDir), '这是啥');
    // const chunksDir = `file/chunks_${body.name}`;
    const files = fs.readdirSync(chunksDir).sort((a, b) => {
      const aIndex = a.slice(a.lastIndexOf('-') + 1);
      const bIndex = b.slice(b.lastIndexOf('-') + 1);
      return Number(aIndex) - Number(bIndex);
    });
    let startPos = 0;
    const outputFilePath = `files/${body.name}`;
    files.forEach((file, index) => {
      const filePath = `${chunksDir}/${file}`;
      const readStream = fs.createReadStream(filePath);
      const writeStream = fs.createWriteStream(outputFilePath, {
        start: startPos,
      });
      readStream.pipe(writeStream).on('finish', () => {
        if (index === files.length - 1) {
          fs.rm(chunksDir, { recursive: true }, () => {});
        }
      });
      startPos += fs.statSync(filePath).size;
    });
  }

  @Get('file_size')
  fileDownload() {
    const filePath = `files/banner.pdf`;
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      return {
        size: stat.size,
        fileName: 'banner.pdf',
      };
    }
  }

  @Get('file_chunk')
  fileGet(@Query() params: Params, @Res() res) {
    const filePath = `files/banner.pdf`;
    const fileStream = fs.createReadStream(filePath, {
      start: Number(params.start),
      end: Number(params.end),
    });
    fileStream.pipe(res);
  }

  // 检查已上传切片的接口
  @Get('check-chunks')
  checkChunks(@Query('fileHash') fileHash: string) {
    // 根据文件哈希值构建切片存储目录的路径
    const chunksDir = `file/chunks_${fileHash}`;
    console.log(44444, chunksDir, fs.existsSync(chunksDir));
    // 检查该目录是否存在
    if (fs.existsSync(chunksDir)) {
      console.log(8888);
      // 如果目录存在，读取目录下的所有文件
      const files = fs.readdirSync(chunksDir);
      console.log(files, 'zhaoti');
      // 遍历文件列表，提取每个文件对应的切片索引
      const uploadedChunks = files.map((file) => {
        // 从文件名中提取切片索引部分
        const indexStr = file.slice(file.lastIndexOf('-') + 1);
        // 将索引字符串转换为数字
        return parseInt(indexStr);
      });
      // 返回已上传的切片索引数组
      return { uploadedChunks };
    }
    // 如果目录不存在，返回空的已上传切片索引数组
    return { uploadedChunks: [] };
  }

  @Get('public-key')
  getPublicKey() {
    return { publicKey: this.cryptoService.getPublicKey() };
  }

  @Post('secure-data')
  @HttpCode(200)
  @UseInterceptors(CryptoInterceptor)
  handleSecureData(@Req() request: Request) {
    console.log('Received decrypted data:', request.body);
    return { 
      status: 'success',
      receivedData: request.body
    };
  }

  @Get('own-public-key')
  getOwnPublicKey() {
    return { ownPublicKey: this.cryptoService.getSm2PublicKey() };
  }

  @Post('process-data')
  @HttpCode(200)
  @UseInterceptors(TwoCryptoInterceptor)
  handleProcessData(@Req() request: Request) {
    console.log('这是双向加密', request.body);
    return {
      status: 'success',
      receivedData: request.body
    };
  }

  @Get('test-crypto')
  testCrypto() {
    this.cryptoService.testEncryption();
    return { message: 'Crypto tests completed, check server logs',  };
  }
}
