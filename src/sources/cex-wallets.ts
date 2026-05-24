// src/sources/cex-wallets.ts
//
// DIY DB of well-known CEX hot wallets on Ethereum mainnet (publicly known).
// Operators should refresh this list quarterly as exchanges rotate wallets.

export interface KnownWallet {
  address: string;
  exchange: 'Binance' | 'Coinbase' | 'OKX' | 'Kraken' | 'Bitfinex' | 'Bybit' | 'KuCoin' | 'Wintermute' | 'CumberlandDRW' | 'JaneStreet' | 'Other';
  type: 'hot' | 'cold' | 'mm' | 'fund';
  label: string;
}

export const KNOWN_WALLETS: KnownWallet[] = [
  // Binance
  { address: '0x28C6c06298d514Db089934071355E5743bf21d60', exchange: 'Binance', type: 'hot', label: 'Binance 14' },
  { address: '0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549', exchange: 'Binance', type: 'hot', label: 'Binance 15' },
  { address: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', exchange: 'Binance', type: 'hot', label: 'Binance 16' },
  { address: '0x56Eddb7aa87536c09CCc2793473599fD21A8b17F', exchange: 'Binance', type: 'hot', label: 'Binance 17' },
  { address: '0x9696f59E4d72E237BE84fFD425DCaD154Bf96976', exchange: 'Binance', type: 'hot', label: 'Binance 18' },
  // Coinbase
  { address: '0x71660c4005BA85c37ccec55d0C4493E66Fe775d3', exchange: 'Coinbase', type: 'hot', label: 'Coinbase 1' },
  { address: '0x503828976D22510aad0201ac7EC88293211D23Da', exchange: 'Coinbase', type: 'hot', label: 'Coinbase 2' },
  { address: '0xddfAbCdc4D8FfC6d5beaf154f18B778f892A0740', exchange: 'Coinbase', type: 'hot', label: 'Coinbase 3' },
  // OKX
  { address: '0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b', exchange: 'OKX', type: 'hot', label: 'OKX 1' },
  { address: '0x236F9F97e0E62388479bf9E5BA4889e46B0273C3', exchange: 'OKX', type: 'hot', label: 'OKX 2' },
  // Kraken
  { address: '0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2', exchange: 'Kraken', type: 'hot', label: 'Kraken 1' },
  { address: '0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0', exchange: 'Kraken', type: 'hot', label: 'Kraken 2' },
  // Bitfinex
  { address: '0x1151314c646Ce4E0eFD76d1aF4760aE66a9Fe30F', exchange: 'Bitfinex', type: 'hot', label: 'Bitfinex 5' },
  // Market makers / funds (best-effort public knowledge)
  { address: '0x4f3a120E72C76c22ae802D129F599BFDbc31cb81', exchange: 'Wintermute', type: 'mm', label: 'Wintermute' },
  { address: '0xe93381fB4c4F14bDa253907b18faD305D799241a', exchange: 'CumberlandDRW', type: 'mm', label: 'Cumberland DRW' },
  { address: '0xD533a949740bb3306d119CC777fa900bA034cd52', exchange: 'JaneStreet', type: 'fund', label: 'Jane Street EOA (suspected)' },
];

export function getKnownWalletByAddress(address: string): KnownWallet | null {
  const a = address.toLowerCase();
  return KNOWN_WALLETS.find((w) => w.address.toLowerCase() === a) ?? null;
}

export function getCexHotWallets(): KnownWallet[] {
  return KNOWN_WALLETS.filter((w) => w.type === 'hot');
}
