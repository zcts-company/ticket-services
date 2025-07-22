FROM node:18-alpine

ENV TZ="Europe/Moscow"

COPY ./build /build 
COPY ./package.json /package.json 
COPY ./package-lock.json /package-lock.json

RUN apk add samba-client
RUN npm install  


CMD ["npm","run","startprod"]
