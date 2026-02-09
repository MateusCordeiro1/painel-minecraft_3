{ pkgs, ... }:
{
  # Adicione pacotes do Nix aqui.
  # Exemplo: pkgs.go
  channel = "stable-23.11"; # ou "unstable"
  packages = [pkgs.nodejs_20 pkgs.nodePackages.npm pkgs.openjdk21 pkgs.git];

  # Configurações do ambiente.
  env = {};

  # Processos que devem ser iniciados com o ambiente.
  startup = {
    # Exemplo: some-server = {
    #   command = ["some-server" "--port" "8080"];
    # };
  };

  # O que exibir ao iniciar.
  # \`preview\` abre um navegador para o URL especificado.
  # \`terminal\` abre um novo terminal.
  previews = [
    {
      # Exemplo:
      # port = 8080;
      # label = "My Awesome App";
    }
  ];

  # Define um editor ou extenção padrão para tipos de arquivo.
  # \`vscode.extensions.my-extension\` para extensões do VS Code.
  # \`vscode.editors.my-editor\` para editores.
  # Exemplo:
  # "*.md" = "vscode.editors.vscode-markdown-editor";
  defs = {};
}
