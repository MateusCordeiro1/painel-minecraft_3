document.addEventListener('DOMContentLoaded', () => {
    const socket = io({ reconnectionAttempts: 10, reconnectionDelay: 1000 });

    const startButton = document.getElementById('startButton');
    const stopButton = document.getElementById('stopButton');
    const restartButton = document.getElementById('restartButton');
    const deleteServerBtn = document.getElementById('deleteServerBtn');
    const terminal = document.getElementById('terminal');
    const serverSelector = document.getElementById('serverSelector');
    const versionSelector = document.getElementById('versionSelector');
    const serverNameInput = document.getElementById('serverNameInput');
    const createServerForm = document.getElementById('createServerForm');
    const creationStatus = document.getElementById('creationStatus');
    const serverIpElement = document.getElementById('serverIp');
    const copyIpButton = document.getElementById('copyIpButton');
    const commandInput = document.getElementById('commandInput');
    const sendCommandBtn = document.getElementById('sendCommandBtn');

    let serverRunning = false;
    let activeServerName = null;
    let ipCheckInterval = null;

    const updateButtonStates = (isRunning, serverName) => {
        serverRunning = isRunning;
        activeServerName = isRunning ? serverName : null;
        startButton.disabled = isRunning;
        stopButton.disabled = !isRunning;
        restartButton.disabled = !isRunning;
        deleteServerBtn.disabled = isRunning;
        serverSelector.disabled = isRunning;
        commandInput.disabled = !isRunning;
        sendCommandBtn.disabled = !isRunning;
        if (isRunning) {
            startButton.textContent = `Rodando: ${serverName}`;
            startIpPolling();
        } else {
            startButton.textContent = '▶ Iniciar';
            serverIpElement.textContent = 'parado';
            stopIpPolling();
        }
    };

    const getSelectedServer = () => serverSelector.value;

    const fetchServerIp = async () => {
        if (!serverRunning) return;
        try {
            const response = await fetch('/ip');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            serverIpElement.textContent = data.ip || 'buscando...';
        } catch (error) {
            serverIpElement.textContent = 'erro ao buscar';
            console.error('Error fetching IP:', error);
        }
    };

    const startIpPolling = () => {
        stopIpPolling();
        fetchServerIp();
        ipCheckInterval = setInterval(fetchServerIp, 7000);
    };

    const stopIpPolling = () => {
        clearInterval(ipCheckInterval);
        ipCheckInterval = null;
    };

    const sendCommand = () => {
        const command = commandInput.value.trim();
        if (command && serverRunning) {
            socket.emit('terminal-command', command);
            commandInput.value = '';
        }
    };

    const clearTerminal = (text = 'A saída do servidor aparecerá aqui...') => {
        terminal.textContent = text;
    };
    
    const clearCreationStatus = (text = 'O status da criação aparecerá aqui.') => {
        creationStatus.textContent = text;
    }

    createServerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const serverName = serverNameInput.value.trim();
        const versionName = versionSelector.value;
        if (!serverName || !versionName) {
            alert('Por favor, selecione uma versão e digite um nome para o servidor.');
            return;
        }
        clearCreationStatus(`Iniciando criação do servidor '${serverName}' com a versão '${versionName}'...`);
        socket.emit('create-server', { serverName, versionName });
        serverNameInput.value = '';
    });

    startButton.addEventListener('click', () => {
        const serverDir = getSelectedServer();
        if (!serverDir) {
            alert("Por favor, selecione um servidor para iniciar!");
            return;
        }
        if (serverRunning) return;
        clearTerminal(`Enviando comando para iniciar o servidor '${serverDir}'...`);
        socket.emit('start-script', { serverDir });
    });

    stopButton.addEventListener('click', () => {
        if (!serverRunning) return;
        socket.emit('stop-script');
    });
    
    restartButton.addEventListener('click', () => {
        if(!serverRunning) return;
        clearTerminal(`Enviando comando para reiniciar o servidor '${activeServerName}'...`);
        socket.emit('stop-script');
        setTimeout(() => {
            if (!serverRunning) {
                socket.emit('start-script', { serverDir: activeServerName });
            }
        }, 4000);
    });

    deleteServerBtn.addEventListener('click', async () => {
        const serverName = getSelectedServer();
        if (!serverName) {
            alert('Por favor, selecione um servidor para deletar.');
            return;
        }
        if (serverRunning) {
            alert('Você não pode deletar um servidor que está em execução. Pare-o primeiro.');
            return;
        }
        if (confirm(`Você tem CERTEZA que quer deletar o servidor '${serverName}'? Esta ação é irreversível.`)) {
            try {
                const response = await fetch(`/delete/${serverName}`, { method: 'DELETE' });
                const result = await response.json();
                alert(result.message);
                if (result.success) {
                    clearTerminal(`Servidor '${serverName}' foi deletado.`);
                }
            } catch (error) {
                console.error('Error deleting server:', error);
                alert('Ocorreu um erro na comunicação ao tentar deletar o servidor.');
            }
        }
    });

    copyIpButton.addEventListener('click', () => {
        const ip = serverIpElement.textContent;
        if (ip && !['parado', 'buscando...', 'erro ao buscar', 'indisponível'].includes(ip)) {
            navigator.clipboard.writeText(ip)
                .then(() => alert(`IP "${ip}" copiado!`))
                .catch(err => console.error('Falha ao copiar o IP:', err));
        }
    });
    
    sendCommandBtn.addEventListener('click', sendCommand);
    commandInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendCommand(); });

    socket.on('connect', () => {
        console.log('Conectado ao backend!');
        socket.emit('get-initial-data');
    });

    socket.on('disconnect', () => {
        terminal.textContent += `\n\n--- DESCONECTADO DO PAINEL. ---`;
        updateButtonStates(false, null);
    });

    socket.on('minecraft-versions', (versions) => {
        versionSelector.innerHTML = '<option value="">Selecione uma versão</option>';
        versions.forEach(v => {
            const option = document.createElement('option');
            option.value = v.id;
            option.textContent = v.id;
            versionSelector.appendChild(option);
        });
    });

    socket.on('existing-servers', (servers) => {
        const currentServer = getSelectedServer();
        serverSelector.innerHTML = '<option value="">Selecione um servidor</option>';
        servers.forEach(s => {
            const option = document.createElement('option');
            option.value = s;
            option.textContent = s;
            serverSelector.appendChild(option);
        });
        if (servers.includes(currentServer)) {
            serverSelector.value = currentServer;
        } else {
            clearTerminal();
        }
    });

    socket.on('creation-status', (data) => {
        if(creationStatus.textContent.startsWith('O status da criação aparecerá aqui')){
            creationStatus.textContent = '';
        }
        creationStatus.textContent += `${data}\n`;
        creationStatus.scrollTop = creationStatus.scrollHeight;
    });

    socket.on('terminal-output', (data) => {
        if (terminal.textContent.startsWith('A saída do servidor aparecerá aqui...') || terminal.textContent.startsWith('Enviando comando para iniciar')) {
            terminal.textContent = '';
        }
        terminal.textContent += data;
        terminal.scrollTop = terminal.scrollHeight;
    });

    socket.on('script-started', (serverName) => {
        updateButtonStates(true, serverName);
        clearCreationStatus();
    });

    socket.on('script-stopped', () => {
        updateButtonStates(false, null);
        terminal.textContent += `\n\n--- SERVIDOR PARADO. ---`;
    });

    updateButtonStates(false, null);
    clearTerminal();
    clearCreationStatus();
});