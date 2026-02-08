#!/bin/bash

echo "================================================="
echo "INICIANDO SERVIDOR MINECRAFT E TÚNEL NGROK..."
echo "================================================="

# Inicia o servidor Minecraft em segundo plano e guarda o log
echo "[PASSO 1/2] Iniciando o servidor Minecraft em segundo plano..."
cd server
java -Xmx1024M -Xms1024M -jar server.jar nogui > server.log 2>&1 &
cd ..

# Aguarda um pouco para o servidor iniciar completamente
sleep 8

echo "[PASSO 2/2] Servidor iniciado. Criando o túnel com ngrok..."
echo "Aguarde... O endereço de IP aparecerá abaixo."
echo "================================================="

# Inicia o ngrok, que mostrará o endereço no terminal
ngrok tcp 25565
