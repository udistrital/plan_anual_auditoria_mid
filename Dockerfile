FROM node:24-alpine

WORKDIR /app
COPY dist dist
COPY node_modules node_modules

ENTRYPOINT ["node", "dist/main"]
