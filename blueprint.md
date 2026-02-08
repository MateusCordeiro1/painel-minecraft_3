# Painel de Controle do Servidor Minecraft

## Visão Geral

Este projeto é um painel de controle baseado na web para criar e gerenciar servidores Minecraft. A interface permite que os usuários selecionem o tipo de servidor (por exemplo, Vanilla, Forge, Paper), escolham uma versão do Minecraft e iniciem/parem o servidor. O painel também exibirá os logs do servidor em tempo real.

## Recursos Atuais

*   **Interface Web:**
    *   Seleção do tipo de servidor.
    *   Seleção da versão do Minecraft (buscada dinamicamente da API da Mojang).
    *   Abas para futuras implementações de Mods e Plugins.
    *   Botão para criar o servidor.
    *   Área para exibir os logs do servidor.

*   **Backend (Lado do Servidor):**
    *   Aceitação automática do EULA do Minecraft.
    *   Capacidade de iniciar um servidor Minecraft "Vanilla".
    *   Instalação e configuração automática do Java (OpenJDK 21).

## Plano de Implementação (Sessão Atual)

Nesta sessão, o foco foi colocar o servidor Vanilla no ar e criar a interface básica do painel de controle.

*   **DONE** Criar a estrutura básica do projeto com `index.html`, `style.css`, e `main.js`.
*   **DONE** Desenvolver a interface do painel de controle com seletores e abas.
*   **DONE** Implementar a lógica do frontend para buscar versões do Minecraft e controlar a interface.
*   **DONE** Instalar as dependências necessárias (OpenJDK 21) para executar o servidor.
*   **DONE** Lidar com a aceitação do EULA do Minecraft.
*   **DONE** Resolver problemas de inicialização do servidor (versão do Java, diretório de execução, processos zumbis).
*   **DONE** Iniciar o servidor Minecraft com sucesso.
*   **DONE** Obter o endereço IP público para que os usuários possam se conectar.
*   **DONE** Atualizar o `blueprint.md` com o progresso.
