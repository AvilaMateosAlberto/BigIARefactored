FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json vite.config.js index.html ./

# Cambiamos el registro a HTTP para evitar posibles errores TLS
RUN npm config set registry http://registry.npmjs.org/ && \
    npm install

COPY src/ src/
COPY public/ public/

RUN npm run build

FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]