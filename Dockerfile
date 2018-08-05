FROM node:10.5.0
RUN mkdir -p /usr/src/medmod/apis
WORKDIR /usr/src/medmod/apis
COPY package.json /usr/src/medmod/apis
RUN npm install yarn@1.9.4 -g
RUN yarn --pure-lockfile
COPY . /usr/src/medmod/apis
EXPOSE 3000
