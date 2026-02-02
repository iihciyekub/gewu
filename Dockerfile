FROM node:20.11.1-alpine

WORKDIR /app
COPY --chown=node:node . .

ENV NODE_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0
ENV ALLOWED_ROOTS=/data

RUN mkdir -p /data && chown -R node:node /data /app

EXPOSE 8000
VOLUME ["/data"]

USER node
CMD ["node", "start.js"]
