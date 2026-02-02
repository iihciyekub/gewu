FROM node:20.11.1-alpine

WORKDIR /app
COPY --chown=node:node . .

ENV NODE_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0
ENV ALLOWED_ROOTS=/data,/home/node

RUN mkdir -p /data /home/node && chown -R node:node /data /home/node /app

EXPOSE 8000
VOLUME ["/data"]
VOLUME ["/home/node"]

USER node
CMD ["node", "start.js"]
