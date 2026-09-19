/**
 * MuzzSnap Protocol - Login Logic
 * Version: 2.1 (Anti-Frame & Digital Signature)
 */

const PROTOCOL_CONFIG = {
    tokenAddress: "0xef3dAa5fDa8Ad7aabFF4658f1F78061fd626B8f0",
    minHold: 20000000, // 20 Millones
    chainId: 1,        // Ethereum Mainnet
    targetPage: 'chat.html'
};

const UI = {
    btn: document.getElementById('btnConnect'),
    loading: document.getElementById('loadingUI'),
    status: document.getElementById('statusText'),
    errorBox: document.getElementById('errorBox'),
    errorTitle: document.getElementById('errorTitle'),
    errorDesc: document.getElementById('errorDesc'),

    reset() {
        this.errorBox.classList.add('hidden');
        this.loading.classList.remove('hidden');
    },

    updateStatus(text) {
        this.status.innerText = text;
    },

    showError(title, desc) {
        this.loading.classList.add('hidden');
        this.errorBox.classList.remove('hidden');
        this.errorTitle.innerText = title;
        this.errorDesc.innerText = desc;
        this.updateStatus("Access Failed");
    }
};

async function handleLogin() {
    UI.reset();
    UI.updateStatus("Initializing...");

    // 1. Detección de Wallet (nunca redirigir a MetaMask in-app browser)
    if (typeof window.ethereum === 'undefined') {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
            UI.showError(
                "Sin wallet en este navegador",
                "Quédate en Safari/Chrome. Instala MetaMask o usa WalletConnect desde esta página — no abras el sitio dentro de la app."
            );
        } else {
            UI.showError("No Wallet", "Please install MetaMask extension.");
        }
        return;
    }

    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // 2. Conectar Cuenta
        UI.updateStatus("Connecting Wallet...");
        const accounts = await provider.send("eth_requestAccounts", []);
        const wallet = accounts[0];

        // 3. Firma Digital (Prueba de identidad)
        UI.updateStatus("Signature Required...");
        const msg = `MUZZSNAP AUTHENTICATION\n\nNode: ${wallet}\nAccess: 20M MUZZLE required.\n\nSecurity clearance required for encrypted chat access.`;
        const sig = await provider.getSigner().signMessage(msg);

        // 4. Verificar Red
        const { chainId } = await provider.getNetwork();
        if (chainId !== PROTOCOL_CONFIG.chainId) {
            UI.showError("Network Error", "Please switch to Ethereum Mainnet.");
            return;
        }

        // 5. Verificar Balance
        UI.updateStatus("Scanning Balance...");
        const abi = ["function balanceOf(address owner) view returns (uint256)"];
        const contract = new ethers.Contract(PROTOCOL_CONFIG.tokenAddress, abi, provider);
        const rawBalance = await contract.balanceOf(wallet);
        const balance = parseFloat(ethers.utils.formatUnits(rawBalance, 18));

        if (balance < PROTOCOL_CONFIG.minHold) {
            UI.showError("Access Denied", `20M MUZZLE required. You have: ${Math.floor(balance).toLocaleString()}`);
            return;
        }

        // 6. Autorización Exitosa
        UI.updateStatus("Access Granted!");
        sessionStorage.setItem('muzz_wallet_address', wallet.toLowerCase());
        sessionStorage.setItem('muzz_auth_sig', sig);

        setTimeout(() => {
            window.location.href = PROTOCOL_CONFIG.targetPage;
        }, 800);

    } catch (err) {
        console.error("Auth Error:", err);
        UI.showError("Security Error", err.message || "User rejected connection.");
    }
}

// Asignar evento
if (UI.btn) {
    UI.btn.onclick = handleLogin;
}

// Recargar si el usuario cambia de cuenta o red
if (window.ethereum) {
    window.ethereum.on('accountsChanged', () => window.location.reload());
    window.ethereum.on('chainChanged', () => window.location.reload());
}
