/**
 * MuzzSnap Protocol - Login Logic
 * Version: 2.3 (EIP-6963 multi-wallet + WalletConnect; no esm.sh MetaMask SDK)
 */

const PROTOCOL_CONFIG = {
    tokenAddress: "0xef3dAa5fDa8Ad7aabFF4658f1F78061fd626B8f0",
    minHold: 20000000,
    chainId: 1,
    targetPage: 'chat.html'
};

const WC_PROJECT_ID = (typeof window !== 'undefined' && window.MUZZ_WC_PROJECT_ID)
    || '262de461149a3d0a834baf5a0d19924d';
const WC_UMD = 'https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2.17.3/dist/index.umd.js';

const KNOWN_WALLETS = [
    { key: 'metamask', label: 'MetaMask', rdns: ['io.metamask', 'io.metamask.flask'], match: ['metamask'], priority: 1, flag: 'isMetaMask', skipIfBrave: true },
    { key: 'coinbase', label: 'Coinbase Wallet', rdns: ['com.coinbase.wallet'], match: ['coinbase'], priority: 2, flag: 'isCoinbaseWallet' },
    { key: 'rainbow', label: 'Rainbow', rdns: ['me.rainbow'], match: ['rainbow'], priority: 3 },
    { key: 'trust', label: 'Trust Wallet', rdns: ['com.trustwallet.app'], match: ['trust'], priority: 4, flag: 'isTrust' },
    { key: 'rabby', label: 'Rabby', rdns: ['io.rabby'], match: ['rabby'], priority: 5, flag: 'isRabby' },
    { key: 'brave', label: 'Brave Wallet', rdns: ['com.brave.wallet'], match: ['brave'], priority: 90, flag: 'isBraveWallet' }
];

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

let wcProvider = null;

function isBraveWallet(provider) {
    return !!(provider && (provider.isBraveWallet || provider._isBraveWallet));
}

function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-muzz-src="' + src + '"]');
        if (existing) {
            if (existing.dataset.loaded === '1') resolve();
            else existing.addEventListener('load', () => resolve(), { once: true });
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.dataset.muzzSrc = src;
        s.onload = () => { s.dataset.loaded = '1'; resolve(); };
        s.onerror = () => reject(new Error('No se pudo cargar WalletConnect.'));
        document.head.appendChild(s);
    });
}

function discoverEip6963(timeoutMs) {
    return new Promise((resolve) => {
        const found = [];
        const seen = new Set();
        const onAnnounce = (event) => {
            const detail = event.detail;
            if (!detail || !detail.provider) return;
            const id = detail.info?.uuid || detail.info?.rdns || String(found.length);
            if (seen.has(id)) return;
            seen.add(id);
            found.push(detail);
        };
        window.addEventListener('eip6963:announceProvider', onAnnounce);
        window.dispatchEvent(new Event('eip6963:requestProvider'));
        setTimeout(() => {
            window.removeEventListener('eip6963:announceProvider', onAnnounce);
            resolve(found);
        }, timeoutMs || 200);
    });
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

function matchKnown(rdns, name, provider) {
    const r = String(rdns || '').toLowerCase();
    const n = String(name || '').toLowerCase();
    for (const w of KNOWN_WALLETS) {
        if (w.rdns.some((x) => r === x || r.includes(x))) {
            if (w.skipIfBrave && isBraveWallet(provider)) continue;
            return w;
        }
        if (w.match.some((x) => n.includes(x))) {
            if (w.skipIfBrave && isBraveWallet(provider)) continue;
            return w;
        }
        if (w.flag && provider && provider[w.flag]) {
            if (w.skipIfBrave && isBraveWallet(provider)) continue;
            if (w.key === 'metamask' && isBraveWallet(provider)) continue;
            return w;
        }
    }
    return null;
}

async function buildWalletOptions() {
    const announced = await discoverEip6963(220);
    const options = [];
    const usedProviders = new WeakSet();
    const usedKeys = new Set();

    announced.forEach((detail) => {
        const known = matchKnown(detail.info?.rdns, detail.info?.name, detail.provider);
        if (!known || usedKeys.has(known.key)) return;
        usedKeys.add(known.key);
        usedProviders.add(detail.provider);
        options.push({ key: known.key, label: known.label, priority: known.priority, provider: detail.provider });
    });

    collectInjectedProviders().forEach((provider) => {
        if (!provider || usedProviders.has(provider)) return;
        const known = matchKnown('', '', provider);
        if (!known || usedKeys.has(known.key)) return;
        usedKeys.add(known.key);
        usedProviders.add(provider);
        options.push({ key: known.key, label: known.label, priority: known.priority, provider });
    });

    options.sort((a, b) => a.priority - b.priority);
    options.push({ key: 'walletconnect', label: 'WalletConnect', priority: 100, provider: null });
    return options;
}

function pickWallet(options) {
    const labels = options.map((o, i) => (i + 1) + ') ' + o.label).join('\n');
    const raw = window.prompt(
        'Elegí wallet (número):\n' + labels + '\n\nFirmá en la app y volvé a este navegador.',
        '1'
    );
    if (raw == null) throw new Error('PICKER_CANCELLED');
    const idx = parseInt(String(raw).trim(), 10) - 1;
    if (!options[idx]) throw new Error('NO_WALLET');
    return options[idx];
}

async function connectWalletConnect() {
    await loadScriptOnce(WC_UMD);
    const mod = globalThis['@walletconnect/ethereum-provider'];
    const EthereumProvider = mod && (mod.EthereumProvider || mod.default);
    if (!EthereumProvider || typeof EthereumProvider.init !== 'function') {
        throw new Error('WalletConnect no disponible en este navegador.');
    }
    if (wcProvider) {
        try { await wcProvider.disconnect(); } catch (_) {}
        wcProvider = null;
    }
    wcProvider = await EthereumProvider.init({
        projectId: WC_PROJECT_ID,
        optionalChains: [1],
        showQrModal: true,
        metadata: {
            name: 'MuzzSnap',
            description: 'MuzzSnap Login',
            url: window.location.origin,
            icons: [new URL('muzzsnap.jpg', window.location.href).href]
        }
    });
    await wcProvider.enable();
    return wcProvider;
}

/**
 * Resolve a wallet without metamask.app.link/dapp and without esm.sh MetaMask SDK.
 */
async function getWalletProvider() {
    const options = await buildWalletOptions();
    const choice = pickWallet(options);
    if (choice.key === 'walletconnect') return connectWalletConnect();
    if (!choice.provider) throw new Error('NO_WALLET');
    return choice.provider;
}

function authErrorMessage(err) {
    const raw = (err && (err.message || err.reason)) ? String(err.message || err.reason) : '';
    if (!raw || /PICKER_CANCELLED/i.test(raw)) {
        return { title: 'CANCELADO', desc: 'Cancelaste la selección de wallet.' };
    }
    if (raw === 'NO_WALLET' || /no provider|sdk|NO_WALLET/i.test(raw)) {
        return {
            title: 'Sin wallet',
            desc: 'Instalá MetaMask, Coinbase, Rainbow, Trust, Rabby o usá Brave Wallet / WalletConnect. Quedate en Brave/Safari/Chrome; no abras el sitio dentro de la app.'
        };
    }
    if (/EventEmitter2|does not provide an export named/i.test(raw)) {
        return {
            title: 'AUTH_FAILED',
            desc: 'Error de carga de wallet (SDK). Elegí una wallet del listado o WalletConnect.'
        };
    }
    if (/rejected|denied|cancel|ACTION_REJECTED|4001|user rejected/i.test(raw)) {
        return {
            title: 'FIRMA RECHAZADA',
            desc: 'Rechazaste la conexión o la firma en la wallet. Volvé a intentar y aprobá el mensaje.'
        };
    }
    return { title: 'AUTH_FAILED', desc: raw || 'No se pudo autenticar.' };
}

async function handleLogin() {
    UI.reset();
    UI.updateStatus("Buscando wallets...");

    try {
        if (typeof ethers === 'undefined') {
            throw new Error('Wallet library failed to load.');
        }

        const rawProvider = await getWalletProvider();
        if (!rawProvider) throw new Error('NO_WALLET');

        const provider = new ethers.providers.Web3Provider(rawProvider, 'any');

        UI.updateStatus("Approve and sign in your wallet, then return to this browser (Brave/Safari/Chrome).");
        const accounts = await provider.send("eth_requestAccounts", []);
        const wallet = accounts[0];

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
        const mapped = authErrorMessage(err);
        UI.showError(mapped.title, mapped.desc);
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