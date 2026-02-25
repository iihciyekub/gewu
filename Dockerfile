FROM node:20.11.1-alpine

WORKDIR /app
COPY --chown=node:node . .

ENV NODE_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0
ENV ALLOWED_ROOTS=/data,/home/node
ENV GIT_CONFIG_GLOBAL=/home/node/.gitconfig

RUN apk add --no-cache git xclip \
    && mkdir -p /data /home/node \
    && chown -R node:node /data /home/node /app

EXPOSE 8000
VOLUME ["/data"]
VOLUME ["/home/node"]

USER node
RUN git config --global --add safe.directory '*'
CMD ["node", "start.js"]
