/**
 * MuzzSnap Protocol - Login Logic
 * Version: 2.2 (Mobile MetaMask deeplink for connect+sign; stay in system browser)
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

let mmSdk = null;

function isBraveWallet(provider) {
    return !!(provider && (provider.isBraveWallet || provider._isBraveWallet));
}

function isRealMetaMask(provider) {
    if (!provider) return false;
    if (isBraveWallet(provider)) return false;
    return !!(provider.isMetaMask);
}

function collectInjectedProviders() {
    const list = [];
    const eth = window.ethereum;
    if (!eth) return list;
    if (Array.isArray(eth.providers)) {
        eth.providers.forEach((p) => { if (p) list.push(p); });
    }
    list.push(eth);
    return list;
}

/**
 * Prefer real MetaMask (EIP-6963 / ethereum.providers). Never return Brave Wallet.
 * Brave mobile often injects Brave Wallet as window.ethereum — skip it so SDK deeplink opens MetaMask.
 */
function discoverInjectedProvider() {
    return new Promise((resolve) => {
        const found = [];
        const onAnnounce = (event) => found.push(event.detail);
        window.addEventListener('eip6963:announceProvider', onAnnounce);
        window.dispatchEvent(new Event('eip6963:requestProvider'));
        setTimeout(() => {
            window.removeEventListener('eip6963:announceProvider', onAnnounce);

            const from6963 = found.find((item) => {
                const id = `${item.info?.rdns || ''} ${item.info?.name || ''}`.toLowerCase();
                return id.includes('metamask') && !id.includes('brave');
            });
            if (from6963?.provider && isRealMetaMask(from6963.provider)) {
                resolve(from6963.provider);
                return;
            }

            const injected = collectInjectedProviders();
            const mm = injected.find(isRealMetaMask);
            resolve(mm || null);
        }, 150);
    });
}

async function connectMetaMaskSdk() {
    const mod = await import('https://esm.sh/@metamask/sdk@0.32.1');
    const MetaMaskSDK = mod.MetaMaskSDK || mod.default;
    if (!mmSdk) {
        mmSdk = new MetaMaskSDK({
            dappMetadata: {
                name: 'MuzzSnap',
                url: window.location.origin,
                iconUrl: new URL('muzzsnap.jpg', window.location.href).href
            },
            useDeeplink: true,
            checkInstallationImmediately: false,
            enableAnalytics: false
        });
        if (typeof mmSdk.init === 'function') await mmSdk.init();
    }
    if (typeof mmSdk.connect === 'function') {
        await mmSdk.connect();
    }
    return mmSdk.getProvider() || null;
}

/**
 * Resolve MetaMask without opening metamask.app.link/dapp (keeps browsing in Brave/Safari/Chrome).
 * If only Brave Wallet is injected, use MetaMask SDK deeplink for connect + personal_sign.
 */
async function getWalletProvider() {
    const injectedMm = await discoverInjectedProvider();
    if (injectedMm) return injectedMm;
    return connectMetaMaskSdk();
}

async function handleLogin() {
    UI.reset();
    UI.updateStatus("Opening wallet...");

    try {
        if (typeof ethers === 'undefined') {
            throw new Error('Wallet library failed to load.');
        }

        // Never: window.location = metamask.app.link/dapp/...
        const rawProvider = await getWalletProvider();
        if (!rawProvider) {
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (isMobile) {
                UI.showError(
                    "Sin wallet",
                    "Instala MetaMask. En Brave/Safari/Chrome: al conectar se abrirá MetaMask para firmar (no uses Brave Wallet); luego vuelve a este navegador."
                );
            } else {
                UI.showError("No Wallet", "Please install MetaMask extension.");
            }
            return;
        }

        const provider = new ethers.providers.Web3Provider(rawProvider, 'any');

        // Connect (forces MetaMask sheet on mobile via SDK deeplink)
        UI.updateStatus("Approve and sign in MetaMask, then return to this browser (Brave/Safari/Chrome).");
        const accounts = await provider.send("eth_requestAccounts", []);
        const wallet = accounts[0];

        // personal_sign — must always run after connect so MM shows the signature sheet
        UI.updateStatus("Signature Required...");
        const msg = `MUZZSNAP AUTHENTICATION\n\nNode: ${wallet}\nAccess: 20M MUZZLE required.\n\nSecurity clearance required for encrypted chat access.`;
        const sig = await provider.getSigner().signMessage(msg);

        const { chainId } = await provider.getNetwork();
        if (chainId !== PROTOCOL_CONFIG.chainId) {
            UI.showError("Network Error", "Please switch to Ethereum Mainnet.");
            return;
        }

        UI.updateStatus("Scanning Balance...");
        const abi = ["function balanceOf(address owner) view returns (uint256)"];
        const contract = new ethers.Contract(PROTOCOL_CONFIG.tokenAddress, abi, provider);
        const rawBalance = await contract.balanceOf(wallet);
        const balance = parseFloat(ethers.utils.formatUnits(rawBalance, 18));

        if (balance < PROTOCOL_CONFIG.minHold) {
            UI.showError("Access Denied", `20M MUZZLE required. You have: ${Math.floor(balance).toLocaleString()}`);
            return;
        }

        UI.updateStatus("Access Granted!");
        sessionStorage.setItem('muzz_wallet_address', wallet.toLowerCase());
        sessionStorage.setItem('muzz_auth_sig', sig);

        setTimeout(() => {
            window.location.href = PROTOCOL_CONFIG.targetPage;
        }, 800);

    } catch (err) {
        console.error("Auth Error:", err);
        const msg = (err && (err.message || err.reason)) ? String(err.message || err.reason) : "User rejected connection.";
        if (/no provider|sdk|NO_WALLET/i.test(msg)) {
            UI.showError(
                "Sin wallet",
                "Instala MetaMask. En Brave/Safari/Chrome: al conectar se abrirá MetaMask para firmar (no uses Brave Wallet); luego vuelve a este navegador."
            );
            return;
        }
        UI.showError("Security Error", msg);
    }
}

if (UI.btn) {
    UI.btn.onclick = handleLogin;
}

function bindProviderEvents(provider) {
    if (!provider || typeof provider.on !== 'function') return;
    provider.on('accountsChanged', () => window.location.reload());
    provider.on('chainChanged', () => window.location.reload());
}

if (window.ethereum) {
    bindProviderEvents(window.ethereum);
}
