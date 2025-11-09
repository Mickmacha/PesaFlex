# Escrow Contract - Testing and Deployment Guide

This guide covers the next steps for testing and deploying the Algorand Escrow Contract.

## Prerequisites

1. **AlgoKit installed**: Ensure AlgoKit CLI is installed
2. **Node.js**: Version >= 22.0
3. **Test Accounts**: You'll need test accounts for:
   - Seller
   - Buyer
   - Oracle (PesaFlex backend)
   - Arbitration address

## Step 1: Build the Contract

First, compile the contract and generate the TypeScript client:

```bash
npm run build
```

This will:
- Compile the TypeScript contract to TEAL
- Generate the TypeScript client in `artifacts/escrow/EscrowContractClient.ts`
- Create ARC-32 and ARC-56 application specification files

## Step 2: Run Unit Tests

Run the unit tests to verify contract logic:

```bash
npm test
```

Or run tests in watch mode:

```bash
npm run test:watch
```

The unit tests verify:
- Status retrieval
- Timeout checking
- State transitions

## Step 3: Run End-to-End Tests

E2E tests require a running Algorand node (localnet, testnet, or mainnet):

### Option A: Use Localnet (Recommended for Development)

1. Start AlgoKit localnet:
```bash
algokit localnet start
```

2. Run E2E tests:
```bash
npm test -- contract.e2e.spec.ts
```

### Option B: Use TestNet

1. Configure environment variables (create `.env` file):
```env
DEPLOYER_MNEMONIC=your_testnet_mnemonic_here
ALGOD_SERVER=https://testnet-api.algonode.cloud
ALGOD_TOKEN=
ALGOD_PORT=443
```

2. Run E2E tests:
```bash
npm test -- contract.e2e.spec.ts
```

## Step 4: Deploy to TestNet

### 4.1 Set Up Environment Variables

Create a `.env` file in the project root:

```env
DEPLOYER_MNEMONIC=your_testnet_deployer_mnemonic
ALGOD_SERVER=https://testnet-api.algonode.cloud
ALGOD_TOKEN=
ALGOD_PORT=443
INDEXER_SERVER=https://testnet-idx.algonode.cloud
INDEXER_TOKEN=
INDEXER_PORT=443
```

### 4.2 Deploy the Contract

```bash
npm run deploy escrow
```

Or deploy all contracts:
```bash
npm run deploy
```

The deployment script will:
- Deploy the contract to TestNet
- Fund the app account with ALGO
- Display the app ID and address

### 4.3 Verify Deployment

After deployment, verify the contract:

```bash
# Check app info
goal app info --app-id <APP_ID> -d ~/.algorand/testnet

# Or use AlgoKit
algokit goal app info --app-id <APP_ID>
```

## Step 5: Post-Deployment Setup

### 5.1 Opt Into Asset (USDC)

The contract needs to opt into the USDC asset before it can receive it:

```typescript
import { EscrowContractFactory } from './artifacts/escrow/EscrowContractClient'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'

const algorand = AlgorandClient.fromEnvironment()
const deployer = await algorand.account.fromEnvironment('DEPLOYER')

const factory = algorand.client.getTypedAppFactory(EscrowContractFactory, {
  defaultSender: deployer.addr,
})

const { appClient } = await factory.get(appId) // Use your deployed app ID

// Opt into USDC (TestNet USDC ID: 10458941)
await appClient.send.optInAsset({
  args: { assetId: 10458941n },
})
```

### 5.2 Initialize Contract State

Before creating escrows, you need to set up:
- Oracle address (PesaFlex backend)
- Arbitration address
- Verify contract has opted into USDC

## Step 6: Testing the Contract

### 6.1 Create an Escrow

```typescript
const seller = Account('SELLER_ADDRESS')
const buyer = Account('BUYER_ADDRESS')
const oracle = Account('ORACLE_ADDRESS')
const arbitration = Account('ARBITRATION_ADDRESS')

// Create atomic group: Asset transfer + App call
const group = algorand.newGroup()

// Txn 0: Seller transfers USDC to contract
group.addAssetTransfer({
  sender: seller.addr,
  receiver: appClient.appAddress,
  assetId: 10458941n, // USDC
  amount: 1000000n, // 1 USDC (6 decimals)
})

// Txn 1: App call to createEscrow
group.addAppCall({
  appId: appClient.appId,
  method: 'createEscrow',
  methodArgs: {
    seller,
    buyer,
    tradeId: 'trade-123',
    usdcAssetId: 10458941n,
    usdcAmount: 1000000n,
    kesExpected: 150000n, // KES amount expected
    timeoutMinutes: 60n,
    oracleAddr: oracle,
    arbitrationAddr: arbitration,
  },
})

await group.execute()
```

### 6.2 Release Funds (Oracle)

```typescript
const oracleSigner = await algorand.account.fromMnemonic('ORACLE_MNEMONIC')

await appClient.send.releaseFunds({
  sender: oracleSigner.addr,
  signer: oracleSigner.signer,
})
```

### 6.3 Trigger Dispute

```typescript
// Can be called by seller, buyer, or oracle
await appClient.send.triggerDispute({
  sender: seller.addr,
  signer: seller.signer,
})
```

### 6.4 Route to Arbitration

```typescript
await appClient.send.routeToArbitration({
  sender: oracleSigner.addr,
  signer: oracleSigner.signer,
})
```

### 6.5 Refund to Seller

```typescript
// After timeout has passed
await appClient.send.refundToSeller({
  sender: seller.addr,
  signer: seller.signer,
})
```

## Step 7: Deploy to MainNet

⚠️ **Warning**: Only deploy to mainnet after thorough testing on testnet!

1. Update `.env` with mainnet credentials:
```env
DEPLOYER_MNEMONIC=your_mainnet_mnemonic
ALGOD_SERVER=https://mainnet-api.algonode.cloud
ALGOD_TOKEN=
ALGOD_PORT=443
```

2. Deploy:
```bash
npm run deploy escrow
```

3. Verify deployment on AlgoExplorer or other block explorers

## Testing Checklist

- [ ] Contract compiles without errors
- [ ] Unit tests pass
- [ ] E2E tests pass on localnet
- [ ] Contract deploys to testnet
- [ ] Contract opts into USDC asset
- [ ] Create escrow works (atomic group)
- [ ] Release funds works (oracle only)
- [ ] Trigger dispute works (seller/buyer/oracle)
- [ ] Route to arbitration works (oracle only)
- [ ] Refund works after timeout
- [ ] Access control works (unauthorized calls fail)
- [ ] State transitions are correct
- [ ] Timeout validation works

## Troubleshooting

### Contract won't compile
- Check for TypeScript errors: `npm run check-types`
- Ensure all imports are correct
- Verify Algorand TypeScript version compatibility

### Deployment fails
- Verify environment variables are set
- Check account has sufficient ALGO
- Ensure network connectivity

### Opt-in fails
- Verify asset ID is correct
- Check contract account has ALGO for opt-in fee
- Ensure asset exists on the network

### Atomic group fails
- Verify both transactions are in the same group
- Check group ID matches
- Ensure all accounts have sufficient balance

## Next Steps

1. **Integration Testing**: Test with your frontend/backend
2. **Security Audit**: Consider a professional security audit
3. **Documentation**: Document API for your team
4. **Monitoring**: Set up monitoring for contract events
5. **Upgrade Planning**: Plan for contract upgrades if needed

## Resources

- [AlgoKit Documentation](https://dev.algorand.co/algokit/)
- [Algorand TypeScript Documentation](https://dev.algorand.co/algokit/languages/typescript/overview/)
- [Algorand Developer Portal](https://developer.algorand.org/)
- [AlgoExplorer](https://www.algoexplorer.io/) - Block explorer
- [AlgoKit Utils](https://github.com/algorandfoundation/algokit-utils-ts) - TypeScript utilities

## Support

For issues or questions:
1. Check the Algorand Developer Portal
2. Join the Algorand Discord
3. Review AlgoKit GitHub issues
4. Contact your development team

