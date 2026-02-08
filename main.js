document.addEventListener('DOMContentLoaded', () => {
    const versionSelect = document.getElementById('version-select');
    const createServerBtn = document.getElementById('create-server-btn');
    const logOutput = document.getElementById('log-output');

    const MINECRAFT_VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';

    async function fetchMinecraftVersions() {
        try {
            const response = await fetch(MINECRAFT_VERSION_MANIFEST_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            versionSelect.innerHTML = '<option value="">Selecione uma versão</option>'; // Clear loading text

            // Filter for release versions and add them to the select dropdown
            data.versions
                .filter(version => version.type === 'release')
                .forEach(version => {
                    const option = document.createElement('option');
                    option.value = version.id;
                    option.textContent = version.id;
                    versionSelect.appendChild(option);
                });

        } catch (error) {
            console.error('Failed to fetch Minecraft versions:', error);
            versionSelect.innerHTML = '<option value="">Erro ao carregar versões</option>';
            logOutput.textContent = `Erro ao buscar versões: ${error.message}`;
        }
    }

    createServerBtn.addEventListener('click', () => {
        const selectedVersion = versionSelect.value;
        if (!selectedVersion) {
            logOutput.textContent = 'Por favor, selecione uma versão do Minecraft antes de criar o servidor.';
            return;
        }

        logOutput.textContent = `Iniciando a criação do servidor para a versão: ${selectedVersion}...`;
        
        // A lógica para criar o servidor será tratada pelo assistente de IA
        // que irá interceptar esta ação e executar os comandos necessários no terminal.
        console.log(`AI_ACTION: CREATE_MINECRAFT_SERVER, VERSION: ${selectedVersion}`);
    });

    // Initial fetch of versions
    fetchMinecraftVersions();
});
