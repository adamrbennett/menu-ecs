FROM node:alpine

ENV APP_PORT "80"
ENV KV_ROOT "http://172.17.0.1:8500/v1/kv"

EXPOSE 80

RUN mkdir -p /usr/src/api

COPY . /usr/src/api

WORKDIR /usr/src/api

RUN npm install --production

CMD ["node", "index.js"]
