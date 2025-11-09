# Escrow Contract - Quick Start Guide

## 🚀 Quick Start

### 1. Build the Contract
```bash
npm run build
```

### 2. Run Tests
```bash
# Unit tests
npm test

# E2E tests (requires localnet)
algokit localnet start
npm test -- contract.e2e.spec.ts
```

### 3. Deploy to TestNet
```bash
# Set up .env file with your testnet credentials
npm run deploy escrow
```

## 📋 Pre-Deployment Checklist

- [ ] Contract compiles (`npm run build`)
- [ ] Tests pass (`npm test`)
- [ ] Environment variables configured (`.env` file)
- [ ] Test accounts funded with ALGO
- [ ] USDC asset ID identified (TestNet: 10458941)
- [ ] Oracle account set up
- [ ] Arbitration address determined

## 🔧 Environment Setup

Create a `.env` file in the project root:

```env
DEPLOYER_MNEMONIC=your_testnet_mnemonic_here
ALGOD_SERVER=https://testnet-api.algonode.cloud
ALGOD_TOKEN=
ALGOD_PORT=443
```

## 📝 Key Files

- `contract.algo.ts` - Main contract implementation
- `contract.algo.spec.ts` - Unit tests
- `contract.e2e.spec.ts` - End-to-end tests
- `deploy-config.ts` - Deployment script
- `README.md` - Detailed documentation

## 🎯 Next Steps After Deployment

1. **Opt into USDC**: Contract must opt into the asset before receiving it
2. **Test createEscrow**: Create your first escrow with atomic transaction group
3. **Test releaseFunds**: Verify oracle can release funds to buyer
4. **Test dispute flow**: Verify dispute and arbitration routing
5. **Test refund**: Verify timeout and refund functionality

## 📚 Full Documentation

See `README.md` for comprehensive documentation including:
- Detailed deployment instructions
- Complete testing guide
- API usage examples
- Troubleshooting tips

## 🆘 Need Help?

1. Check the main `README.md` file
2. Review AlgoKit documentation
3. Check Algorand Developer Portal
4. Review contract code comments

