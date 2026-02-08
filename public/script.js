document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // --- Elementos da UI ---
    const startButton = document.getElementById('startButton');
    const restartButton = document.getElementById('restartButton');
    const stopButton = document.getElementById('stopButton');
    const deleteServerBtn = document.getElementById('deleteServerBtn');
    const terminal = document.getElementById('terminal');
    const serverSelector = document.getElementById('serverSelector');
    const versionSelector = document.getElementById('versionSelector');
    const serverNameInput = document.getElementById('serverNameInput');
    const createServerForm = document.getElementById('createServerForm');
    const creationStatus = document.getElementById('creationStatus');
    const serverIpElement = document.getElementById('serverIp');
    const copyIpButton = document.getElementById('copyIpButton');

    let serverRunning = false;
    let activeServerName = null;
    let ipCheckInterval = null;

    // --- Funções ---
    function updateButtonStates(isRunning, serverName) {
        serverRunning = isRunning;
        activeServerName = isRunning ? serverName : null;

        startButton.disabled = isRunning;
        restartButton.disabled = !isRunning;
        stopButton.disabled = !isRunning;
        deleteServerBtn.disabled = isRunning;
        serverSelector.disabled = isRunning;

        if (isRunning) {
            startButton.textContent = `Rodando: ${serverName}`;
            startIpPolling();
        } else {
            startButton.textContent = '▶ Iniciar';
            serverIpElement.textContent = 'parado';
            stopIpPolling();
        }
    }

    function getSelectedServer() {
        return serverSelector.value;
    }

    async function fetchServerIp() {
        if (!serverRunning) return;
        try {
            const response = await fetch('/ip');
            const data = await response.json();
            serverIpElement.textContent = data.ip || 'buscando...';
        } catch (error) {
            serverIpElement.textContent = 'erro ao buscar';
        }
    }

    function startIpPolling() {
        if (ipCheckInterval) clearInterval(ipCheckInterval);
        fetchServerIp(); // Busca imediata
        ipCheckInterval = setInterval(fetchServerIp, 7000); // Busca a cada 7 segundos
    }

    function stopIpPolling() {
        if (ipCheckInterval) clearInterval(ipCheckInterval);
    }

    // --- Event Listeners ---
    startButton.addEventListener('click', () => {
        const server = getSelectedServer();
        if (!server) { alert("Por favor, selecione um servidor primeiro!"); return; }
        if (serverRunning) return;
        
        terminal.textContent = `Enviando comando para iniciar o servidor '${server}'...\n`;
        socket.emit('start-script', { serverDir: server });
    });

    stopButton.addEventListener('click', () => {
        terminal.textContent += '\n\n--- PARANDO SERVIDOR... ---\n';
        socket.emit('stop-script');
    });

    deleteServerBtn.addEventListener('click', async () => {
        const serverName = getSelectedServer();
        if (!serverName) {
            alert('Por favor, selecione um servidor para deletar.');
            return;
        }

        const confirmation = confirm(`Você tem certeza que quer deletar o servidor '${serverName}'? Esta ação não pode ser desfeita.`);
        if (!confirmation) return;

        try {
            const response = await fetch(`/delete/${serverName}`, { method: 'DELETE' });
            const result = await response.json();

            if (result.success) {
                alert(result.message);
                terminal.textContent = `Servidor '${serverName}' foi deletado.\n`;
            } else {
                alert(`Erro: ${result.message}`);
            }
        } catch (error) {
            console.error('Error deleting server:', error);
            alert('Ocorreu um erro na comunicação ao tentar deletar o servidor.');
        }
    });

    createServerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const versionName = versionSelector.options[versionSelector.selectedIndex].text;
        const serverName = serverNameInput.value.trim();
        if (!versionName || !serverName) {
            alert('Por favor, selecione uma versão e digite um nome para o servidor.');
            return;
        }
        creationStatus.textContent = `Iniciando criação do servidor '${serverName}' com a versão '${versionName}'...\n`;
        socket.emit('create-server', { versionName, serverName });
        serverNameInput.value = '';
    });

    copyIpButton.addEventListener('click', () => {
        const ip = serverIpElement.textContent;
        if (ip && ip !== 'parado' && ip !== 'buscando...' && ip !== 'erro ao buscar') {
            navigator.clipboard.writeText(ip).then(() => {
                alert(`IP "${ip}" copiado para a área de transferência!`);
            }, (err) => {
                alert('Falha ao copiar o IP.');
                console.error('Clipboard error:', err);
            });
        }
    });

    // --- Socket.IO Listeners ---
    socket.on('connect', () => socket.emit('get-initial-data'));

    socket.on('minecraft-versions', (versions) => {
        versionSelector.innerHTML = '<option value="">Selecione uma versão</option>';
        versions.forEach(v => {
            const option = document.createElement('option');
            option.value = v.url; // Embora não usado diretamente no submit, é bom ter
            option.textContent = v.id;
            versionSelector.appendChild(option);
        });
    });
    
    socket.on('existing-servers', (servers) => {
        const currentServer = serverSelector.value;
        serverSelector.innerHTML = '<option value="">Selecione um servidor</option>';
        servers.forEach(s => {
            const option = document.createElement('option');
            option.value = s;
            option.textContent = s;
            serverSelector.appendChild(option);
        });

        if (servers.includes(currentServer)) {
            serverSelector.value = currentServer;
        }
    });

    socket.on('creation-status', (data) => {
        creationStatus.textContent += data + '\n';
        creationStatus.scrollTop = creationStatus.scrollHeight;
    });

    socket.on('terminal-output', (data) => {
        if (terminal.textContent.startsWith('A saída do servidor aparecerá aqui...')) {
            terminal.textContent = '';
        }
        terminal.textContent += data;
        terminal.scrollTop = terminal.scrollHeight;
    });

    socket.on('script-started', (serverName) => updateButtonStates(true, serverName));

    socket.on('script-stopped', () => {
        updateButtonStates(false, null);
        terminal.textContent += '\n\n--- SERVIDOR PARADO. ---\n';
    });

    socket.on('disconnect', () => {
        terminal.textContent += '\n--- DESCONECTADO DO PAINEL. ---\n';
        updateButtonStates(false, null);
    });
});
