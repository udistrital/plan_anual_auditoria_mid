FROM node:16.5.0-alpine

# Instalar dependencias necesarias en una sola capa
RUN apk update && \
    apk add --no-cache bash python3 py3-pip && \
    pip3 install awscli

WORKDIR /
COPY dist dist
COPY node_modules node_modules
COPY entrypoint.sh entrypoint.sh
RUN chmod +x ./ entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
