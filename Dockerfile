FROM amazon/aws-cli:latest

# Instalar Node.js
RUN apk add --no-cache nodejs npm

WORKDIR /
COPY dist dist
COPY node_modules node_modules
COPY entrypoint.sh entrypoint.sh
RUN chmod +x ./ entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
