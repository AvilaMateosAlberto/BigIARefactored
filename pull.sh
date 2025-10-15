#!/bin/bash
set -e

if [ $# -ne 2 ]; then
  echo "Uso: $0 <prefix> <tag>"
  echo "Ejemplo: $0 mashfrog 1.0"
  exit 1
fi

IMAGE_NAME=$1
IMAGE_TAG=$2

echo "Construyendo imagen ${IMAGE_NAME}/htmlreport-frontend:${IMAGE_TAG}..."
docker build -t ${IMAGE_NAME}/htmlreport-frontend:${IMAGE_TAG} .

echo "Construyendo imagen ${IMAGE_NAME}/htmlreport-backend:${IMAGE_TAG}..."
docker build -t ${IMAGE_NAME}/htmlreport-backend:${IMAGE_TAG} ./backend

echo "Subiendo imagenes a registry..."
docker push ${IMAGE_NAME}/htmlreport-backend:${IMAGE_TAG}
docker push ${IMAGE_NAME}/htmlreport-frontend:${IMAGE_TAG}

echo "✅ Imagenes construidas y subidas correctamente."
