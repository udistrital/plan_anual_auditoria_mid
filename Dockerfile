FROM amazon/aws-cli:latest

# Instalar Node.js
RUN curl -sL https://deb.nodesource.com/setup_16.x | bash - && \
    apk update && \
    apk install -y nodejs

WORKDIR /
COPY dist dist
COPY node_modules node_modules
COPY entrypoint.sh entrypoint.sh
RUN chmod +x ./ entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
