FROM node:22.13.0-alpine

WORKDIR /app

COPY ./package.json ./
RUN npm set registry https://registry.npmmirror.com/
RUN npm install

COPY ./ ./