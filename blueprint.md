# Painel de Controle do Servidor Minecraft

## Visão Geral

Este projeto é um painel de controle baseado na web para criar e gerenciar servidores Minecraft. A interface permite que os usuários selecionem uma versão do Minecraft, criem um servidor com um nome personalizado e, em seguida, iniciem, parem, e interajam com o console do servidor em tempo real.

## Recursos Implementados

*   **Design e Interface:**
    *   **Tema Escuro Moderno:** Interface com um tema escuro, limpo e responsivo, utilizando a fonte Inter para melhor legibilidade.
    *   **Layout Intuitivo:** Os controles são agrupados logicamente. O terminal do servidor agora está integrado diretamente na seção "Controles do Servidor Ativo" para uma experiência de usuário unificada.
    *   **Ícones e Efeitos Visuais:** Uso de ícones para ações, gradientes sutis e efeitos de "glow" em botões para uma aparência polida.

*   **Criação de Servidor Dinâmica:**
    *   Busca as versões mais recentes do Minecraft diretamente da API da Mojang.
    *   Permite que o usuário nomeie seu servidor.
    *   Baixa o `server.jar` correspondente, aceita o EULA automaticamente e prepara o diretório do servidor.
    *   Copia os scripts necessários (`start.sh`, `ngrok`) para o diretório do novo servidor.

*   **Gerenciamento de Servidor:**
    *   **Listagem:** Lista todos os servidores existentes em um menu suspenso.
    *   **Controles:** Botões para "Iniciar", "Parar" e "Reiniciar" o servidor ativo.
    *   **Deleção:** Permite a exclusão de servidores (somente quando estão parados).
    *   **Status:** Desabilita/habilita os controles com base no estado do servidor (ligado/desligado).

*   **Console Interativo e IP:**
    *   **Terminal em Tempo Real Integrado:** Exibe a saída do console do servidor diretamente no painel de controle ativo.
    *   **Envio de Comandos:** Permite que o administrador envie comandos para o servidor Minecraft através de um campo de texto.
    *   **Exibição de IP:** Mostra o IP público do servidor (via Ngrok) e um botão para copiá-lo facilmente.

*   **Backend e Arquitetura:**
    *   **Node.js com Express:** Para o servidor web e a API.
    *   **Socket.IO:** Para comunicação bidirecional em tempo real entre o frontend e o backend.
    *   **Estrutura Modular:** Código organizado para separar responsabilidades.

## Plano de Melhoria da Interface (Sessão Atual)

**Objetivo:** Melhorar a interface do usuário (UI) movendo o terminal do servidor e aplicando um design visual moderno.

**Passos:**

1.  **[CONCLUÍDO] Reestruturar `public/index.html`:** Mover o `div` do terminal e da caixa de comandos para dentro da seção "Controles do Servidor Ativo".
2.  **[CONCLUÍDO] Criar `public/style.css`:** Desenvolver uma nova folha de estilos do zero para implementar um tema escuro, moderno e responsivo. O novo CSS organiza os elementos de forma coesa, melhorando a usabilidade.
3.  **[CONCLUÍDO] Atualizar `blueprint.md`:** Documentar as mudanças na interface e a criação do novo design no blueprint do projeto.
