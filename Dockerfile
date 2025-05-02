FROM node:latest

ADD package.json /package.json
ADD package-lock.json /package-lock.json

RUN npm install

ADD server /server
WORKDIR /server
RUN npm install

WORKDIR /
ADD src /src
ADD public /public

CMD ["npm", "run", "dev", "--host"]
