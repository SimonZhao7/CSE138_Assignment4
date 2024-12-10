# https://docs.docker.com/get-started/docker-concepts/building-images/writing-a-dockerfile/
FROM node:21

WORKDIR /app

COPY . .

RUN npm install -g ts-node

RUN npm install

EXPOSE 8090

CMD ["npm", "start"]