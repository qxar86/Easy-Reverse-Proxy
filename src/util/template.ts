import crypto from 'crypto';
import {PROXY_SECRET} from '../config';

export function generateProxyUrl(url: string): string {
    url = btoa(url);
    return `${url}_${crypto.createHmac('sha256', PROXY_SECRET).update(url).digest('hex')}`;
}