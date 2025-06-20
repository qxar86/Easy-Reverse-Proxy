import express from 'express';
import type {Request, Response, NextFunction} from 'express';
import {fixRequestBody, responseInterceptor, createProxyMiddleware} from 'http-proxy-middleware';
import bodyParser from 'body-parser';

import {PROXIES, PORT} from './config';
import type {Middleware, MiddlewareConfig} from './util/model';
import {generateProxyUrl} from './util/template';
import {ExceptionResponse, ExceptionResponseCode, GenerateResponse} from './util/core';

let APP = express();

let MIDDLEWARES = PROXIES.filter((proxy): boolean => {return proxy.enable;}).map((proxy): Middleware => {
    let config: MiddlewareConfig = {
        target: proxy.url,
        changeOrigin: true,
        on: {
            proxyReq: fixRequestBody
        }
    };

    if (proxy.template) {
        if (proxy.template.request) {
            config.on.proxyReq = (targetRequest, request: Request): void => {
                let oldHeader = {};
                for (let headerName in targetRequest.getHeaders()) {
                    oldHeader[headerName] = targetRequest.getHeader(headerName);
                    targetRequest.removeHeader(headerName);
                }

                let result = proxy.template.request({header: oldHeader, body: request.body});
                for (let headerName in result.header) {
                    targetRequest.setHeader(headerName, result.header[headerName]);
                }
                request.body = result.body;
                fixRequestBody(targetRequest, request);
            }
        }
        if (proxy.template.response) {
            config.on.proxyRes = responseInterceptor(async (targetResponseBuffer, targetResponse, request, response): Promise<Buffer> => {
                let oldHeader = {};
                for (let headerName in response.getHeaders()) {
                    oldHeader[headerName] = response.getHeader(headerName);
                    response.removeHeader(headerName);
                }

                let result = await proxy.template.response({header: oldHeader, body: targetResponseBuffer});
                for (let headerName in result.header) {
                    response.setHeader(headerName, result.header[headerName]);
                }
                return result.body;
            });
            config.selfHandleResponse = true;
        }
    }

    return {
        domain: proxy.domain,
        middleware: createProxyMiddleware(config)
    }
});

APP.use('/:sign(.+_[0-9a-zA-Z]{64})', (request, response, next): void | Promise<void> => {
    let sign = request.params.sign;
    let url = atob(sign.split('_')[0]);

    if (generateProxyUrl(url) !== sign) {
        return next();
    }

    return createProxyMiddleware({
        target: url,
        changeOrigin: true
    })(request, response, next);
});

APP.use(bodyParser.json(), bodyParser.urlencoded({extended: true}), (request, response, next): Promise<void> => {
    let domain = request.hostname;

    let proxy = PROXIES.find((proxy): boolean => {return proxy.domain === domain;});
    if (!proxy) {
        throw new ExceptionResponse(ExceptionResponseCode.SYSTEM, '代理不存在');
    }

    if (proxy.enable) {
        return MIDDLEWARES.find((middleware): boolean => {return middleware.domain === proxy.domain;}).middleware(request, response, next);
    } else {
        throw new ExceptionResponse(ExceptionResponseCode.SYSTEM, '代理已关闭');
    }
});

APP.use((error: Error, request: Request, response: Response, next: NextFunction): void => {
    if (error instanceof ExceptionResponse) {
        return GenerateResponse.error(error.code, error.message)(response);
    }

    return GenerateResponse.error(500, '未知错误', 500)(response);
});

APP.listen(PORT);