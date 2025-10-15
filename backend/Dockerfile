# ============================
# Backend Dockerfile
# ============================
FROM node:22-bullseye

# Directorio de trabajo
WORKDIR /app

# Copiar solo lo necesario para instalar dependencias primero
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Ahora copia el resto de la aplicación
COPY . .

# Exponer puerto de la API
EXPOSE 3001

# Comando para iniciar el servidor
CMD ["npm", "start"]
