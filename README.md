# FHEVM Tutorial: Building a Confidential Rock-Paper-Scissors Game with Zama FHEVM
In the world of blockchain, privacy and fairness are paramount. Traditional smart contracts execute logic on public data, making it impossible to build games of chance or strategy where information must be kept secret. Imagine playing Rock-Paper-Scissors on-chain; if your move is public, the contract or other players could cheat. 

This is where Fully Homomorphic Encryption (FHE) changes the game. With Zama's fhevm, we can build smart contracts that operate on encrypted data. This means players can submit encrypted moves, and the contract can determine the winner without ever decrypting the inputs. 

In this tutorial, we will build FHE-RPS, a decentralized and confidential Rock-Paper-Scissors game. 

**What You Will Learn**
+ How to write a Solidity smart contract that uses FHEVM for confidential game logic.

+ How to store and update encrypted player statistics (wins, losses, ties).

+ How to maintain a confidential leaderboard of the top player.

+ How to interact with the FHEVM contract from a testing environment to play the game with encrypted inputs.

+ How to deploy the contract on the Sepolia testnet.

+ How to develop a frontend to interact with the deployed contract.

**Prerequisites**
+ A basic understanding of Solidity, smart contracts, and Hardhat.

+ Familiarity with JavaScript/TypeScript.

## Table of Contents
1. [Introduction to FHE-RPS](#introduction-to-fhe-rps)
2. [Set Up the Project](#set-up-the-project)
3. [Implement the Smart Contract](#implement-the-smart-contract)
4. [Deploy the Contract](#deploy-the-contract)
5. [Build the Frontend](#build-the-frontend)
6. [Conclusion](#conclusion)

## Introduction to FHE-RPS

**The Rock-Paper-Scissors Game**

Rock-Paper-Scissors is a simple two-player game. Players simultaneously choose one move from the three options: Rock, Paper, or Scissors.
The outcome of the game is determined by a simple set of rules:
+ Rock crushes Scissors (Rock wins)

+ Scissors cuts Paper (Scissors wins)

+ Paper covers Rock (Paper wins)

+ If both players choose the same move, it's a tie

The simplicity of Rock-Paper-Scissors hinges on one key element: **simultaneous** and **secret action**. Both players must reveal their choices at the exact same moment. If one player knows the other's move in advance, they can always pick the winning move, making the game unfair.

This poses a problem for traditional smart contracts on public blockchains like Ethereum. All data, including transaction inputs (i.e., the player's move), is **public**. This means one player can see other player's move and cheat the game.

Here's where FHE comes into play. FHE provides a way to compute the game result with encrypted data. That is to say, each player can submit an encrypted move to the smart contract. The smart contract can directly compute the game result without ever knowing what the moves are. Of course, the computed result is still encrypted, as this is required by the underlying cryptographic algorithms. Because each player submits encrypted move, no player can know what the other player's move is.


**The FHE-RPS Game**

In this tutorial, we will build a decentralized and confidential Rock-Paper-Scissors game dApp using FHEVM. For simplicity, we will assume that the game is played between one player and the smart contract. The game logic is as follows:

1. The smart contract will pre-generate a move randomly and store it on chain. This pre-generated on-chain move will be updated after each play

2. Everyone can submit their encrypted move to the smart contract to play and the smart contract will compare their move with the smart contract's on-chain move and determine the winner

3. For each play, the smart contract will update the player's encrypted statistics (wins, losses, ties), and the player can decrypt their own statistics to see their progress. However, no one can see the other player's statistics.

4. The smart contract will also maintain a encrypted leaderboard of the top player (the player with the most wins). Everyone can decrypt the leaderboard to see who is the top player.

In the next section, we will prepare the develop environment and setup the project. Then we will walk through the process of writing the FHE-RPS smart contract, testing it and deploying it on the Sepolia testnet. In the final section, we will build a frontend to interact with the deployed contract.

Let's get started!🚀

## Set Up the Project
In this project, we will use Hardhat, which is a popular development environment for Ethereum smart contracts. Hardhat provides a variety of features, including a local Ethereum network, a testing framework, and a deployment tool.

1. install the nvm package manager:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

2. install node (22.x):
```bash
nvm install 22
```

3. clone the hardhat template repo and install dependencies:
```bash
git clone https://github.com/zama-ai/fhevm-hardhat-template
cd fhevm-hardhat-template 
git checkout dbc36dbce90b82fe82c3f85f9639684c710d282a
npm install --force
```

4. clean the hardhat template files:
```bash
rm -f contracts/* deploy/* test/*
```

5. setup the hardhat environment variables (optional, required for deploying to the Sepolia testnet):
```bash
npx hardhat vars set MNEMONIC <your mnemonic>
```

Now, we are ready to start implementing our smart contract.

## Implement the Smart Contract

### Basic Structure
First, we start by creating a new contract file named `FHERPS.sol` in the `contracts` directory.

Here is the basic structure of our contract:

```solidity {.line-numbers}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {FHE, euint8, euint64, externalEuint8, ebool, eaddress} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract FHERPS is SepoliaConfig {
    /**
     * @notice 0 = Rock, 1 = Paper, 2 = Scissors
     */
    euint8 private _rps;

    mapping(address account => euint64 winAmount) private _win_map;
    mapping(address account => euint64 lossAmount) private _loss_map;
    mapping(address account => euint64 tieAmount) private _tie_map;

    constructor() {
        euint64 r64 = FHE.randEuint64();
        _rps = FHE.asEuint8(FHE.rem(r64, 3));
        FHE.allowThis(_rps);
    }

    function play(externalEuint8 inputEuint8, bytes calldata inputProof) external {
    }

    function getWinLossTieStats(address user) external view returns (euint64, euint64, euint64) {
        return (_win_map[user], _loss_map[user], _tie_map[user]);
    }
}
```

Let's break down the contract:
1. The `FHERPS` contract inherits from the `SepoliaConfig` contract, which is a FHEVM configuration contract for the Sepolia testnet provided by Zama.
2. We define a `_rps` variable of type `euint8`, which will store the pre-generated move. The `euint8` type is a FHEVM type that represents an encrypted unsigned integer of 8 bits, i.e., the encrypted version of `uint8`. Throughout the game, we will use 0, 1, 2 to represent the Rock, Paper, Scissors moves.
3. We define three mappings, `_win_map`, `_loss_map`, and `_tie_map`, which will store the user's win, loss, and tie amounts respectively. The `euint64` represents a encrypted type of `uint64`.
4. In the constructor, we generate a encrypted random number using `FHE.randEuint64()` and mod it by 3 to get a number between 0 and 2. Then we store the encrypted result in `_rps`. All the computation are done in encrypted space, so no player can know what the pre-generated move is. 
5. We add `FHE.allowThis(_rps)` to allow the smart contract to access the encrypted value `_rps`. The access-control information is maintained by FHEVM's ACL contract. For a specific encrypted value, only allowed addresses can interact with it (such as computation and decryption).

Let's compile the contract using Hardhat:
```bash
npx hardhat compile
```

Now, we create a test file named `FHERPS.ts` in the `test` directory.  Here is the test file:
```typescript {.line-numbers}
import { FHERPS, FHERPS__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHERPS")) as FHERPS__factory;
  const fheRpsContract = (await factory.deploy()) as FHERPS;
  const fheRpsContractAddress = await fheRpsContract.getAddress();

  return { fheRpsContract, fheRpsContractAddress };
}

describe("FHERps", function () {
  let signers: Signers;
  let fheRpsContract: FHERPS;
  let fheRpsContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async () => {
    ({ fheRpsContract, fheRpsContractAddress } = await deployFixture());
  });

  it("should be deployed", async function () {
    console.log(`FHERps has been deployed at address ${fheRpsContractAddress}`);
    // Test the deployed address is valid
    expect(ethers.isAddress(fheRpsContractAddress)).to.eq(true);
  });
});

```

Run the test to check if the contract can be deployed successfully on the local hardhat network:
```bash
npx hardhat test
```

The test should pass without any errors. Now we can start implementing the core functionality.

### Implement the `Play` Functionality
The `play` function is the core of our FHE-RPS smart contract. It should take user's encryped move as input, and compare it with the pre-generated encrypted move, and update the user's win/loss/tie amount accordingly.

Let's start by parsing user's input:
```solidity {.line-numbers}
...
contract FHERPS is SepoliaConfig {
...
   function play(externalEuint8 inputEuint8, bytes calldata inputProof) external {
      euint8 encryptedEuint8 = FHE.fromExternal(inputEuint8, inputProof);
   }
...
}
```

To ensure the validity of the encrypted input, the user should provide both the encrypted input and a proof bytes array. 
The proof bytes array contains a Zero-Knowledge Proof of Knowledge (ZKPoK) that proves two things:
1. The encrypted input was generated by the function caller (msg.sender)
2. The encrypted input is bound to our contract (address(this)) and can only be processed by it.
We use `FHE.fromExternal()` to verify the ZKPoK and convert the encrypted input into the `euint8` type.

For any two moves `a` and `b`, we can calculate `(3 + a - b) % 3` to determine the result: 0 means tie, 1 means `a` win, and 2 means `a` loss. In the contract, we can compare the user's move with the pre-generated move using FHE `sub`, `add`, `rem` and `eq` functions:

```solidity {.line-numbers}
...
contract FHERPS is SepoliaConfig {
...
   function play(externalEuint8 inputEuint8, bytes calldata inputProof) external {
      euint8 encryptedEuint8 = FHE.fromExternal(inputEuint8, inputProof);
      euint8 play_rps = FHE.rem(encryptedEuint8, 3);

      // calculate (3 + play_rps - _rps) % 3: 0 = tie, 1 = win, 2 = loss
      euint8 result = FHE.rem(FHE.sub(FHE.add(play_rps, 3), _rps), 3);
      ebool win = FHE.eq(result, 1);
      ebool tie = FHE.eq(result, 0);
      ebool loss = FHE.eq(result, 2);

      euint64 win_update = FHE.add(_win_map[msg.sender], FHE.asEuint64(win));
      euint64 tie_update = FHE.add(_tie_map[msg.sender], FHE.asEuint64(tie));
      euint64 loss_update = FHE.add(_loss_map[msg.sender], FHE.asEuint64(loss));

      _win_map[msg.sender] = win_update;
      _tie_map[msg.sender] = tie_update;
      _loss_map[msg.sender] = loss_update;

      FHE.allowThis(win_update);
      FHE.allowThis(loss_update);
      FHE.allowThis(tie_update);

      FHE.allow(win_update, msg.sender);
      FHE.allow(loss_update, msg.sender);
      FHE.allow(tie_update, msg.sender);
   }
...
}
```

Because the result are encrypted, we must implement all branches to update the user's win/loss/tie amount. So in the above code, we use `FHE.eq()` to check if the result is equal to 1, 0 or 2. The result of `FHE.eq()` is also encrypted, we add it to the user's win/loss/tie amount using `FHE.add()`. At the end, we use `FHE.allow()` to allow the user to interact with their own win/loss/tie amount.

Let's update `FHERPS.ts` to test the `play` function:
```typescript {.line-numbers}
import { FHERPS, FHERPS__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHERPS")) as FHERPS__factory;
  const fheRpsContract = (await factory.deploy()) as FHERPS;
  const fheRpsContractAddress = await fheRpsContract.getAddress();

  return { fheRpsContract, fheRpsContractAddress };
}

describe("FHERps", function () {
  let signers: Signers;
  let fheRpsContract: FHERPS;
  let fheRpsContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async () => {
    ({ fheRpsContract, fheRpsContractAddress } = await deployFixture());
  });

  it("should be deployed", async function () {
    console.log(`FHERps has been deployed at address ${fheRpsContractAddress}`);
    // Test the deployed address is valid
    expect(ethers.isAddress(fheRpsContractAddress)).to.eq(true);
  });

  it("test rock,paper,scissors", async function () {
    const rock = 0;
    const paper = 1;
    const scissors = 2;

    const encryptedRock = await fhevm
      .createEncryptedInput(fheRpsContractAddress, signers.alice.address)
      .add8(rock)
      .encrypt();

    const encryptedPaper = await fhevm
      .createEncryptedInput(fheRpsContractAddress, signers.alice.address)
      .add8(paper)
      .encrypt();

    const encryptedScissors = await fhevm
      .createEncryptedInput(fheRpsContractAddress, signers.alice.address)
      .add8(scissors)
      .encrypt();

    const tx_rock = await fheRpsContract
      .connect(signers.alice)
      .play(encryptedRock.handles[0], encryptedRock.inputProof);
    await tx_rock.wait();

    const tx_paper = await fheRpsContract
      .connect(signers.alice)
      .play(encryptedPaper.handles[0], encryptedPaper.inputProof);
    await tx_paper.wait();

    const tx_scissors = await fheRpsContract
      .connect(signers.alice)
      .play(encryptedScissors.handles[0], encryptedScissors.inputProof);
    await tx_scissors.wait();

    const [encryptedWin, encryptedLoss, encryptedTie] = await fheRpsContract.getWinLossTieStats(signers.alice);

    const clearWin = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedWin,
      fheRpsContractAddress,
      signers.alice,
    );
    const clearLoss = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedLoss,
      fheRpsContractAddress,
      signers.alice,
    );
    const clearTie = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedTie,
      fheRpsContractAddress,
      signers.alice,
    );

    console.log(`win ${clearWin}, loss ${clearLoss}, tie ${clearTie}`);
  });

});
```

In the test, we use `fhevm.createEncryptedInput` to create encrypted inputs for rock, paper, and scissors. Then we call `play` function with the encrypted inputs and the input proof. After play, we can get the encrypted win/loss/tie stats of the user by calling the contract's `getWinLossTieStats` function. Finally, we decrypt the win/loss/tie stats to get the clear values. Because we do not update the pre-generated `_rps` in the contract, so the win/loss/tie stats should be exactly 1, 1, 1 after playing rock, paper, and scissors alternately. **It should be noted that users can only decrypt their own win/loss/tie stats.**

To support multi-round game, we update the pre-generated `_rps` after each play:

```solidity {.line-numbers}
   function play(externalEuint8 inputEuint8, bytes calldata inputProof) external {
      euint8 encryptedEuint8 = FHE.fromExternal(inputEuint8, inputProof);
      euint8 play_rps = FHE.rem(encryptedEuint8, 3);
      ...
      FHE.allow(win_update, msg.sender);
      FHE.allow(loss_update, msg.sender);
      FHE.allow(tie_update, msg.sender);

      euint64 r64 = FHE.randEuint64();
      _rps = FHE.asEuint8(FHE.rem(r64, 3));
      FHE.allowThis(_rps);
   }

```

### Implement the Leaderboard
In our contract, we maintain a encrypted leaderboard to track the top winner (one with the most wins).

First, we add two variables to store the top winner's address and win amount:
```solidity {.line-numbers}
...
contract FHERPS is SepoliaConfig {
    /**
     * @notice 0 = Rock, 1 = Paper, 2 = Scissors
     */
    euint8 private _rps;

    eaddress private _top_winner_address;
    euint64 private _top_win_amount;

    ...
}
```

Then, we update the `play` function to update the top winner's address and win amount:
```solidity {.line-numbers}
    function play(externalEuint8 inputEuint8, bytes calldata inputProof) external {
        euint8 encryptedEuint8 = FHE.fromExternal(inputEuint8, inputProof);
        euint8 play_rps = FHE.rem(encryptedEuint8, 3);

        // calculate (3 + play_rps - _rps) % 3: 0 = tie, 1 = win, 2 = loss
        euint8 result = FHE.rem(FHE.sub(FHE.add(play_rps, 3), _rps), 3);
        ebool win = FHE.eq(result, 1);
        ebool tie = FHE.eq(result, 0);
        ebool loss = FHE.eq(result, 2);

        euint64 win_update = FHE.add(_win_map[msg.sender], FHE.asEuint64(win));
        euint64 tie_update = FHE.add(_tie_map[msg.sender], FHE.asEuint64(tie));
        euint64 loss_update = FHE.add(_loss_map[msg.sender], FHE.asEuint64(loss));

        _win_map[msg.sender] = win_update;
        _tie_map[msg.sender] = tie_update;
        _loss_map[msg.sender] = loss_update;

        FHE.allowThis(win_update);
        FHE.allowThis(loss_update);
        FHE.allowThis(tie_update);

        FHE.allow(win_update, msg.sender);
        FHE.allow(loss_update, msg.sender);
        FHE.allow(tie_update, msg.sender);

        if (!FHE.isInitialized(_top_winner_address)) {
            _top_winner_address = FHE.asEaddress(msg.sender);
            _top_win_amount = win_update;
        } else {
            ebool is_new_top_winner = FHE.gt(win_update, _top_win_amount);
            _top_winner_address = FHE.select(is_new_top_winner, FHE.asEaddress(msg.sender), _top_winner_address);
            _top_win_amount = FHE.select(is_new_top_winner, win_update, _top_win_amount);
        }

        FHE.allowThis(_top_win_amount);
        FHE.allowThis(_top_winner_address);

        euint64 r64 = FHE.randEuint64();
        _rps = FHE.asEuint8(FHE.rem(r64, 3));
        FHE.allowThis(_rps);
    }
```

In the `play` function, after calculating the user's win amount, we compare the user's win amount with the current top winner's win amount. If the user's win amount is greater, we update the top winner's address and win amount. Because FHE cannot support `if` statement, we use `FHE.select` to select the new top winner's address and win amount based on the encrypted comparation result `is_new_top_winner`.

In this game, we want the top winner's address and win amount can be public decrypted. However, in the above code, only the contract can access and decrypt the top winner's address and win amount. To solve this problem, we use the FHEVM's on-chain decryption oracle to decrypt them.

We add a `decryptTopWinner` function to request the decryption of the top winner's address and win amount: 
```solidity {.line-numbers}
Contract FHERPS is SepoliaConfig {
    ...
    eaddress private _top_winner_address;
    euint64 private _top_win_amount;
    uint256 private _decrypt_request_id;
    uint256 private _decrypt_request_block;

    uint256 public latest_decrypt_block;
    bool public is_decrypting;
    address public clear_top_winner_address;
    uint64 public clear_top_win_amount;

    ...

    function decryptTopWinner() external {
        require(is_decrypting == false);

        is_decrypting = true;
        _decrypt_request_block = block.number;

        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(_top_winner_address);
        cts[1] = FHE.toBytes32(_top_win_amount);
        _decrypt_request_id = FHE.requestDecryption(cts, this.resolveTopWinnerCallback.selector);
    }

    function resolveTopWinnerCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) external {
        require(requestId == _decrypt_request_id, "Invalid requestId");
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);

        (address resultTopWinnerAddress, uint64 resultTopWinAmount) = abi.decode(cleartexts, (address, uint64));
        clear_top_winner_address = resultTopWinnerAddress;
        clear_top_win_amount = resultTopWinAmount;
        latest_decrypt_block = _decrypt_request_block;
        is_decrypting = false;
    }

    function getTopWinnerStats() external view returns (address, uint64, bool, uint256) {
        return (clear_top_winner_address, clear_top_win_amount, is_decrypting, latest_decrypt_block);
    }
}
```

In the `decryptTopWinner` function, we call the FHEVM's `requestDecryption` function to request the decryption of the top winner's address and win amount, and the `resolveTopWinnerCallback` function is passed as the callback function. The decrytion is asynchronous and the callback function will be called when the decryption is finished. In the `resolveTopWinnerCallback` function, we first check the signature of the decryption proof and get the decrypted result. The decrypted result is stored in the `clear_top_winner_address` and `clear_top_win_amount` variables, so that everyone can read them.

Now, we implement all the FHE-RPS game logic, and the full code is as follows:
```solidity {.line-numbers}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {FHE, euint8, euint64, ebool, externalEuint8, eaddress} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract FHERPS is SepoliaConfig {
    /**
     * @notice 0 = Rock, 1 = Paper, 2 = Scissors
     */
    euint8 private _rps;
    eaddress private _top_winner_address;
    euint64 private _top_win_amount;
    uint256 private _decrypt_request_id;
    uint256 private _decrypt_request_block;

    mapping(address account => euint64 winAmount) private _win_map;
    mapping(address account => euint64 lossAmount) private _loss_map;
    mapping(address account => euint64 tieAmount) private _tie_map;

    uint256 public latest_decrypt_block;
    bool public is_decrypting;
    address public clear_top_winner_address;
    uint64 public clear_top_win_amount;

    constructor() {
        euint64 r64 = FHE.randEuint64();
        _rps = FHE.asEuint8(FHE.rem(r64, 3));
        FHE.allowThis(_rps);
        is_decrypting = false;
    }

    function play(externalEuint8 inputEuint8, bytes calldata inputProof) external {
        euint8 encryptedEuint8 = FHE.fromExternal(inputEuint8, inputProof);
        euint8 play_rps = FHE.rem(encryptedEuint8, 3);

        // calculate (3 + play_rps - _rps) % 3: 0 = tie, 1 = win, 2 = loss
        euint8 result = FHE.rem(FHE.sub(FHE.add(play_rps, 3), _rps), 3);
        ebool win = FHE.eq(result, 1);
        ebool tie = FHE.eq(result, 0);
        ebool loss = FHE.eq(result, 2);

        euint64 win_update = FHE.add(_win_map[msg.sender], FHE.asEuint64(win));
        euint64 tie_update = FHE.add(_tie_map[msg.sender], FHE.asEuint64(tie));
        euint64 loss_update = FHE.add(_loss_map[msg.sender], FHE.asEuint64(loss));

        _win_map[msg.sender] = win_update;
        _tie_map[msg.sender] = tie_update;
        _loss_map[msg.sender] = loss_update;

        FHE.allowThis(win_update);
        FHE.allowThis(loss_update);
        FHE.allowThis(tie_update);

        FHE.allow(win_update, msg.sender);
        FHE.allow(loss_update, msg.sender);
        FHE.allow(tie_update, msg.sender);

        if (!FHE.isInitialized(_top_winner_address)) {
            _top_winner_address = FHE.asEaddress(msg.sender);
            _top_win_amount = win_update;
        } else {
            ebool is_new_top_winner = FHE.gt(win_update, _top_win_amount);
            _top_winner_address = FHE.select(is_new_top_winner, FHE.asEaddress(msg.sender), _top_winner_address);
            _top_win_amount = FHE.select(is_new_top_winner, win_update, _top_win_amount);
        }

        FHE.allowThis(_top_win_amount);
        FHE.allowThis(_top_winner_address);

        euint64 r64 = FHE.randEuint64();
        _rps = FHE.asEuint8(FHE.rem(r64, 3));
        FHE.allowThis(_rps);
    }

    function decryptTopWinner() external {
        require(is_decrypting == false);

        is_decrypting = true;
        _decrypt_request_block = block.number;

        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(_top_winner_address);
        cts[1] = FHE.toBytes32(_top_win_amount);
        _decrypt_request_id = FHE.requestDecryption(cts, this.resolveTopWinnerCallback.selector);
    }

    function resolveTopWinnerCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) external {
        require(requestId == _decrypt_request_id, "Invalid requestId");
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);

        (address resultTopWinnerAddress, uint64 resultTopWinAmount) = abi.decode(cleartexts, (address, uint64));
        clear_top_winner_address = resultTopWinnerAddress;
        clear_top_win_amount = resultTopWinAmount;
        latest_decrypt_block = _decrypt_request_block;
        is_decrypting = false;
    }

    function getWinLossTieStats(address user) external view returns (euint64, euint64, euint64) {
        return (_win_map[user], _loss_map[user], _tie_map[user]);
    }

    function getTopWinnerStats() external view returns (address, uint64, bool, uint256) {
        return (clear_top_winner_address, clear_top_win_amount, is_decrypting, latest_decrypt_block);
    }
}
```

We also update the test file to test the FHE-RPS game:

```typescript {.line-numbers}
import { FHERPS, FHERPS__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHERPS")) as FHERPS__factory;
  const fheRpsContract = (await factory.deploy()) as FHERPS;
  const fheRpsContractAddress = await fheRpsContract.getAddress();

  return { fheRpsContract, fheRpsContractAddress };
}

describe("FHERps", function () {
  let signers: Signers;
  let fheRpsContract: FHERPS;
  let fheRpsContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async () => {
    ({ fheRpsContract, fheRpsContractAddress } = await deployFixture());
  });

  it("should be deployed", async function () {
    console.log(`FHERps has been deployed at address ${fheRpsContractAddress}`);
    // Test the deployed address is valid
    expect(ethers.isAddress(fheRpsContractAddress)).to.eq(true);
  });

  it("test rock,paper,scissors", async function () {
    const rock = 0;
    const paper = 1;
    const scissors = 2;

    const encryptedRock = await fhevm
      .createEncryptedInput(fheRpsContractAddress, signers.alice.address)
      .add8(rock)
      .encrypt();

    const encryptedPaper = await fhevm
      .createEncryptedInput(fheRpsContractAddress, signers.alice.address)
      .add8(paper)
      .encrypt();

    const encryptedScissors = await fhevm
      .createEncryptedInput(fheRpsContractAddress, signers.alice.address)
      .add8(scissors)
      .encrypt();

    const tx_rock = await fheRpsContract
      .connect(signers.alice)
      .play(encryptedRock.handles[0], encryptedRock.inputProof);
    await tx_rock.wait();
    const tx_paper = await fheRpsContract
      .connect(signers.alice)
      .play(encryptedPaper.handles[0], encryptedPaper.inputProof);
    await tx_paper.wait();
    const tx_scissors = await fheRpsContract
      .connect(signers.alice)
      .play(encryptedScissors.handles[0], encryptedScissors.inputProof);
    await tx_scissors.wait();

    const [encryptedWin, encryptedLoss, encryptedTie] = await fheRpsContract.getWinLossTieStats(signers.alice);
    console.log(`${encryptedWin}`);

    const clearWin = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedWin,
      fheRpsContractAddress,
      signers.alice,
    );
    const clearLoss = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedLoss,
      fheRpsContractAddress,
      signers.alice,
    );
    const clearTie = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedTie,
      fheRpsContractAddress,
      signers.alice,
    );

    console.log(`win ${clearWin}, loss ${clearLoss}, tie ${clearTie}`);

    {
      await fheRpsContract.decryptTopWinner();
      await fhevm.awaitDecryptionOracle();
      const clear_top_winner_address = await fheRpsContract.clear_top_winner_address();
      const clear_top_win_amount = await fheRpsContract.clear_top_win_amount();
      const block = await fheRpsContract.latest_decrypt_block();

      console.log(`top winner ${clear_top_winner_address}, top win amount ${clear_top_win_amount}, block ${block}`);
    }

    {
      await fheRpsContract.decryptTopWinner();
      await fhevm.awaitDecryptionOracle();
      const clear_top_winner_address = await fheRpsContract.clear_top_winner_address();
      const clear_top_win_amount = await fheRpsContract.clear_top_win_amount();
      const block = await fheRpsContract.latest_decrypt_block();

      console.log(`top winner ${clear_top_winner_address}, top win amount ${clear_top_win_amount}, block ${block}`);
    }

    const [clear_top_winner_address, clear_top_win_amount, is_decrypting, latest_decrypt_block] = await fheRpsContract.getTopWinnerStats();
    console.log(`top winner ${clear_top_winner_address}, top win amount ${clear_top_win_amount}, block ${latest_decrypt_block}, is decrypting ${is_decrypting}`);

  });
});
```

Compile and run the test:
```bash
npx hardhat compile
npx hardhat test
```

You will see that the top winner is `signers.alice`.

## Deploy the Contract
Before deploying, make sure you have correctly set up the hardhat `MNEMONIC` environment variable:
```bash
npx hardhat vars set MNEMONIC <your mnemonic>
```

Also, make sure you have enough Sepolia ETH to cover the deployment cost. You can get some from the Google Ethereum Sepolia Faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia

Then, we can deploy the contract to Sepolia Testnet using the `deploy` command in Hardhat:
```bash
npx hardhat --network sepolia deploy
```

I have already depolyed a contract at the address: 
`0x6ef3fe49967184f3e6e861b3178bd03d7c237c65` https://sepolia.etherscan.io/address/0x6ef3fe49967184f3e6e861b3178bd03d7c237c65#code

## Build the Frontend
To build the frontend, I recommend using [Rainbow Kit](https://rainbowkit.com/) + [Wagmi](https://wagmi.sh/) to handle the wallet connection and contract interaction. This repo provides a simple frontend example in the `frontend` directory.

For simplicity, I will not go into details about the basics of React/TypeScript/Next.js here. Please refer to the [official documentation](https://nextjs.org/docs) for more information. Let's focus on how to interact with the deployed contract, including how to initialize the Zama's FHEVM SDK, how to pass encrypted inputs to the contract, how to decrypt user's own win/loss/tie stats, and how to request decrypting the top winner.

### Init the FHEVM SDK
To initialize the FHEVM SDK, we should first include the FHEVM script:
```typescript
// src/pages/index.tsx:27
<Script src="https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs" type="text/javascript" strategy='beforeInteractive' />
```

Then, we can initialize the FHEVM SDK by calling `initSDK()` and `createInstance(SepoliaConfig)`:
```typescript
// src/pages/index.tsx:15
const [fhevm, setFhevm] = useState<FhevmInstance | null>(null);
useEffect(() => {
  (async () => {
    const { initSDK, createInstance, SepoliaConfig } = await import('@zama-fhe/relayer-sdk/bundle')
    await initSDK();
    const fhe = await createInstance(SepoliaConfig);
    setFhevm(fhe);
  })();
}, []);
```

### Encrypt Inputs
To encrypt inputs, we need to call `fhevm.createEncryptedInput()`, and then we convert the result to hex string, and finally we call wagmi's `writeContractAsync` to send the transaction:

```typescript
// frontend/src/hooks/use_game.ts:72
const encryptedMove = await
  fhevm.createEncryptedInput(CONFIG.CONTRACT_ADDRESS, address)
    .add8(move)
    .encrypt();

const toHex = (uint8Array: Uint8Array): `0x${string}` => {
  return ('0x' + Array.from(uint8Array)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')) as `0x${string}`;
};

const hash = await writeContractAsync({
  address: CONFIG.CONTRACT_ADDRESS as `0x${string}`,
  abi: FHERPS_ABI,
  functionName: "play",
  args: [toHex(encryptedMove.handles[0]), toHex(encryptedMove.inputProof)],
});
```


### Decrypt User Stats
To decrypt user's private stats, we first need to create an `EIP72` object by calling `fhevm.createEIP712()`:
```typescript
// frontend/src/hooks/use_game.ts:222
const start_time_stamp = Math.floor(Date.now() / 1000).toString();
const duration_days = "1";

const eip712 = fhevm.createEIP712(
  keypair.publicKey,
  [CONFIG.CONTRACT_ADDRESS],
  start_time_stamp,
  duration_days
);
```

Then, we use wagmi's `signTypedData` to request the user's signature:
```typescript
// frontend/src/hooks/use_game.ts:235
const dec_types = {
  UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification
};

const signature = await signTypedDataAsync(
  {
    domain: {
      ...eip712.domain,
      verifyingContract: eip712.domain.verifyingContract as `0x${string}`,
    },
    types: dec_types,
    message: eip712.message,
    primaryType: 'UserDecryptRequestVerification',
    account: account.address as `0x${string}`,
  }
);
```

Finally, we can decrypt the stats by calling `fhevm.userDecrypt()`:

```typescript
// frontend/src/hooks/use_game.ts:253
const handle_pairs = [
  {
    handle: win_handle,
    contractAddress: CONFIG.CONTRACT_ADDRESS
  },
  {
    handle: loss_handle,
    contractAddress: CONFIG.CONTRACT_ADDRESS
  },
  {
    handle: tie_handle,
    contractAddress: CONFIG.CONTRACT_ADDRESS
  },
];

const result = await fhevm.userDecrypt(
  handle_pairs,
  keypair.privateKey,
  keypair.publicKey,
  signature,
  [CONFIG.CONTRACT_ADDRESS],
  account.address as `0x${string}`,
  start_time_stamp,
  duration_days
);
```

### Request Decrypting the Top Winner
To request decrypting the top winner, we can use wagmi's `writeContractAsync` to send the transaction:

```typescript
// frontend/src/hooks/use_game.ts:138
const hash = await writeContractAsync({
  address: CONFIG.CONTRACT_ADDRESS as `0x${string}`,
  abi: FHERPS_ABI,
  functionName: "decryptTopWinner",
  args: [],
});
```

With these steps, we can build a full dApp of the FHE Rock-Paper-Scissors game. I have already deployed a full-stack demo at: https://rps-dapp-bbfh.vercel.app/. You can play with the demo dApp :).

## Conclusion
In this tutorial, we have learned the basic programming concepts of FHEVM and how to use it to build a simple game. We have also learned how to deploy the contract to Sepolia Testnet and interact with it using the FHEVM SDK. 

As a Turing-complete scheme, FHE provides a new paradigm for building privacy-preserving applications in the modern age.  I hope this tutorial helps you to get started with FHE and enjoy learning about the future of privacy-preserving computing.