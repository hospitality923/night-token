FROM node:18-alpine

WORKDIR /usr/src/app

# Install build tools for native modules like sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./

# Force install and rebuild sqlite3
RUN npm install 

COPY . .

EXPOSE 4000

CMD ["node", "index.js"]
