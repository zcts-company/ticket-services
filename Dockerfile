FROM node:20-alpine

ENV TZ=Europe/Moscow

WORKDIR /

RUN apk add --no-cache \
    samba-client \
    tzdata \
    ca-certificates

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY ./build /build

CMD ["npm", "run", "startprod"]