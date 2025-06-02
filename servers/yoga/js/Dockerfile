FROM node:24-alpine
ENV TZ=Europe/Tallinn
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8065
CMD ["node", "yogaOldWithListedPlaylists.js"]