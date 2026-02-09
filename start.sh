#!/bin/bash

echo "--- Iniciando script start.sh com Nix ---"

# Defina a porta e a quantidade de memória aqui
MINECRAFT_PORT=25565
MEMORY="5G"
NGROK_LOG="ngrok.log"

echo "Autenticando Ngrok..."
./ngrok authtoken $NGROK_AUTH_TOKEN --log=stdout > $NGROK_LOG 2>&1

echo "Iniciando túnel TCP do Ngrok na porta $MINECRAFT_PORT..."
./ngrok tcp $MINECRAFT_PORT --log=stdout > $NGROK_LOG 2>&1 &

echo "Aguardando Ngrok iniciar..."
sleep 8

echo "Verificando status do Ngrok (últimas 5 linhas de $NGROK_LOG):"
tail -n 5 $NGROK_LOG

echo "--- Iniciando Servidor Minecraft com Nix ---"
echo "Memória: $MEMORY"

# Executa o servidor Minecraft em primeiro plano usando o nix-shell para garantir o JDK 21.
# A saída será capturada pelo Node.js e exibida no terminal do painel.
nix-shell -p pkgs.jdk21 --run "java -Xmx$MEMORY -Xms$MEMORY -jar server.jar nogui"

echo "--- Script start.sh finalizado ---" # Isso só será exibido se o servidor parar
