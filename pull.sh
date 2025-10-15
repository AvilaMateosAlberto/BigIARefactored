#!/bin/bash
set -e

if [ $# -ne 2 ]; then
  echo "Uso: $0 <prefix> <tag>; donde prefix es el prefijo del repositorio y tag, el tad deseado de la imagen."
  echo "Ejemplo: $0 mashfrog 1.0"
  exit 1
fi

IMAGE_NAME=$1
IMAGE_TAG=$2

echo "Construyendo imagen ${IMAGE_NAME}/bigia-frontend:${IMAGE_TAG}..."
docker build -t ${IMAGE_NAME}/bigia-frontend:${IMAGE_TAG} ./frontend

echo "Construyendo imagen ${IMAGE_NAME}/bigia-backend:${IMAGE_TAG}..."
docker build -t ${IMAGE_NAME}/bigia-backend:${IMAGE_TAG} ./backend

echo "Subiendo imagenes a registry..."
docker push ${IMAGE_NAME}/bigia-backend:${IMAGE_TAG}
docker push ${IMAGE_NAME}/bigia-frontend:${IMAGE_TAG}

echo "✅ Imagenes construidas y subidas correctamente."
