import {
  Account, Asset,
  Contract,
  Global,
  GlobalState,
  OnCompleteAction,
  TransactionType,
  Txn,
  assert,
  gtxn, itxn,
  uint64
} from '@algorandfoundation/algorand-typescript';

// Type Aliases
type AssetID = uint64;
type TradeStatus = 'PENDING_LOCK' | 'LOCKED_AWAITING_FIAT' | 'COMPLETE' | 'DISPUTE' | 'ARBITRATION';

export class EscrowContract extends Contract {
  // Global State Keys
  seller = GlobalState<Account>();
  buyer = GlobalState<Account>();
  tradeId = GlobalState<string>();
  usdcAssetId = GlobalState<uint64>();
  usdcAmount = GlobalState<uint64>();
  kesExpected = GlobalState<uint64>();
  createdAt = GlobalState<uint64>();
  timeout = GlobalState<uint64>(); // In seconds
  status = GlobalState<string>(); // Trade status
  arbitrationAddress = GlobalState<Account>();
  
  // The address of the PesaFlex backend that confirms M-Pesa payments
  oracleAddress = GlobalState<Account>();

  /**
   * Opt into an asset (ASA) - must be called before createEscrow
   */
  optInAsset(assetId: AssetID): void {
    // Contract opts into the asset by sending 0 amount to itself
    itxn.assetTransfer({
      xferAsset: Asset(assetId),
      assetAmount: 0,
      assetReceiver: Global.currentApplicationAddress,
    }).submit();
  }

  /**
   * 1. Initialize escrow with trade parameters and lock USDC.
   * This method expects an atomic group of 2 transactions:
   * - Txn 0: Asset Transfer from seller to contract
   * - Txn 1: Application Call (this method)
   */
  createEscrow(
    seller: Account,
    buyer: Account,
    tradeId: string,
    usdcAssetId: AssetID,
    usdcAmount: uint64,
    kesExpected: uint64,
    timeoutMinutes: uint64,
    oracleAddr: Account,
    arbitrationAddr: Account
  ): void {
    // 1. Validate the Atomic Group
    assert(Global.groupSize === 2, 'Must be an atomic group of 2 transactions.');
    
    // Get the asset transfer transaction (Txn 0)
    const depositTxn = gtxn.AssetTransferTxn(0);

    // Check the deposit transaction (Txn 0) details
    assert(depositTxn.type === TransactionType.AssetTransfer, 'Txn 0 must be an ASA Transfer.');
    assert(depositTxn.sender === seller, 'Seller must be the sender of the deposit.');
    assert(depositTxn.assetReceiver === Global.currentApplicationAddress, 'Deposit must go to the Escrow App.');
    assert(depositTxn.xferAsset.id === usdcAssetId, 'Wrong ASA ID deposited.');
    assert(depositTxn.assetAmount === usdcAmount, 'Incorrect ASA amount deposited.');
    
    // 2. Security Checks on current transaction (Txn 1 - Application Call)
    assert(Txn.onCompletion === OnCompleteAction.NoOp, 'Must be a NoOp call.');
    assert(Txn.rekeyTo === Global.zeroAddress, 'RekeyTo must be zero.');

    // 3. Set Global State
    this.seller.value = seller;
    this.buyer.value = buyer;
    this.tradeId.value = tradeId;
    this.usdcAssetId.value = usdcAssetId;
    this.usdcAmount.value = usdcAmount;
    this.kesExpected.value = kesExpected;
    this.createdAt.value = Global.latestTimestamp;
    this.timeout.value = timeoutMinutes * 60; 
    this.oracleAddress.value = oracleAddr;
    this.arbitrationAddress.value = arbitrationAddr;
    this.status.value = 'LOCKED_AWAITING_FIAT';
  }
  
  /**
   * 2. Release funds to buyer (called by oracle after M-Pesa confirmation)
   */
  releaseFunds(): void {
    // Validate caller is oracle
    assert(Txn.sender === this.oracleAddress.value, 'Only oracle can release funds.');
    
    // Validate trade status
    assert(this.status.value === 'LOCKED_AWAITING_FIAT', 'Trade must be in LOCKED_AWAITING_FIAT status.');
    
    // Transfer ASA to buyer
    itxn.assetTransfer({
      xferAsset: Asset(this.usdcAssetId.value),
      assetAmount: this.usdcAmount.value,
      assetReceiver: this.buyer.value,
    }).submit();
    
    // Update status
    this.status.value = 'COMPLETE';
  }
  
  /**
   * 3. Trigger dispute (can be called by seller, buyer, or oracle)
   */
  triggerDispute(): void {
    // Validate caller is one of the parties or oracle
    const isSeller = Txn.sender === this.seller.value;
    const isBuyer = Txn.sender === this.buyer.value;
    const isOracle = Txn.sender === this.oracleAddress.value;
    assert(isSeller || isBuyer || isOracle, 'Only seller, buyer, or oracle can trigger dispute.');
    
    // Validate trade status allows dispute
    assert(this.status.value === 'LOCKED_AWAITING_FIAT', 'Trade must be in LOCKED_AWAITING_FIAT status to dispute.');
    
    // Update status to DISPUTE
    this.status.value = 'DISPUTE';
  }
  
  /**
   * 4. Route to arbitration (called by oracle)
   */
  routeToArbitration(): void {
    // Validate caller is oracle
    assert(Txn.sender === this.oracleAddress.value, 'Only oracle can route to arbitration.');
    
    // Validate status is DISPUTE
    assert(this.status.value === 'DISPUTE', 'Escrow must be in DISPUTE status.');
    
    // Transfer ASA to arbitration address
    itxn.assetTransfer({
      xferAsset: Asset(this.usdcAssetId.value),
      assetAmount: this.usdcAmount.value,
      assetReceiver: this.arbitrationAddress.value,
    }).submit();
    
    // Update status
    this.status.value = 'ARBITRATION';
  }
  
  /**
   * 5. Refund to seller (if timeout has passed)
   */
  refundToSeller(): void {
    // Validate caller is seller or oracle
    const isSeller = Txn.sender === this.seller.value;
    const isOracle = Txn.sender === this.oracleAddress.value;
    assert(isSeller || isOracle, 'Only seller or oracle can request refund.');
    
    // Validate trade status
    assert(this.status.value === 'LOCKED_AWAITING_FIAT', 'Trade must be in LOCKED_AWAITING_FIAT status.');
    
    // Validate timeout has passed
    const currentTime: uint64 = Global.latestTimestamp;
    const timeoutTime: uint64 = this.createdAt.value + this.timeout.value;
    assert(currentTime >= timeoutTime, 'Timeout has not passed yet.');
    
    // Transfer ASA back to seller
    itxn.assetTransfer({
      xferAsset: Asset(this.usdcAssetId.value),
      assetAmount: this.usdcAmount.value,
      assetReceiver: this.seller.value,
    }).submit();
    
    // Update status (could use a REFUNDED status, but for now we'll use a generic status)
    this.status.value = 'COMPLETE'; // Or add 'REFUNDED' to TradeStatus type
  }
  
  /**
   * Helper method to get trade status
   */
  getStatus(): string {
    return this.status.value;
  }
  
  /**
   * Helper method to check if timeout has passed
   */
  isTimeout(): boolean {
    const currentTime: uint64 = Global.latestTimestamp;
    const timeoutTime: uint64 = this.createdAt.value + this.timeout.value;
    return currentTime >= timeoutTime;
  }
}