FROM public.ecr.aws/docker/library/node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY db ./db
COPY data ./data
COPY workers ./workers
EXPOSE 8787
ENV NODE_ENV=production PORT=8787
CMD ["node", "server/index.mjs"]
