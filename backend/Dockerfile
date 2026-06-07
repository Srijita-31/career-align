FROM mcr.microsoft.com/playwright:v1.38.0-jammy

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 4001

CMD ["npm", "start"]
