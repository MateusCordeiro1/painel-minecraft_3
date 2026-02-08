# Blueprint: Painel de Controle do Servidor Minecraft

## Visão Geral

Este documento descreve o design e a implementação de um painel de controle web para criar e gerenciar servidores Minecraft. A interface será limpa, moderna e fácil de usar, permitindo aos usuários selecionar uma versão do Minecraft e iniciar um servidor com o mínimo de esforço.

## Design e Estilo

- **Tema:** Dark Mode (Modo Escuro) para uma aparência moderna e focada, com detalhes vibrantes para interatividade.
- **Layout:** Responsivo, adaptável a desktops e dispositivos móveis, utilizando Flexbox e CSS Grid.
- **Tipografia:** Fontes sans-serif (como 'Inter' ou 'Roboto') para garantir legibilidade.
- **Componentes:**
  - **Cabeçalho:** Título da aplicação.
  - **Painel de Controle:** Contendo um seletor de versões do Minecraft e um botão para criar o servidor.
  - **Área de Log:** Um espaço para exibir o output e o status do servidor em tempo real.

## Funcionalidades Implementadas

### Versão 1.0 (Implementação Inicial)

- **Estrutura HTML (`index.html`):**
  - Layout semântico com tags `<header>`, `<main>`, `<section>`, e `<footer>`.
  - Um elemento `<select>` para as versões do Minecraft.
  - Um botão `<button>` para iniciar a criação do servidor.
  - Uma área com a tag `<pre>` para exibir os logs.
- **Estilização (`style.css`):**
  - Variáveis CSS para um esquema de cores consistente (tema escuro).
  - Estilos para botões, seletores e a área de log para uma aparência polida.
  - Efeitos de `hover` e `focus` para interatividade.
- **Lógica do Cliente (`main.js`):**
  - **Carregamento de Versões:** Ao carregar a página, uma chamada à API da Mojang (`version_manifest.json`) preenche o seletor `<select>` com todas as versões de "release" disponíveis.
  - **Interatividade:** Adiciona um listener de evento ao botão "Criar Servidor".

## Plano de Ação (Próximos Passos)

1.  **Criar `index.html`:** Estruturar a página com os elementos visuais principais.
2.  **Criar `style.css`:** Implementar o design de tema escuro, layout e estilos dos componentes.
3.  **Criar `main.js`:** Desenvolver a lógica para buscar as versões do Minecraft e preencher o seletor.
4.  **Configurar o Ambiente:** Adicionar `openjdk` ao ambiente de desenvolvimento para poder executar o servidor Minecraft.
5.  **Implementar a Lógica de Backend (via AI):**
    - Quando o usuário solicitar a criação de um servidor:
      - Baixar o arquivo `.jar` da versão selecionada.
      - Criar o arquivo `eula.txt` necessário.
      - Iniciar o servidor Java em um processo separado.
      - Capturar e exibir o log do servidor na interface.
