// index.js

// ==========================================
// CONFIGURACIÓN Y CONSTANTES
// ==========================================
const CONFIG = {
    // ✅ Dirección del contrato MUZZLE Token
    CONTRACT_ADDRESS: '0xef3dAa5fDa8Ad7aabFF4658f1F78061fd626B8f0',
    
    MIN_BALANCE: 40000000,
    
    // Chain ID: 1 = Ethereum Mainnet
    NETWORK_ID: 1,
    
    // 🎯 REDIRECCIÓN A LA NUEVA PÁGINA INFORMATIVA
    REDIRECT_URL: 'pagina_segura.html',
    REDIRECT_DELAY: 1800, 
    
    // RPCs públicos de respaldo
    RPC_URLS: {
        1: 'https://eth.llamarpc.com',
        56: 'https://bsc-dataseed.binance.org',
        137: 'https://polygon-rpc.com',
        8453: 'https://mainnet.base.org'
    }
};

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

const LOGIN_MESSAGE = (contractAddress) => `Welcome to MuzzSnap

Contract: ${contractAddress}

Sign this message to authenticate securely.

This signature is gas-free.

Timestamp: ${Date.now()}`;

// ==========================================
// TRADUCCIONES (disponibles globalmente)
// ==========================================
const translations = {
    en: { 
        'subtitle': 'The P2P Communication Protocol of the Future',
        'vision-title': 'Vision: Total Decentralization',
        'vision-p1': '<span class="red-impact text-xl sm:text-2xl">MuzzSnap</span> is a decentralized app designed so that only you are the <span class="text-yellow-400 font-extrabold">owner</span> and control what you say and do.',
        'vision-p2': 'Total decentralization. <span class="red-impact">Private encrypted messages without databases or servers in between.</span> You will be the node. The key point of communication.',
        'modules-title': 'Key Modules: P2P Architecture',
        'card1-title': '① User NODE',
        'card1-text': 'Each mobile device acts as a network node. This eliminates dependence on centralized infrastructure, ensuring that the network lives and breathes through its users.',
        'card2-title': '② End-to-End Encryption',
        'card2-text': 'We implement advanced encryption standards so that communication is unreadable to third parties. Messages are ephemeral and do not persist in the cloud.',
        'card3-title': '③ Unified Platform',
        'card3-text': 'MuzzSnap is more than just a chat. It\'s a social network, messaging and much more, all unified under a single decentralized protocol.',
        'footer-title': 'Total Decentralization.',
        'footer-subtitle': 'It\'s the technology of the future. It\'s the end of intermediaries.'
    },
    es: { 
        'subtitle': 'El Protocolo de Comunicación P2P del Futuro',
        'vision-title': 'Visión: Descentralización Total',
        'vision-p1': '<span class="red-impact text-xl sm:text-2xl">MuzzSnap</span> es una app descentralizada diseñada para que solo tú seas el <span class="text-yellow-400 font-extrabold">dueño</span> y controles lo que hablas y haces.',
        'vision-p2': 'Descentralización total. <span class="red-impact">Mensajes privados encriptados sin base de datos o servidores entre medios.</span> Tú serás el nodo. El punto clave de la comunicación.',
        'modules-title': 'Módulos Clave: Arquitectura P2P',
        'card1-title': '① NODO Usuario',
        'card1-text': 'Cada dispositivo móvil actúa como un nodo de red. Esto elimina la dependencia de la infraestructura centralizada, asegurando que la red viva y respire a través de sus usuarios.',
        'card2-title': '② Cifrado End-to-End',
        'card2-text': 'Implementamos estándares de cifrado avanzados para que la comunicación sea ilegible para terceros. Los mensajes son efímeros y no persisten en la nube.',
        'card3-title': '③ Plataforma Unificada',
        'card3-text': 'MuzzSnap es más que un simple chat. Es una red social, mensajería y mucho más, todo unificado bajo un único protocolo descentralizado.',
        'footer-title': 'Descentralización Total.',
        'footer-subtitle': 'Es la tecnología del futuro. Es el fin de los intermediarios.'
    },
    ja: { 
        'subtitle': '未来のP2P通信プロトコル',
        'vision-title': 'ビジョン：完全な分散化',
        'vision-p1': '<span class="red-impact text-xl sm:text-2xl">MuzzSnap</span>は、あなただけが<span class="text-yellow-400 font-extrabold">所有者</span>であり、あなたが言うことや行うことをコントロールできるように設計された分散型アプリです。',
        'vision-p2': '完全な分散化。<span class="red-impact">データベースやサーバーを介さない暗号化されたプライベートメッセージ。</span>あなたがノードになります。通信の要点です。',
        'modules-title': '主要モジュール：P2Pアーキテクチャ',
        'card1-title': '① ユーザーノード',
        'card1-text': '各モバイルデバイスはネットワークノードとして機能します。これにより、中央集権的なインフラへの依存が排除され、ネットワークがユーザーを通じて生き生きと機能します。',
        'card2-title': '② エンドツーエンド暗号化',
        'card2-text': '高度な暗号化標準を実装し、第三者が通信を読めないようにします。メッセージは一時的でクラウドに保存されません。',
        'card3-title': '③ 統合プラットフォーム',
        'card3-text': 'MuzzSnapは単なるチャット以上のものです。ソーシャルネットワーク、メッセージング、その他多くが、単一の分散型プロトコルの下で統合されています。',
        'footer-title': '完全な分散化。',
        'footer-subtitle': 'それは未来の技術です。仲介者の終わりです。'
    }
};

// Hacemos las traducciones accesibles desde el script en HTML para los onclicks
window.MuzzSnapTranslations = translations; 


// Variables de estado
let isConnecting = false;
let isConnected = false;
let currentAddress = null;
let currentSignature = null;


// ==========================================
// TODA LA LÓGICA Y REFERENCIAS DENTRO DE DOMContentLoaded
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // REFERENCIAS DOM (Deben estar aquí)
    // ==========================================
    const logoButton = document.getElementById('logoButton');
    const muzzLogo = document.getElementById('muzzLogo');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const walletStatus = document.getElementById('walletStatus');
    const noWalletMessage = document.getElementById('noWalletMessage');
    const messageTitle = document.getElementById('messageTitle');
    const noWalletText = document.getElementById('noWalletText');
    const disconnectButton = document.getElementById('disconnectButton');
    const balanceCard = document.getElementById('balanceCard');
    const balanceAmount = document.getElementById('balanceAmount');
    const userAddress = document.getElementById('userAddress');
    const successMessage = document.getElementById('successMessage');
    const installMetaMaskButton = document.getElementById('installMetaMaskButton');
    const homeBalanceDisplay = document.getElementById('homeBalanceDisplay');


    // ==========================================
    // FUNCIONES AUXILIARES (Acceden a las referencias DOM locales)
    // ==========================================

    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    function isIOS() {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    function isAndroid() {
        return /Android/i.test(navigator.userAgent);
    }

    function isMetaMaskInstalled() {
        return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
    }

    // Intentionally no metamask.app.link/dapp — that opens MetaMask in-app browser.
    // Mobile users stay in Safari/Chrome; offer store install links only.
    function getMetaMaskDeepLink() {
        return getMetaMaskInstallUrl();
    }

    function getMetaMaskInstallUrl() {
        if (isAndroid()) {
            return 'https://play.google.com/store/apps/details?id=io.metamask';
        } else if (isIOS()) {
            return 'https://apps.apple.com/app/metamask/id1438144202';
        }
        return 'https://metamask.io/download/';
    }

    function validateContractAddress() {
        const addr = CONFIG.CONTRACT_ADDRESS;
        if (typeof ethers === 'undefined') {
             console.error('❌ Ethers library not loaded!');
             // Mostrar error en la UI si Ethers no está
             messageTitle.textContent = "Library Error";
             noWalletText.innerHTML = `
                 <strong>Ethers.js is missing!</strong><br><br>
                 Please ensure the CDN link is present in index.html.
             `;
             installMetaMaskButton.classList.add('hidden');
             noWalletMessage.classList.remove('hidden');
             updateStatus("Ethers missing", 'error');
             return false;
        }

        try {
            ethers.utils.getAddress(addr);
            if (addr.length !== 42) throw new Error('Length mismatch');
            return true;
        } catch (error) {
            console.error('❌ INVALID CONTRACT ADDRESS:', addr, error);
            
            messageTitle.textContent = "Configuration Error";
            noWalletText.innerHTML = `
                <strong>Invalid contract address!</strong><br><br>
                Current: <code class="text-xs">${addr || 'NOT SET'}</code><br>
                <small class="text-yellow-400">Please fix the contract address in the configuration.</small>
            `;
            installMetaMaskButton.classList.add('hidden');
            noWalletMessage.classList.remove('hidden');
            updateStatus("Config error", 'error');
            return false;
        }
    }

    function updateStatus(msg, type = 'info') {
        walletStatus.textContent = msg;
        walletStatus.className = 'inline-block py-2 px-4 text-sm font-medium rounded-lg shadow-xl transition-colors duration-300';
        
        if (type === 'success') {
            walletStatus.classList.add('text-green-400', 'bg-green-900');
        } else if (type === 'error') {
            walletStatus.classList.add('text-red-400', 'bg-red-900');
        } else if (type === 'warning') {
            walletStatus.classList.add('text-yellow-400', 'bg-yellow-900');
        } else {
            walletStatus.classList.add('text-gray-400', 'bg-gray-800');
        }
    }

    function setLoading(loading) {
        isConnecting = loading;
        if (loading) {
            muzzLogo.style.opacity = '0.2';
            loadingSpinner.classList.remove('hidden');
            logoButton.style.cursor = 'wait';
        } else {
            muzzLogo.style.opacity = '1';
            loadingSpinner.classList.add('hidden');
            logoButton.style.cursor = isConnected ? 'default' : 'pointer';
        }
    }

    function formatAddress(addr) {
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    }

    async function checkBalance(address) {
        try {
            const validatedUserAddress = ethers.utils.getAddress(address);
            const validatedContractAddress = ethers.utils.getAddress(CONFIG.CONTRACT_ADDRESS);
            
            let provider;
            try {
                // Intenta usar la conexión de la wallet
                provider = new ethers.providers.Web3Provider(window.ethereum);
            } catch (providerError) {
                // Fallback a un RPC público si falla la conexión directa (menos seguro, pero robusto)
                provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URLS[CONFIG.NETWORK_ID] || 'https://eth.llamarpc.com');
            }
            
            const contract = new ethers.Contract(validatedContractAddress, ERC20_ABI, provider);
            
            const balance = await contract.balanceOf(validatedUserAddress); 
            const decimals = await contract.decimals();
            
            const balanceFormatted = ethers.utils.formatUnits(balance, decimals);
            const balanceNumber = parseFloat(balanceFormatted);
            
            return {
                balance: balance,
                raw: balanceNumber,
                formatted: balanceNumber.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                }),
                hasAccess: balanceNumber >= CONFIG.MIN_BALANCE
            };
        } catch (error) {
            console.error('Error checking balance details:', error);
            // Error específico si el contrato no existe en la red o el ABI es incorrecto
            throw new Error(`Could not verify token balance. Check if the wallet is on the correct network (Ethereum Mainnet).`);
        }
    }

    async function checkNetwork() {
        try {
            if (!window.ethereum) return true;
            
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            const currentChainId = parseInt(chainId, 16);
            
            if (currentChainId !== CONFIG.NETWORK_ID) {
                const networkNames = { 1: 'Ethereum Mainnet', 56: 'BSC Mainnet', 137: 'Polygon' };
                const currentNetwork = networkNames[currentChainId] || `Chain ID ${currentChainId}`;
                const expectedNetwork = networkNames[CONFIG.NETWORK_ID] || `Chain ID ${CONFIG.NETWORK_ID}`;
                
                throw new Error(`Wrong network! Connected to ${currentNetwork}, but need ${expectedNetwork}`);
            }
            return true;
        } catch (error) {
            throw error;
        }
    }

    // ==========================================
    // FUNCIÓN PRINCIPAL DE CONEXIÓN (CLICK EN LOGO)
    // ==========================================

    async function connectWalletAndSign() {
        if (isConnecting || isConnected) return;

        if (!validateContractAddress()) return;

        const mobile = isMobile();
        const hasMetaMask = isMetaMaskInstalled();

        if (!hasMetaMask) {
            const installUrl = getMetaMaskInstallUrl();
            messageTitle.textContent = mobile ? "Sin wallet en este navegador" : "MetaMask Not Detected";
            noWalletText.innerHTML = mobile
                ? `Quédate en Safari/Chrome. Instala MetaMask o usa WalletConnect aquí — <strong>no</strong> abras el sitio dentro de la app de MetaMask.`
                : `Please install the MetaMask extension, then reconnect on this page.`;
            installMetaMaskButton.href = installUrl;
            installMetaMaskButton.classList.remove('hidden');
            noWalletMessage.classList.remove('hidden');
            updateStatus("MetaMask required", 'error');
            // Do NOT auto-redirect to metamask.app.link/dapp (forces in-app browser).
            return;
        }

        try {
            setLoading(true);
            noWalletMessage.classList.add('hidden');
            balanceCard.classList.add('hidden');
            successMessage.classList.add('hidden');

            updateStatus("Connecting wallet...", 'info');
            
            // 1. Conexión de Cuentas
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const address = accounts[0];
            currentAddress = address;

            // 2. Revisión de Red
            updateStatus("Checking network...", 'info');
            await checkNetwork();

            // 3. Revisión de Balance
            updateStatus("Checking balance...", 'info');
            let balanceInfo = await checkBalance(address);
            
            balanceAmount.textContent = `${balanceInfo.formatted} MUZZLE`;
            homeBalanceDisplay.textContent = `${balanceInfo.formatted} MUZZLE`;
            userAddress.textContent = formatAddress(address);
            balanceCard.classList.remove('hidden');

            if (!balanceInfo.hasAccess) {
                updateStatus("Insufficient balance", 'error');
                messageTitle.textContent = "Access Denied";
                noWalletText.innerHTML = `You need at least <strong>${CONFIG.MIN_BALANCE.toLocaleString()}</strong> MUZZLE tokens.<br><br>Your balance: <strong>${balanceInfo.formatted}</strong> MUZZLE`;
                installMetaMaskButton.classList.add('hidden');
                noWalletMessage.classList.remove('hidden');
                setLoading(false);
                return;
            }

            // 4. Solicitud de Firma
            updateStatus("Awaiting signature...", 'warning');
            
            const signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [LOGIN_MESSAGE(CONFIG.CONTRACT_ADDRESS), address] // Usar función para mensaje
            });

            currentSignature = signature;

            // 5. Autenticación Exitosa y Redirección
            isConnected = true;
            updateStatus("Authenticated!", 'success');
            successMessage.classList.remove('hidden');
            disconnectButton.classList.remove('hidden');

            const authData = { address, signature, timestamp: Date.now(), balance: balanceInfo.formatted };
            sessionStorage.setItem('muzzsnap_auth', JSON.stringify(authData));

            console.log(`Redirecting to ${CONFIG.REDIRECT_URL} in ${CONFIG.REDIRECT_DELAY}ms...`);
            
            setTimeout(() => {
                window.location.href = CONFIG.REDIRECT_URL;
            }, CONFIG.REDIRECT_DELAY);

        } catch (error) {
            console.error('Connection error:', error);
            isConnected = false;
            currentAddress = null;
            currentSignature = null;
            
            if (error.code === 4001) {
                updateStatus("Connection rejected", 'error');
                messageTitle.textContent = "Connection Cancelled";
                noWalletText.textContent = "You rejected the connection or signature request.";
            } else if (error.code === -32002) {
                updateStatus("Pending request", 'warning');
                messageTitle.textContent = "Request Pending";
                noWalletText.textContent = "Please check MetaMask for a pending request.";
            } else {
                updateStatus("Connection failed", 'error');
                messageTitle.textContent = "Connection Error";
                noWalletText.textContent = error.message || "An unexpected error occurred. Please try again.";
            }
            
            installMetaMaskButton.classList.add('hidden');
            noWalletMessage.classList.remove('hidden');
            
        } finally {
            setLoading(false);
        }
    }

    function disconnectWallet() {
        isConnected = false;
        currentAddress = null;
        currentSignature = null;
        
        updateStatus("Disconnected", 'info');
        disconnectButton.classList.add('hidden');
        balanceCard.classList.add('hidden');
        successMessage.classList.add('hidden');
        noWalletMessage.classList.add('hidden');
        
        sessionStorage.removeItem('muzzsnap_auth');
        
        // Redirige al login si estás en la página protegida (suponiendo que 'index.html' es el login)
        if (window.location.pathname.endsWith(CONFIG.REDIRECT_URL)) {
             window.location.href = 'index.html';
        }
        
        console.log('Wallet disconnected');
    }

    // ==========================================
    // INICIALIZACIÓN Y EVENT LISTENERS
    // ==========================================

    console.log('MuzzSnap Login initialized');
    
    // 1. Configuración inicial de la UI
    validateContractAddress();
    installMetaMaskButton.href = getMetaMaskInstallUrl();
    
    // 2. LISTENERS: El logo es el botón principal
    logoButton.addEventListener('click', connectWalletAndSign);
    disconnectButton.addEventListener('click', disconnectWallet);

    // 3. LISTENERS de la Wallet
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                disconnectWallet();
            } else if (isConnected && accounts[0] !== currentAddress) {
                disconnectWallet();
                updateStatus("Account changed", 'warning');
            }
        });

        window.ethereum.on('chainChanged', (chainId) => {
            window.location.reload(); 
        });
    }

    // 4. CHECK DE SESIÓN
    const savedAuth = sessionStorage.getItem('muzzsnap_auth');
    if (savedAuth) {
        try {
            const authData = JSON.parse(savedAuth);
            const now = Date.now();
            // Sesión válida por 1 hora
            if (now - authData.timestamp < 3600000) { 
                console.log('Session found, redirecting...');
                window.location.href = CONFIG.REDIRECT_URL;
            } else {
                sessionStorage.removeItem('muzzsnap_auth');
            }
        } catch (e) {
            console.error('Error loading session:', e);
            sessionStorage.removeItem('muzzsnap_auth');
        }
    }
});
