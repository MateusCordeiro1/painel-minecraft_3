{ pkgs, ... }:
{
  # Which nixpkgs channel to use.
  channel = "stable-23.11"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages.
  packages = [ pkgs.nodejs, pkgs.jdk, pkgs.ngrok, pkgs.git ];

  # Sets environment variables in the workspace.
  env = {};

  # Search for the starship package in nixpkgs channels.
  # starship = {
  #   enable = true;
  #   # You can override the starship configuration.
  #   # settings = {
  #   #   gcloud.disabled = true;
  #   # };
  # };
}