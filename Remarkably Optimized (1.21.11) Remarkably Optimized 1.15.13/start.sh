#!/bin/bash

# O diretório de trabalho já é definido pelo server.js, então o script já está no lugar certo.

# Define o caminho absoluto para o diretório raiz do projeto (um nível acima do CWD)
PROJECT_ROOT="$(dirname "$PWD")"

# Configura o token de autenticação do ngrok
"$PROJECT_ROOT/ngrok" config add-authtoken 2mkfkEMKJjOdkKcqsWGul1fMqJ5_guighRYuBkbLJf5jg8EB

# Verifica se o ngrok já está rodando
if pgrep -x "ngrok" > /dev/null
then
    echo "Ngrok já está em execução. Pulando inicialização do túnel."
else
    echo "Iniciando túnel ngrok..."
    # Usa o caminho absoluto para o ngrok para evitar problemas com espaços
    "$PROJECT_ROOT/ngrok" tcp --region sa 25565 &
    sleep 4 
fi

# Inicia o servidor Minecraft
if [ -f "server.jar" ]; then
    echo "Iniciando servidor Minecraft..."
    # Usa nix-shell para garantir o Java, aloca 5GB de RAM,
    # usa nohup para rodar em segundo plano de forma segura (&)
    # e salva a saída em server.log.
    nohup nix-shell -p pkgs.jdk21 --run "java -Xmx5G -jar server.jar nogui" > server.log 2>&1 &
    echo "Servidor iniciado em segundo plano. Logs disponíveis em server.log."
else
    echo "ERRO: server.jar não encontrado!"
fi
