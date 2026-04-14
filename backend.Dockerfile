# Usa una imagen de Node.js ligera como base
FROM node:18-slim

# Instalar Python y herramientas necesarias
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias de Node.js
COPY backend/package*.json ./

# Instalar dependencias de Node.js
RUN npm install --production

# Copiar archivos de dependencias de Python
COPY python_post/requirements.txt ./python_requirements.txt

# Instalar dependencias de Python
RUN pip3 install --no-cache-dir -r python_requirements.txt

# Copiar el resto del código del backend y el código de python
COPY backend/ ./backend/
COPY python_post/ ./python_post/
COPY frontend/public/data/ ./frontend/public/data/

# Establecer puerto
EXPOSE 3001

# Comando para iniciar el backend
WORKDIR /app/backend
CMD ["node", "server.js"]
