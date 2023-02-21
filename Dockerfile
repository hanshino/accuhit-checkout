FROM node:lts as builder

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install

COPY . .

RUN yarn build

FROM node:alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json yarn.lock ./

RUN yarn install --production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["yarn", "start"]