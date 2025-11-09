import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { EscrowContractFactory } from '../artifacts/escrow/EscrowContractClient'

/**
 * Deploy the EscrowContract to the Algorand network
 * 
 * Environment variables needed:
 * - DEPLOYER_MNEMONIC or DEPLOYER_SK: The mnemonic or secret key of the deployer account
 * - ALGOD_SERVER: Algod server URL (defaults to localnet)
 * - ALGOD_TOKEN: Algod API token
 * - ALGOD_PORT: Algod port
 * - INDEXER_SERVER: Indexer server URL (optional)
 * - INDEXER_TOKEN: Indexer API token (optional)
 * - INDEXER_PORT: Indexer port (optional)
 */
export async function deploy() {
  console.log('=== Deploying EscrowContract ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  console.log(`Deployer address: ${deployer.addr}`)

  const factory = algorand.client.getTypedAppFactory(EscrowContractFactory, {
    defaultSender: deployer.addr,
  })

  const { appClient, result } = await factory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  console.log(`Deployed EscrowContract with app ID: ${appClient.appClient.appId}`)
  console.log(`App address: ${appClient.appClient.appAddress}`)

  // Fund the app account if it was just created
  if (['create', 'replace'].includes(result.operationPerformed)) {
    const minBalance = await algorand.client.algod.accountInformation(appClient.appClient.appAddress).do()
    const currentBalance = minBalance.amount || 0
    
    // Fund with enough ALGO for minimum balance + transaction fees
    // Minimum balance for app account depends on global state usage
    const fundingAmount = (1).algo() // 1 ALGO
    
    if (currentBalance < fundingAmount.microAlgos) {
      console.log(`Funding app account with ${fundingAmount.algos} ALGO...`)
      await algorand.send.payment({
        amount: fundingAmount,
        sender: deployer.addr,
        receiver: appClient.appClient.appAddress,
      })
      console.log('App account funded successfully')
    } else {
      console.log('App account already has sufficient balance')
    }
  }

  console.log('\n=== Deployment Summary ===')
  console.log(`App ID: ${appClient.appClient.appId}`)
  console.log(`App Address: ${appClient.appClient.appAddress}`)
  console.log(`Network: Deployed successfully`)
  console.log('\nNext steps:')
  console.log('1. Opt the contract into the USDC asset (or your target ASA)')
  console.log('2. Set up oracle account and arbitration address')
  console.log('3. Test the contract with createEscrow, releaseFunds, etc.')
  console.log('\nTo opt into an asset, call:')
  console.log(`  client.send.optInAsset({ args: { assetId: YOUR_ASSET_ID } })`)
  
  return { appClient, result }
}

