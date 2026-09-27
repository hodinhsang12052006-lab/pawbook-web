// Ported from ZegoCloud's official server-side reference implementation
// (https://github.com/ZEGOCLOUD/zego_server_assistant/blob/master/token/nodejs/server/zegoServerAssistant.js).
// ZegoCloud does not publish this as an npm package — only as source meant
// to be copied server-side, since it embeds the algorithm that turns
// `secret` into a signed room-access token. This file must NEVER be
// imported from client-facing ("use client") code; see app/api/zego/token
// for the only sanctioned caller.
import { createCipheriv } from "crypto";

function rndNum(a: number, b: number): number {
  return Math.ceil(a + (b - a) * Math.random());
}

function makeRandomIv(): string {
  const str = "0123456789abcdefghijklmnopqrstuvwxyz";
  const result: string[] = [];
  for (let i = 0; i < 16; i++) {
    result.push(str.charAt(Math.floor(Math.random() * str.length)));
  }
  return result.join("");
}

function getAlgorithm(keyBuf: Buffer): string {
  switch (keyBuf.length) {
    case 16:
      return "aes-128-cbc";
    case 24:
      return "aes-192-cbc";
    case 32:
      return "aes-256-cbc";
  }
  throw new Error("Invalid key length: " + keyBuf.length);
}

function aesEncrypt(plainText: string, key: Buffer, iv: Buffer): Buffer {
  const cipher = createCipheriv(getAlgorithm(key), key, iv);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(plainText), cipher.final()]);
}

export function generateToken04(
  appId: number,
  userId: string,
  secret: string,
  effectiveTimeInSeconds: number,
  payload?: string
): string {
  if (!appId || typeof appId !== "number") {
    throw new Error("appID invalid");
  }
  if (!userId || typeof userId !== "string") {
    throw new Error("userId invalid");
  }
  if (!secret || typeof secret !== "string" || secret.length !== 32) {
    throw new Error("secret must be a 32 byte string");
  }
  if (!effectiveTimeInSeconds || typeof effectiveTimeInSeconds !== "number") {
    throw new Error("effectiveTimeInSeconds invalid");
  }

  const createTime = Math.floor(Date.now() / 1000);
  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: rndNum(-2147483648, 2147483647),
    ctime: createTime,
    expire: createTime + effectiveTimeInSeconds,
    payload: payload || "",
  };
  const plainText = JSON.stringify(tokenInfo);
  const iv = makeRandomIv();
  const encryptBuf = aesEncrypt(plainText, Buffer.from(secret), Buffer.from(iv));

  const b1 = Buffer.alloc(8);
  b1.writeBigInt64BE(BigInt(tokenInfo.expire), 0);
  const b2 = Buffer.alloc(2);
  b2.writeUInt16BE(iv.length, 0);
  const b3 = Buffer.alloc(2);
  b3.writeUInt16BE(encryptBuf.byteLength, 0);

  const buf = Buffer.concat([b1, b2, Buffer.from(iv), b3, encryptBuf]);
  return "04" + buf.toString("base64");
}
