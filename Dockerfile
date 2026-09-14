# Scoop LINE bot. Node runs the .ts files directly, so there is no build step.
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY tsconfig.json scoop-mock-data-bkk.json scoop-venues-bkk.json ./
COPY src ./src
COPY scripts ./scripts
COPY assets ./assets
COPY test ./test

# data/ holds state.json (users and bookings); docker-compose mounts it from the host so it survives rebuilds.
RUN mkdir -p data && chown node:node data
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "src/server.ts"]
