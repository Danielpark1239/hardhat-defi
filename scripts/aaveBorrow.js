const { getNamedAccounts, ethers } = require("hardhat")
const { getWeth, AMOUNT } = require("../scripts/getWeth")
const { networkConfig } = require("../helper-hardhat.config")

async function main() {
    await getWeth()
    const { deployer } = await getNamedAccounts()

    // Deposit collateral
    const lendingPool = await getLendingPool(deployer)
    const wethTokenAddress = networkConfig[31337]["wethToken"]
    await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
    console.log("Depositing...")
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("Deposited!")

    // Borrow DAI
    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(
        lendingPool,
        deployer,
    )
    const daiPrice = await getDaiPrice()
    const availableBorrowsDAI =
        availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber())
    console.log(`You can borrow ${availableBorrowsDAI} DAI`)
    const availableBorrowsWEI = ethers.utils.parseEther(
        availableBorrowsDAI.toString(),
    )
    console.log(`You can borrow ${availableBorrowsWEI} WEI`)
    console.log("Borrowing...")
    await borrowDai(
        networkConfig[31337]["daiToken"],
        lendingPool,
        availableBorrowsWEI,
        deployer,
    )
    await getBorrowUserData(lendingPool, deployer)

    // Repay DAI (but not interest)
    console.log("Repaying...")
    await repay(
        availableBorrowsWEI,
        networkConfig[31337]["daiToken"],
        lendingPool,
        deployer,
    )
    await getBorrowUserData(lendingPool, deployer)
}

async function repay(amount, daiAddress, lendingPool, account) {
    await approveErc20(daiAddress, lendingPool.address, amount, account)
    const repayTx = await lendingPool.repay(daiAddress, amount, 1, account)
    await repayTx.wait(1)
}

async function borrowDai(
    daiAddress,
    lendingPool,
    availableBorrowsWEI,
    account,
) {
    const borrowTx = await lendingPool.borrow(
        daiAddress,
        availableBorrowsWEI,
        1,
        0,
        account,
    )
    await borrowTx.wait(1)
    console.log(`You've borrowed ${availableBorrowsWEI} DAI(in WEI units)`)
}

async function getDaiPrice() {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        networkConfig[31337]["daiEthPriceFeed"],
    )
    const price = (await daiEthPriceFeed.latestRoundData())[1]
    console.log(`The DAI/ETH price is: ${price.toString()}`)
    return price
}

async function getBorrowUserData(lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPool.getUserAccountData(account)
    console.log(`You have ${totalCollateralETH} worth of ETH deposited`)
    console.log(`You have ${totalDebtETH} worth of ETH borrowed`)
    console.log(`You can borrow ${availableBorrowsETH} worth of ETH`)
    return { availableBorrowsETH, totalDebtETH }
}

async function getLendingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        networkConfig[31337]["lendingPoolAddressesProvider"],
        account,
    )

    const lendingPoolAddress =
        await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt(
        "ILendingPool",
        lendingPoolAddress,
        account,
    )
    return lendingPool
}

async function approveErc20(
    erc20Address,
    spenderAddress,
    amountToSpend,
    account,
) {
    const erc20Token = await ethers.getContractAt(
        "IERC20",
        erc20Address,
        account,
    )
    const tx = await erc20Token.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log(`Approved~!`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })
