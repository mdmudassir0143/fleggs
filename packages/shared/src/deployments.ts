// Written by scripts/publish.sh — Sui testnet.
export const TESTNET = {
  packageId: '0x670212e326f54f24f2676a3c5d9252cad04ddcd8a422cb4eac42f15392923fa8',
  latestPackageId: '0xf9b1b91e4011f4c927305a64800a3d9ccbecaebe176370f16f0cbc9d86b7297e',
  /** Package that introduced flurry::training / flurry::daily (their types live here). */
  trainingTypesId: '0xb9835eb498f722dafd4a6107340d9778457dd8b0f518f97360d4c98211de9e26',
  /** Package that introduced flurry::shop / flurry::merge (their types live here). */
  shopTypesId: '0xc9d9012a79f8ec587ddc4664ccf56c4210badb1b3fd9f538a730e9f13d0e2e0e',
  /** Package that introduced the training play limits (PlaysKey / ExtraPlayPriceKey live here). */
  playsTypesId: '0x2393c6536d8afac800e254769f1b0f94f5d2282be2329d2bc533619cac21b925',
  /** Package that introduced Earn (treasury buyback, Market, Lodge); their types live here. */
  earnTypesId: '0xd4967bb0d659ca34667cd0629e807188dcc9819b811e290385bff80dca178f74',
  /** Package that introduced Lodge accounts/totals (AccountKey, TotalsKey) and claim_all. */
  lodgeV2TypesId: '0x5eec5927299ab59f45b098343d1aca747a6717dff9b42339d473dbdb07c7ac80',
  /** Package that introduced test-account flags (config::TestKey). */
  testFlagTypesId: '0xf9b1b91e4011f4c927305a64800a3d9ccbecaebe176370f16f0cbc9d86b7297e',
  /** Package that introduced admin gifts (SnowflakeGift). */
  adminTypesId: '0xb754dec9344f059f421918c6cd55012af806c74919170dd4bfe553668bdd15d2',
  /** Shared player market. */
  marketId: '0x86d0fef64dabb26a46409b3793180854585ede70c0af5e125790b5a1b04d7c21',
  /** Shared Lodge (staking). */
  lodgeId: '0x446432a6df264f802e4c2a7c42f625381285a17bc1b1bc7dccea68347ca646db',
  /** The shared egg shop (prices + treasury). */
  shopId: '0x075ea9f122efcb5ff9fde9a8d73c3dab8ec4d3f36b671035d71f312bfacf324e',
  /** Package version that introduced flurry::identity (its types live here). */
  identityTypesId: '0xe6dacc2826238ecb701e0cbb684d05550f36c83f0e980cfc4cb998e4bf9675d1',
  gameConfigId: '0x6877bf79ee84e39962bf302c67ed6a40d14140a2e0cf6c63b0760f165068d61b',
  registryId: '0xf7740266022cd4778c117c0c9940dbb1ef631d740250f67def0cf7b0e0230912',
  adminCapId: '0x2dc79cb689569da285f7daf427960b08ec23332399474d36b8e614754ed58639',
  /** Earlier upgrade versions still accepted by the sponsor (old tabs). */
  previousPackageIds: ['0x7b9a972cf157ddba6a66a70a43e49eaa12fa4ccd8237474b573c11d4cc1a08a0', '0xe6dacc2826238ecb701e0cbb684d05550f36c83f0e980cfc4cb998e4bf9675d1', '0xb9835eb498f722dafd4a6107340d9778457dd8b0f518f97360d4c98211de9e26', '0xc9d9012a79f8ec587ddc4664ccf56c4210badb1b3fd9f538a730e9f13d0e2e0e', '0x2393c6536d8afac800e254769f1b0f94f5d2282be2329d2bc533619cac21b925', '0xd4967bb0d659ca34667cd0629e807188dcc9819b811e290385bff80dca178f74', '0x29c80ebafafbe9710b4071ce5c3c7bf806e45c8504ad92e41d2517fadf0c393b', '0x5eec5927299ab59f45b098343d1aca747a6717dff9b42339d473dbdb07c7ac80', '0x586e491d605ce91fb5a3529b8774d9308c53e53092e4dc5acfd2b35de0ccab67', '0xb754dec9344f059f421918c6cd55012af806c74919170dd4bfe553668bdd15d2'] as string[],
  upgradeCapId: '0x966c6050db44b69e0b87db986d0c7a98b60223bd279b4c1226592c71f7d09424',
} as const;
