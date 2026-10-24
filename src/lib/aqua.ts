export type ExitChain = 'ethereum' | 'base' | 'arbitrum';
export type ExitRoute = { supported: boolean; chain: ExitChain; reason: string };
/** Fail closed: no endpoints, asset support, bridge, or privacy guarantees are assumed. */
export function getAquaRoute(chain: ExitChain): ExitRoute {
  return { supported: false, chain, reason: 'AQUA0 routing is not connected. Asset support, liquidity, settlement and privacy boundaries must be validated with the AQUA0 team.' };
}
