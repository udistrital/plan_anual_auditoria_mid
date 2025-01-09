FROM node:18.20.5

RUN apt-get update && apt-get install -y bash
RUN apt-get install -y python3
RUN apt-get install -y python3-pip
RUN pip3 install awscli

WORKDIR /
COPY dist dist
COPY node_modules node_modules
COPY entrypoint.sh entrypoint.sh
RUN chmod +x ./ entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
