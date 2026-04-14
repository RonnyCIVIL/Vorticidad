# ETAPA 1: Construcción
FROM node:18-slim AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# Construye los archivos de producción (carpeta /dist)
RUN npm run build

# ETAPA 2: Servidor de Producción
FROM node:18-slim
WORKDIR /app
# Instalamos un servidor estático simple
RUN npm install -g serve
# Copiamos solo los archivos construidos
COPY --from=builder /app/dist ./dist
EXPOSE 5173
# Lanzamos el servidor en el puerto 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
