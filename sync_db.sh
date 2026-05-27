#!/bin/bash

# Configuración
DB_SOURCE="sistema_gestion_clases_produccion"
DB_TARGET="sistema_gestion_clases_laravel"
DB_USER="root"
DB_PASS="6643"

echo "----------------------------------------------------------"
echo "Sincronizando Base de Datos"
echo "Origen: $DB_SOURCE"
echo "Destino: $DB_TARGET"
echo "----------------------------------------------------------"

# 1. Vaciar la base de datos destino
echo "[1/3] Vaciando base de datos $DB_TARGET..."
mysql -u "$DB_USER" -p"$DB_PASS" -e "DROP DATABASE IF EXISTS $DB_TARGET; CREATE DATABASE $DB_TARGET CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Copiar datos de producción a laravel
echo "[2/3] Copiando datos desde $DB_SOURCE..."
mysqldump -u "$DB_USER" -p"$DB_PASS" --single-transaction --routines --triggers "$DB_SOURCE" | mysql -u "$DB_USER" -p"$DB_PASS" "$DB_TARGET"

# 3. Ejecutar migraciones de Laravel (para tablas de sistema)
echo "[3/3] Ejecutando migraciones de Laravel..."
if [ -d "backend-laravel" ]; then
    cd backend-laravel
    php artisan migrate --force
    php artisan cache:clear
    php artisan config:clear
    cd ..
else
    echo "Error: No se encontró el directorio backend-laravel para ejecutar migraciones."
    exit 1
fi

echo "----------------------------------------------------------"
echo "✅ Proceso finalizado con éxito."
echo "----------------------------------------------------------"
