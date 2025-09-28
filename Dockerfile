# Basis-Image
FROM node:20-alpine

# Arbeitsverzeichnis im Container
WORKDIR /app

COPY package*.json ./
RUN npm install --production


COPY . .

# Port
EXPOSE 3000

# Command
CMD ["node", "server.js"]
