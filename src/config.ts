import type {Proxy} from './util/model';

export let PORT = 377; // 端口

export let PROXY_SECRET = 'Easy-Reverse-Proxy'; // 代理密钥
// 代理
export let PROXIES: Proxy[] = [
  {
        domain: 'so.635835.xyz',
        url: 'https://github.com/',
        enable: true
    }
];
