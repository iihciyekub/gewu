FROM node:20-alpine

WORKDIR /app
COPY . .

ENV PORT=8000
ENV HOST=0.0.0.0

EXPOSE 8000
VOLUME ["/data"]

CMD ["node", "start.js"]
