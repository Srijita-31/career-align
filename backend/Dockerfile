FROM node:22-alpine

WORKDIR /app

# Prevent unnecessary Chromium download (if playwright not needed at runtime)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 4001

CMD ["npm", "start"]
